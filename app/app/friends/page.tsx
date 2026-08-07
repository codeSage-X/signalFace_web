'use client';

import { mockFriends, mockFollowers } from '@/lib/mock';
import { useState } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useToast } from '@/hooks/useToast';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faUserCheck } from '@fortawesome/free-solid-svg-icons';

export default function FriendsPage() {
  const [friends, setFriends] = useState(mockFriends);
  const [followers, setFollowers] = useState(mockFollowers);
  const [tab, setTab] = useState<'friends' | 'followers'>('friends');
  const { requireAuth } = useRequireAuth();
  const { showToast } = useToast();

  const handleToggleFollow = (id: string, isFollowing: boolean) => {
    requireAuth(() => {
      setFriends(friends.map(f => 
        f.id === id ? { ...f, isFollowing: !isFollowing } : f
      ));
      showToast(isFollowing ? 'Unfollowed' : 'Following', 'success');
    });
  };

  const handleAddFriend = (id: string) => {
    requireAuth(() => {
      setFollowers(followers.map(f => 
        f.id === id ? { ...f, isFriend: true } : f
      ));
      showToast('Friend request sent', 'success');
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold text-foreground mb-6">Friends & Following</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-border">
        <button
          onClick={() => setTab('friends')}
          className={`px-4 py-3 font-medium transition ${
            tab === 'friends'
              ? 'text-primary border-b-2 border-primary -mb-1'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setTab('followers')}
          className={`px-4 py-3 font-medium transition ${
            tab === 'followers'
              ? 'text-primary border-b-2 border-primary -mb-1'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Followers ({followers.length})
        </button>
      </div>

      {/* Friends List */}
      {tab === 'friends' && (
        <div className="space-y-3">
          {friends.map((friend) => (
            <div
              key={friend.id}
              className="glass-card rounded-2xl p-4 flex items-center justify-between glass-hover"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="text-3xl">{friend.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground">{friend.name}</p>
                  <p className="text-sm text-muted-foreground">{friend.username}</p>
                  <p className="text-xs text-muted-foreground">{friend.followers.toLocaleString()} followers</p>
                </div>
              </div>
              <button
                onClick={() => handleToggleFollow(friend.id, friend.isFollowing)}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                  friend.isFollowing
                    ? 'bg-primary/20 text-primary hover:bg-primary/30'
                    : 'glass-chip text-foreground hover:brightness-125'
                }`}
              >
                <FontAwesomeIcon
                  icon={friend.isFollowing ? faUserCheck : faUserPlus}
                  className="h-4 w-4"
                />
                {friend.isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Followers List */}
      {tab === 'followers' && (
        <div className="space-y-3">
          {followers.map((follower) => (
            <div
              key={follower.id}
              className="glass-card rounded-2xl p-4 flex items-center justify-between glass-hover"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="text-3xl">{follower.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground">{follower.name}</p>
                  <p className="text-sm text-muted-foreground">{follower.username}</p>
                  <p className="text-xs text-muted-foreground">{follower.followers.toLocaleString()} followers</p>
                </div>
              </div>
              <button
                onClick={() => handleAddFriend(follower.id)}
                className="px-4 py-2 rounded-lg brand-gradient text-primary-foreground font-medium hover:brightness-110 transition flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faUserPlus} className="h-4 w-4" />
                Add Friend
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
