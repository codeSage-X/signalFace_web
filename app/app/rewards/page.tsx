'use client';

import { UserAvatar } from '@/components/UserAvatar';

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
  type ReferralCommission,
  type ReferralCommissions,
  type ReferralSummary,
  type RewardItem,
} from '@/lib/api';
import {
  formatSignalFaceCoins,
  inviteLink as buildInviteLink,
  usdToSignalFaceCoins,
} from '@/lib/utils';
import { useAuth, useToast } from '@/lib/stores';
import { formatEcosystemCoins } from '@/components/wallet/EcosystemCoinCard';

const fmtCoins = (value: string | number) =>
  formatSignalFaceCoins(usdToSignalFaceCoins(value));

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
  const [commissions, setCommissions] = useState<ReferralCommissions | null>(null);
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
    Promise.allSettled([rewardsApi.list(), rewardsApi.referrals(), rewardsApi.commissions()])
      .then(([r, ref, com]) => {
        if (cancelled) return;
        if (r.status === 'fulfilled') setRewards(r.value.items);
        if (ref.status === 'fulfilled') setReferrals(ref.value);
        if (com.status === 'fulfilled') setCommissions(com.value);
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
        message: `Claimed ${fmtCoins(res.amount)}!`,
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

  const handleClaimCommission = async (commission: ReferralCommission) => {
    setClaiming(commission.id);
    try {
      const res = await rewardsApi.claimCommission(commission.id);
      updateUser({ pointsBalance: res.balance });
      addToast({
        message: `Added ${fmtCoins(res.amount)} to your wallet!`,
        type: 'success',
        duration: 4000,
      });
      load();
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not add that commission to your wallet.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setClaiming(null);
    }
  };

  const inviteLink = referrals ? buildInviteLink(referrals.referralCode) : '';
  const commissionPct = commissions ? `${Number(commissions.rate) * 100}%` : '5%';
  const readyCommissions = commissions?.items.filter((c) => c.status === 'READY').length ?? 0;

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rewards</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Claim bonuses and earn for every friend who joins.
          </p>
        </div>
        <a
          href="#invite-friends"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white brand-gradient hover:brightness-110 transition"
        >
          <UsersIcon size={15} />
          Invite Friends
        </a>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard
          icon={<Wallet size={16} />}
          label="Earned from referrals"
          value={loading ? '—' : fmtCoins(referrals?.totalEarned ?? 0)}
        />
        <StatCard
          icon={<UsersIcon size={16} />}
          label="Friends joined"
          value={loading ? '—' : String(verifiedReferrals)}
        />
        <StatCard
          icon={<Gift size={16} />}
          label="Ready to claim"
          value={loading ? '—' : String(rewards.filter((r) => r.claimable).length + readyCommissions)}
        />
      </div>

      {/* Invite */}
      <section id="invite-friends" aria-labelledby="invite-friends-title" className="glass-card rounded-2xl p-6 scroll-mt-20">
        <h2 id="invite-friends-title" className="font-bold text-foreground">Invite friends</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {referrals?.referralCoinReward
            ? `You earn ${formatEcosystemCoins(referrals.referralCoinReward)} when a friend you invite verifies their account, plus ${commissionPct} of their first Signal purchase.`
            : `You earn ${commissionPct} of the first Signal purchase by each friend who joins with your link.`}
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
                  <span className="w-8 h-8 rounded-full overflow-hidden bg-black dark:bg-white flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    <UserAvatar src={person.avatarUrl} name={person.displayName} fill ring={false} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-foreground truncate">
                      {person.displayName}
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">
                      @{person.username}
                    </span>
                  </span>
                  {/* "Earned" only when this person really earned you something:
                      a commission, Ecosystem Coins, or an old paid bonus.
                      Otherwise "Joined", or "Pending" until verified. */}
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                      person.commission || person.coins || person.bonusPaid
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : person.verified
                          ? 'bg-primary/15 text-primary'
                          : 'bg-white/10 text-muted-foreground'
                    }`}
                  >
                    {person.commission
                      ? `Earned ${fmtCoins(person.commission.amount)}`
                      : person.coins
                        ? `Earned ${formatEcosystemCoins(person.coins)}`
                        : person.bonusPaid
                        ? 'Earned'
                        : person.verified
                          ? 'Joined'
                          : 'Pending'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Referral commissions */}
      <section aria-labelledby="referral-earnings-title">
        <h2 id="referral-earnings-title" className="font-bold text-foreground mb-3">
          Referral earnings
        </h2>

        {commissions && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            <StatCard icon={<Clock size={16} />} label="Pending" value={fmtCoins(commissions.totals.pending)} />
            <StatCard icon={<Gift size={16} />} label="Ready to claim" value={fmtCoins(commissions.totals.ready)} />
            <StatCard icon={<Wallet size={16} />} label="Added to wallet" value={fmtCoins(commissions.totals.claimed)} />
          </div>
        )}

        {loading ? (
          <div className="glass-card rounded-2xl p-5 h-20 animate-pulse" />
        ) : !commissions || commissions.items.length === 0 ? (
          <div className="glass-card rounded-2xl p-6 text-center">
            <UsersIcon size={24} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold text-card-foreground">No referral earnings yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              When someone you invite buys their first Signal, you earn {commissionPct} of it. It shows
              here as Pending for {commissions?.holdHours ?? 24} hours, then you can add it to your wallet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {commissions.items.map((c) => (
              <div
                key={c.id}
                className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <span className="w-11 h-11 rounded-full overflow-hidden bg-black dark:bg-white flex-shrink-0">
                  <UserAvatar src={c.referredUser.avatarUrl} name={c.referredUser.displayName} fill ring={false} />
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {c.referredUser.displayName}&rsquo;s first Signal purchase
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-primary">+{fmtCoins(c.amount)}</span>
                    <span>·</span>
                    <span>
                      {Number(c.rate) * 100}% of {fmtCoins(c.purchaseAmount)}
                    </span>
                  </p>
                </div>

                {c.status === 'READY' ? (
                  <button
                    onClick={() => handleClaimCommission(c)}
                    disabled={claiming === c.id}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 flex-shrink-0 brand-gradient text-white hover:brightness-110 disabled:opacity-60"
                  >
                    {claiming === c.id && <Loader2 size={14} className="animate-spin" />}
                    Add to wallet
                  </button>
                ) : (
                  <span
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 flex-shrink-0 glass-chip ${
                      c.status === 'CLAIMED' ? 'text-emerald-300' : 'text-muted-foreground'
                    }`}
                  >
                    {c.status === 'CLAIMED' ? (
                      <>
                        <Check size={14} strokeWidth={3} /> In wallet
                      </>
                    ) : (
                      <>
                        <Clock size={14} /> Pending · ready {untilReady(c.availableAt)}
                      </>
                    )}
                  </span>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground px-1">
              Withdrawing referral earnings as cash is coming soon.
            </p>
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
                    <span className="font-semibold text-primary">+{fmtCoins(reward.amount)}</span>
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
