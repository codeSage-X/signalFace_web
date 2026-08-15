import { useAuth } from './stores';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://signalface-api.onrender.com/api';

export class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function authHeader(): Record<string, string> {
  const token = useAuth.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Shared by the fetch and XHR paths so both report errors identically. */
function parseBody<T>(ok: boolean, text: string): T {
  // An endpoint that legitimately resolves to nothing — `GET /realms/me` for a
  // user who isn't a creator — sends an empty body, which `JSON.parse` rejects.
  // Reading the text first makes "no content" null instead of a parse error.
  const data = text ? JSON.parse(text) : null;

  if (!ok) {
    const message = Array.isArray(data?.message)
      ? data.message[0]
      : (data?.message ?? 'Something went wrong. Please try again.');
    throw new ApiError(message, data?.code);
  }

  return data as T;
}

async function handleResponse<T>(res: Response): Promise<T> {
  return parseBody<T>(res.ok, await res.text());
}

/**
 * Shared by every concurrent 401 so a page with several requests in flight
 * triggers one renewal, not one per request — rotation is single-use, so racing
 * refreshes would burn each other's token and log the user out.
 */
let renewal: Promise<string | null> | null = null;

/** Resolves to the new access token, or null if the session is truly over. */
function renewSession(): Promise<string | null> {
  renewal ??= (async () => {
    try {
      const token = useAuth.getState().refreshToken;
      if (!token) return null;

      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as AuthResponse;
      useAuth.getState().setTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      // Offline or the API is down. Not proof the session ended, so the caller
      // surfaces a normal error and leaves the session in place to retry later.
      return null;
    } finally {
      renewal = null;
    }
  })();

  return renewal;
}

/**
 * Runs a request and, on a 401, renews the session once and replays it. The
 * thunk rebuilds its headers per call so the replay carries the new token.
 *
 * When renewal fails the local session is cleared, which is what stops the UI
 * from sitting there looking signed in while every action 401s — the state
 * users had to manually log out of to escape.
 */
async function send<T>(path: string, sendOnce: () => Promise<Response>): Promise<T> {
  const res = await sendOnce();

  // A 401 from /auth/* is a credential error (wrong password, spent OTP), not
  // an expired session — renewing would be meaningless.
  if (res.status !== 401 || path.startsWith('/auth/')) return handleResponse<T>(res);

  const { isAuthenticated, refreshToken } = useAuth.getState();

  // Genuinely signed out — report the 401 as the plain "not signed in" it is.
  if (!isAuthenticated) return handleResponse<T>(res);

  if (refreshToken && (await renewSession())) return handleResponse<T>(await sendOnce());

  // Either renewal failed, or there was no refresh token to renew from — the
  // latter being every session stored before refresh tokens existed, whose
  // persisted `isAuthenticated: true` outlives an access token it can't replace.
  // Both end the same way: drop the session so signing in again is possible.
  useAuth.getState().logout();
  throw new ApiError('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  return send<T>(path, () =>
    fetch(`${BASE}${path}`, {
      ...options,
      // After `...options`, or an `options.headers` would replace the merged
      // object wholesale and drop the Authorization header.
      headers: { 'Content-Type': 'application/json', ...authHeader(), ...options?.headers },
    }),
  );
}

async function requestForm<T>(path: string, formData: FormData, options?: RequestInit): Promise<T> {
  return send<T>(path, () =>
    fetch(`${BASE}${path}`, {
      ...options,
      body: formData,
      headers: { ...authHeader(), ...options?.headers },
    }),
  );
}

export interface UploadOptions {
  /** 0–100 for bytes handed to the network. 100 means sent, not yet processed. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * One upload attempt over XHR. This exists because `fetch` cannot report how much
 * of a request body has been sent — there is no upload-progress event on it — and
 * a video upload with no percentage is exactly the spinner we're replacing.
 */
function xhrUpload(
  path: string,
  formData: FormData,
  { onProgress, signal }: UploadOptions,
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);

    // Content-Type is deliberately unset: the browser has to add the multipart
    // boundary itself, and setting the header manually would omit it.
    Object.entries(authHeader()).forEach(([key, value]) => xhr.setRequestHeader(key, value));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () =>
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: xhr.responseText,
      });
    xhr.onerror = () =>
      reject(new ApiError('Network error — check your connection and try again.', 'NETWORK'));
    xhr.ontimeout = () => reject(new ApiError('The upload timed out.', 'TIMEOUT'));
    xhr.onabort = () => reject(new ApiError('Upload cancelled.', 'ABORTED'));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}

