'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Gift,
  Loader2,
  Share2,
  Clock,
  Users as UsersIcon,
  Wallet,
} from 'lucide-react';
import {
  rewardsApi,
  ApiError,
  type ReferralSummary,
  type RewardItem,
} from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';

const fmtPoints = (value: string | number) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });

/** "in 3h" / "in 12m" — how long until a cooldown lifts. */
function untilReady(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'now';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.ceil(hours / 24)}d`;
}

export default function RewardsPage() {
  const { isAuthenticated, setAuthModalOpen, updateUser } = useAuth();
  const { addToast } = useToast();

  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [referrals, setReferrals] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Settled rather than all: a failure in one panel shouldn't blank the other.
    Promise.allSettled([rewardsApi.list(), rewardsApi.referrals()])
      .then(([r, ref]) => {
        if (cancelled) return;
        if (r.status === 'fulfilled') setRewards(r.value.items);
        if (ref.status === 'fulfilled') setReferrals(ref.value);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => load(), [load]);

  const handleClaim = async (reward: RewardItem) => {
    setClaiming(reward.id);
    try {
      const res = await rewardsApi.claim(reward.id);
      // The balance came back from the same transaction that paid it, so the
      // header updates without a refetch.
      updateUser({ pointsBalance: res.balance });
      addToast({
        message: `Claimed ${fmtPoints(res.amount)} SF!`,
        type: 'success',
        duration: 4000,
      });
      load();
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not claim that reward.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setClaiming(null);
    }
  };

  const inviteLink = referrals
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${referrals.referralCode}`
    : '';

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({ message: 'Could not copy the link.', type: 'error', duration: 3000 });
    }
  };

  const shareInvite = async () => {
    if (!navigator.share) return copyInvite();
    try {
      await navigator.share({ title: 'Join me on Signal Face', url: inviteLink });
    } catch {
      // Share sheet dismissed — nothing to report.
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
          <Gift size={24} className="text-muted-foreground" />
        </div>
        <p className="text-foreground font-semibold text-lg">Sign in to earn rewards</p>
        <p className="text-muted-foreground text-sm mt-1 mb-5">
          Claim bonuses and earn for every friend you invite.
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm brand-gradient hover:brightness-110 transition"
        >
          Sign in
        </button>
      </div>
    );
  }

  const verifiedReferrals = referrals?.referrals.filter((r) => r.verified).length ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Rewards</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Claim bonuses and earn for every friend who joins.
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={<Wallet size={16} />}
          label="Earned from referrals"
          value={loading ? '—' : `${fmtPoints(referrals?.totalEarned ?? 0)} SF`}
        />
        <StatCard
          icon={<UsersIcon size={16} />}
          label="Friends joined"
          value={loading ? '—' : String(verifiedReferrals)}
        />
        <StatCard
          icon={<Gift size={16} />}
          label="Ready to claim"
          value={loading ? '—' : String(rewards.filter((r) => r.claimable).length)}
        />
      </div>

      {/* Invite */}
      <section className="glass-card rounded-2xl p-6">
        <h2 className="font-bold text-foreground">Invite friends</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {referrals?.bonusAmount
            ? `You earn ${fmtPoints(referrals.bonusAmount)} SF each time someone you invite verifies their account.`
            : 'Share your link so friends can join with your code.'}
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0 px-3 py-2.5 rounded-xl glass-input text-sm text-foreground truncate">
            {loading ? 'Loading…' : inviteLink}
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyInvite}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold glass-chip text-foreground hover:brightness-125 transition disabled:opacity-50 flex items-center gap-2"
            >
              {copied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={shareInvite}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white brand-gradient hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2"
            >
              <Share2 size={14} />
              Share
            </button>
          </div>
        </div>

        {referrals && referrals.referrals.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-foreground mb-2">
              People you invited ({referrals.referrals.length})
            </p>
            <ul className="space-y-1">
              {referrals.referrals.slice(0, 8).map((person) => (
                <li key={person.id} className="flex items-center gap-3 py-1.5">
                  <span className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {person.avatarUrl ? (
                      <img src={person.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      person.displayName.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-foreground truncate">
                      {person.displayName}
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">
                      @{person.username}
                    </span>
                  </span>
                  {/* An unverified invite has not paid out yet, and saying so is
                      better than silently counting it. */}
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      person.verified
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-white/10 text-muted-foreground'
                    }`}
                  >
                    {person.verified ? 'Earned' : 'Pending'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Claimables */}
      <section>
        <h2 className="font-bold text-foreground mb-3">Available rewards</h2>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-card rounded-2xl p-5 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-white/[0.06] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-64 rounded bg-white/[0.06] animate-pulse" />
                </div>
                <div className="h-9 w-24 rounded-xl bg-white/[0.06] animate-pulse" />
              </div>
            ))}
          </div>
        ) : rewards.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Gift size={26} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold text-card-foreground">No rewards right now</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New rewards show up here as soon as they’re announced.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <span className="w-11 h-11 rounded-xl brand-gradient flex items-center justify-center flex-shrink-0">
                  <Gift size={18} className="text-white" />
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{reward.name}</p>
                  {reward.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{reward.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-primary">
                      +{fmtPoints(reward.amount)} SF
                    </span>
                    {reward.type === 'RECURRING' && reward.cooldownHours && (
                      <>
                        <span>·</span>
                        <span>every {reward.cooldownHours}h</span>
                      </>
                    )}
                    {reward.timesClaimedByMe > 0 && (
                      <>
                        <span>·</span>
                        <span>claimed {reward.timesClaimedByMe}×</span>
                      </>
                    )}
                  </p>
                </div>

                <button
                  onClick={() => handleClaim(reward)}
                  disabled={!reward.claimable || claiming === reward.id}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 flex-shrink-0 ${
                    reward.claimable
                      ? 'brand-gradient text-white hover:brightness-110'
                      : 'glass-chip text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {claiming === reward.id && <Loader2 size={14} className="animate-spin" />}
                  {reward.claimable
                    ? 'Claim'
                    : reward.availableAt
                      ? untilReady(reward.availableAt)
                      : (reward.reason ?? 'Unavailable')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground mt-1.5">{value}</p>
    </div>
  );
}
