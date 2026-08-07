import { useAuth } from './stores';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005/api';

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

async function handleResponse<T>(res: Response): Promise<T> {
  // An endpoint that legitimately resolves to nothing — `GET /realms/me` for a
  // user who isn't a creator — sends an empty body, which `res.json()` rejects.
  // Read the text first so "no content" becomes null instead of a parse error.
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message[0]
      : (data?.message ?? 'Something went wrong. Please try again.');
    throw new ApiError(message, data?.code);
  }

  return data as T;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader(), ...options?.headers },
    ...options,
  });

  return handleResponse<T>(res);
}

async function requestForm<T>(path: string, formData: FormData, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...authHeader(), ...options?.headers },
    body: formData,
    ...options,
  });

  return handleResponse<T>(res);
}

export interface AuthResponse {
  accessToken: string;
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

export const signalsApi = {
  list: () => request<SignalListItem[]>('/signals'),
};

export const marketApi = {
  getOverview: () => request<MarketOverview>('/market/overview'),
};

export const walletApi = {
  getMe: () => request<WalletOverview>('/wallet/me'),
};

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

export interface FeedPost {
  id: string;
  kind: PostKind;
  body: string | null;
  mediaUrls: string[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  bookmarkCount: number;
  pinned: boolean;
  realmId: string | null;
  /** Non-null on realm posts — credit the page rather than `author`. */
  realm: PostRealm | null;
  createdAt: string;
  author: PostAuthor;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
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
  /** `realmId` publishes under the caller's own realm instead of personally. */
  create: (body: string, media: File[], realmId?: string | null) => {
    const formData = new FormData();
    if (body.trim()) formData.append('body', body.trim());
    media.forEach((file) => formData.append('media', file));
    if (realmId) formData.append('realmId', realmId);
    return requestForm<FeedPost>('/posts', formData, { method: 'POST' });
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