/** requestForm's contract, with progress — and the same 401 renewal behaviour. */
async function uploadForm<T>(
  path: string,
  formData: FormData,
  options: UploadOptions = {},
): Promise<T> {
  let res = await xhrUpload(path, formData, options);

  if (res.status === 401) {
    const { isAuthenticated, refreshToken } = useAuth.getState();

    if (isAuthenticated) {
      if (refreshToken && (await renewSession())) {
        // Retry once with the renewed token. FormData is re-readable, so the
        // same body can be sent again.
        res = await xhrUpload(path, formData, options);
      } else {
        useAuth.getState().logout();
        throw new ApiError('Your session has expired. Please sign in again.', 'SESSION_EXPIRED');
      }
    }
  }

  return parseBody<T>(res.ok, res.text);
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    displayName: string;
    role: string;
    creatorStatus: string;
    pointsBalance: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    createdAt: string;
  };
}

export interface GoogleAuthResponse extends AuthResponse {
  isNewUser: boolean;
}

export interface RegisterResponse {
  email: string;
  message: string;
}

export interface MessageResponse {
  message: string;
}

export interface UserSignal {
  id: string;
  score: string;
  price: string;
  prevScore: string;
  growthPct: string;
  lastScoredAt: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  websiteUrl: string | null;
  role: string;
  creatorStatus: string;
  /** Topics this person wants more of. Drives feed ranking. */
  interests: RealmCategory[];
  accountStatus: 'ACTIVE' | 'RESTRICTED' | 'BLOCKED';
  statusReason: string | null;
  pointsBalance: string;
  emailVerified: boolean;
  createdAt: string;
  followingCount: number;
  followersCount: number;
  likesCount: number;
  signal: UserSignal | null;
}

export const authApi = {
  register: (body: unknown) =>
    request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: unknown) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  google: (body: { idToken: string }) =>
    request<GoogleAuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  verifyEmail: (body: { email: string; otp: string }) =>
    request<AuthResponse>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  resendOtp: (body: { email: string }) =>
    request<MessageResponse>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  forgotPassword: (body: { email: string }) =>
    request<MessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  verifyResetOtp: (body: { email: string; otp: string }) =>
    request<MessageResponse>('/auth/verify-reset-otp', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  resetPassword: (body: { email: string; otp: string; password: string }) =>
    request<AuthResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Renewal is handled automatically by `send` — this is for explicit calls. */
  refresh: (body: { refreshToken: string }) =>
    request<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export interface SignalListItem {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatarUrl: string | null;
  score: string;
  price: string;
  growthPct: string;
  holdersCount: number;
  lastScoredAt: string | null;
  createdAt: string;
}

export interface MarketOverview {
  totalMarketValue: string;
  totalSignals: number;
  activeTraders: number;
  tradingVolume24h: string;
  marketTrend: Array<{ date: string; value: number }>;
}

export interface WalletHolding {
  signalId: string;
  creatorName: string;
  creatorUsername: string;
  quantity: string;
  avgBuyPrice: string;
  currentPrice: string;
  currentValue: string;
}

export interface WalletOverview {
  pointsBalance: string;
  holdings: WalletHolding[];
  totalValue: string;
  change24h: number;
}

// ─── Rewards & referrals ──────────────────────────────────────────────────────

export type RewardType = 'SIGNUP_BONUS' | 'REFERRAL_BONUS' | 'ONE_TIME' | 'RECURRING';

export interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  type: RewardType;
  amount: string;
  cooldownHours: number | null;
  maxPerUser: number | null;
  timesClaimedByMe: number;
  lastClaimedAt: string | null;
  /** When a cooldown is running, when it lifts. */
  availableAt: string | null;
  claimable: boolean;
  /** Why it isn't claimable. Null when it is. */
  reason: string | null;
}

export interface ReferralPerson {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** Unverified invitees haven't paid out yet. */
  verified: boolean;
  joinedAt: string;
}

export interface ReferralSummary {
  referralCode: string;
  /** What a referral is worth right now; null when none is configured. */
  bonusAmount: string | null;
  totalEarned: string;
  referrals: ReferralPerson[];
}

export const rewardsApi = {
  list: () => request<{ items: RewardItem[] }>('/rewards'),
  claim: (id: string) =>
    request<{ claimId: string; amount: string; balance: string }>(`/rewards/${id}/claim`, {
      method: 'POST',
    }),
  referrals: () => request<ReferralSummary>('/rewards/referrals'),
};

export const signalsApi = {
  list: () => request<SignalListItem[]>('/signals'),
};

export const marketApi = {
  getOverview: () => request<MarketOverview>('/market/overview'),
};

export const walletApi = {
  getMe: () => request<WalletOverview>('/wallet/me'),
};

/** A person in the followers / following lists. */
export interface FollowPerson {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  creatorStatus: string;
  followersCount: number;
  /** Whether the viewer follows them — always true in the `following` list. */
  isFollowedByMe: boolean;
}

export const usersApi = {
  getMe: () => request<UserProfile>('/users/me'),
  updateProfile: (body: { bio?: string; websiteUrl?: string }) =>
    request<UserProfile>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  updateAccount: (body: { email?: string; username?: string; displayName?: string }) =>
    request<UserProfile>('/users/me/account', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getPublicProfile: (username: string) =>
    request<PublicProfile>(`/users/${encodeURIComponent(username)}`),
  toggleFollow: (username: string) =>
    request<{ username: string; following: boolean; followersCount: number }>(
      `/users/${encodeURIComponent(username)}/follow`,
      { method: 'POST' },
    ),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return requestForm<UserProfile>('/users/me/avatar', formData, { method: 'POST' });
  },
  /** Accounts the viewer follows. */
  following: (cursor?: string | null, limit?: number) =>
    request<Page<FollowPerson>>(`/users/me/following${pageQuery(cursor, limit)}`),
  /** Accounts following the viewer. */
  followers: (cursor?: string | null, limit?: number) =>
    request<Page<FollowPerson>>(`/users/me/followers${pageQuery(cursor, limit)}`),
  /** Replaces the viewer's chosen topics. Sent whole — deselecting all is valid. */
  updateInterests: (interests: RealmCategory[]) =>
    request<{ interests: RealmCategory[] }>('/users/me/interests', {
      method: 'PATCH',
      body: JSON.stringify({ interests }),
    }),
  /** Live check for the sign-up form. Advisory — registration is authoritative. */
  usernameAvailable: (username: string) =>
    request<{ username: string; available: boolean; reason: 'taken' | 'invalid' | null }>(
      `/users/username-available?username=${encodeURIComponent(username)}`,
    ),
  /** People you may know — ranked by mutual follows. */
  suggestions: (limit?: number) =>
    request<{ items: FollowPerson[] }>(
      `/users/suggestions${limit ? `?limit=${limit}` : ''}`,
    ),
  /** Accounts matching a query, by handle or display name. */
  search: (q: string, cursor?: string | null, limit?: number) =>
    request<Page<FollowPerson>>(
      `/users/search?q=${encodeURIComponent(q)}${pageQuery(cursor, limit).replace('?', '&')}`,
    ),
};

// ─── Posts ────────────────────────────────────────────────────────────────────

export type PostKind = 'text' | 'image' | 'video';

export interface PostAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  creatorStatus: string;
  followedByMe?: boolean;
}

/** The page a post was published under, when it wasn't posted personally. */
export interface PostRealm {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  category: RealmCategory;
  followedByMe: boolean;
}

/**
 * How a post is framed. Part of the API contract, so it lives here and the
 * composer imports it rather than the other way round — `lib` must not depend
 * on `components`.
 */
export const ASPECT_RATIOS = ['ORIGINAL', '1:1', '4:5', '16:9', '9:16'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** One media item with its own type — a post may mix video and images. */
export interface PostMediaItem {
  url: string;
  kind: 'image' | 'video';
}

export interface FeedPost {
  id: string;
  /**
   * The lead item's type, which is what a grid thumbnail needs. To render the
   * whole post use `media` — a mixed video+image post is not described by this.
   */
  kind: PostKind;
  body: string | null;
  mediaUrls: string[];
  /** Every item, each with its own kind, in post order. */
  media: PostMediaItem[];
  /**
   * How the author framed the post. Images are already cropped to it, so this
   * matters most for video, which the browser could not re-encode.
   */
  aspectRatio: AspectRatio | null;
  /** Author-chosen video cover. Null means "use the first frame". */
  coverUrl: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  bookmarkCount: number;
  repostCount: number;
  pinned: boolean;
  realmId: string | null;
  /** Non-null on realm posts — credit the page rather than `author`. */
  realm: PostRealm | null;
  createdAt: string;
  author: PostAuthor;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  repostedByMe: boolean;
  isMine: boolean;
}

export interface PostComment {
  id: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  replyCount: number;
  author: PostAuthor;
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  websiteUrl: string | null;
  role: string;
  creatorStatus: string;
  createdAt: string;
  followingCount: number;
  followersCount: number;
  postsCount: number;
  likesCount: number;
  isMe: boolean;
  isFollowedByMe: boolean;
  signal: UserSignal | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

function pageQuery(cursor?: string | null, limit?: number) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const postsApi = {
  /**
   * `realmId` publishes under the caller's own realm instead of personally.
   * `options.onProgress` reports upload percentage; pass a signal to cancel.
   */
  create: (
    body: string,
    media: File[],
    realmId?: string | null,
    options?: UploadOptions & {
      aspectRatio?: AspectRatio;
      cover?: File;
      category?: RealmCategory | null;
    },
  ) => {
    const formData = new FormData();
    if (body.trim()) formData.append('body', body.trim());
    media.forEach((file) => formData.append('media', file));
    if (realmId) formData.append('realmId', realmId);
    // Omitted rather than sent empty, so the server falls back to inferring it.
    if (options?.category) formData.append('category', options.category);
    // 'ORIGINAL' is the server's default, so sending it would only add noise.
    if (options?.aspectRatio && options.aspectRatio !== 'ORIGINAL') {
      formData.append('aspectRatio', options.aspectRatio);
    }
    if (options?.cover) formData.append('cover', options.cover);
    return uploadForm<FeedPost>('/posts', formData, options);
  },
  feed: (cursor?: string | null, limit?: number) =>
    request<Page<FeedPost>>(`/posts/feed${pageQuery(cursor, limit)}`),
  byUsername: (username: string, cursor?: string | null, limit?: number) =>
    request<Page<FeedPost>>(`/posts/user/${encodeURIComponent(username)}${pageQuery(cursor, limit)}`),
  getOne: (id: string) => request<FeedPost>(`/posts/${id}`),
  remove: (id: string) => request<{ id: string; deleted: boolean }>(`/posts/${id}`, { method: 'DELETE' }),
  toggleLike: (id: string) =>
    request<{ postId: string; liked: boolean; likeCount: number }>(`/posts/${id}/like`, {
      method: 'POST',
    }),
  toggleBookmark: (id: string) =>
    request<{ postId: string; bookmarked: boolean; bookmarkCount: number }>(
      `/posts/${id}/bookmark`,
      { method: 'POST' },
    ),
  bookmarks: (cursor?: string | null, limit?: number) =>
    request<Page<FeedPost>>(`/posts/bookmarks${pageQuery(cursor, limit)}`),
  toggleRepost: (id: string) =>
    request<{ postId: string; reposted: boolean; repostCount: number }>(
      `/posts/${id}/repost`,
      { method: 'POST' },
    ),
  reposts: (cursor?: string | null, limit?: number) =>
    request<Page<FeedPost>>(`/posts/reposts${pageQuery(cursor, limit)}`),
  liked: (cursor?: string | null, limit?: number) =>
    request<Page<FeedPost>>(`/posts/liked${pageQuery(cursor, limit)}`),
  /**
   * Posts matching a query and/or a topic. `videosOnly` backs the Videos tab;
   * passing only a `category` is a topic browse, which is how Explore filters.
   */
  search: (
    q: string,
    opts: {
      cursor?: string | null;
      limit?: number;
      videosOnly?: boolean;
      category?: RealmCategory | null;
    } = {},
  ) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (opts.category) params.set('category', opts.category);
    if (opts.cursor) params.set('cursor', opts.cursor);
    if (opts.limit) params.set('limit', String(opts.limit));
    if (opts.videosOnly) params.set('videosOnly', 'true');
    return request<Page<FeedPost>>(`/posts/search?${params.toString()}`);
  },
  comments: (id: string, cursor?: string | null, limit?: number) =>
    request<Page<PostComment>>(`/posts/${id}/comments${pageQuery(cursor, limit)}`),
  addComment: (id: string, body: string, parentId?: string) =>
    request<PostComment>(`/posts/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify(parentId ? { body, parentId } : { body }),
    }),
  replies: (commentId: string, cursor?: string | null, limit?: number) =>
    request<Page<PostComment>>(`/posts/comments/${commentId}/replies${pageQuery(cursor, limit)}`),
  registerView: (id: string) =>
    request<{ postId: string; viewCount: number }>(`/posts/${id}/view`, { method: 'POST' }),
  pin: (id: string) =>
    request<{ id: string; pinned: boolean }>(`/posts/${id}/pin`, { method: 'PATCH' }),
  unpin: (id: string) =>
    request<{ id: string; pinned: boolean }>(`/posts/${id}/pin`, { method: 'DELETE' }),
};

// ─── Realms (creator pages) ───────────────────────────────────────────────────

export const REALM_CATEGORIES = [
  'MUSIC',
  'MOVIE',
  'COMEDY',
  'SPORTS',
  'FASHION',
  'BEAUTY',
  'GAMING',
  'TECH',
  'EDUCATION',
  'BUSINESS',
  'FOOD',
  'TRAVEL',
  'ART',
  'FITNESS',
  'CRYPTO',
  'OTHER',
] as const;

export type RealmCategory = (typeof REALM_CATEGORIES)[number];

/** Display labels — the API stores the enum, the UI shows these. */
export const REALM_CATEGORY_LABELS: Record<RealmCategory, string> = {
  MUSIC: 'Music',
  MOVIE: 'Film & TV',
  COMEDY: 'Comedy',
  SPORTS: 'Sports',
  FASHION: 'Fashion',
  BEAUTY: 'Beauty',
  GAMING: 'Gaming',
  TECH: 'Technology',
  EDUCATION: 'Education',
  BUSINESS: 'Business',
  FOOD: 'Food & Drink',
  TRAVEL: 'Travel',
  ART: 'Art & Design',
  FITNESS: 'Fitness',
  CRYPTO: 'Crypto & Web3',
  OTHER: 'Other',
};

export type RealmStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface Realm {
  id: string;
  name: string;
  slug: string;
  category: RealmCategory;
  tagline: string | null;
  description: string | null;
  iconUrl: string | null;
  coverUrl: string | null;
  websiteUrl: string | null;
  status: RealmStatus;
  followersCount: number;
  postsCount: number;
  createdAt: string;
  owner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  isMine: boolean;
  isFollowedByMe: boolean;
  /** Only returned by `getBySlug`. */
  signal?: UserSignal | null;
}

export interface CreateRealmBody {
  name: string;
  category: RealmCategory;
  slug?: string;
  tagline?: string;
  description?: string;
  websiteUrl?: string;
}

export type DashboardRange = '7D' | '30D' | '90D' | '1Y';

export interface CreatorDashboard {
  realm: { id: string; name: string; slug: string; iconUrl: string | null };
  signal: {
    id: string;
    price: string;
    score: string;
    growthPct: string;
    priceChangePct: number;
    lastScoredAt: string | null;
  };
  totals: {
    signalValue: string;
    valueChange: string;
    valueChangePct: number;
    holders: number;
    newHoldersThisWeek: number;
    shares: string;
    volume: string;
    volumeChangePct: number;
    rewards: string;
    followers: number;
  };
  /** Real price snapshots inside the selected range; may be empty. */
  performance: Array<{ date: string; value: number }>;
  distribution: Array<{ label: string; holders: number; sharePct: number }>;
  topHolders: Array<{
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    shares: string;
    value: string;
    sharePct: number;
  }>;
  recentActivity: Array<{
    id: string;
    kind: 'follower' | 'buy' | 'sell';
    text: string;
    username: string;
    avatarUrl: string | null;
    amount: string | null;
    at: string;
  }>;
}

function realmQuery(params: {
  q?: string;
  category?: RealmCategory | null;
  cursor?: string | null;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.category) search.set('category', params.category);
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const realmsApi = {
  /** Becoming a creator: creates the page and promotes the account. */
  create: (body: CreateRealmBody) =>
    request<Realm>('/realms', { method: 'POST', body: JSON.stringify(body) }),
  /** Null when the viewer hasn't become a creator yet. */
  getMine: () => request<Realm | null>('/realms/me'),
  update: (body: Partial<Omit<CreateRealmBody, 'slug'>>) =>
    request<Realm>('/realms/me', { method: 'PATCH', body: JSON.stringify(body) }),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return requestForm<Realm>('/realms/me/avatar', formData, { method: 'POST' });
  },
  uploadCover: (file: File) => {
    const formData = new FormData();
    formData.append('cover', file);
    return requestForm<Realm>('/realms/me/cover', formData, { method: 'POST' });
  },
  dashboard: (range: DashboardRange = '30D') =>
    request<CreatorDashboard>(`/realms/me/dashboard?range=${range}`),
  list: (params: {
    q?: string;
    category?: RealmCategory | null;
    cursor?: string | null;
    limit?: number;
  } = {}) => request<Page<Realm>>(`/realms${realmQuery(params)}`),
  getBySlug: (slug: string) => request<Realm>(`/realms/${encodeURIComponent(slug)}`),
  posts: (slug: string, cursor?: string | null, limit?: number) =>
    request<Page<FeedPost>>(`/realms/${encodeURIComponent(slug)}/posts${pageQuery(cursor, limit)}`),
  toggleFollow: (slug: string) =>
    request<{ slug: string; following: boolean; followersCount: number }>(
      `/realms/${encodeURIComponent(slug)}/follow`,
      { method: 'POST' },
    ),
};
