'use client';

import { useAuth, useToast } from '@/lib/stores';
import { useState } from 'react';
import { Bell, Lock, User, LogOut, Pencil, Check, X, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPalette, faCog, faSignOut } from '@fortawesome/free-solid-svg-icons';
import { usersApi, ApiError } from '@/lib/api';

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [emailInput, setEmailInput] = useState(user?.email ?? '');
  const [usernameInput, setUsernameInput] = useState(user?.username ?? '');
  const [displayNameInput, setDisplayNameInput] = useState(user?.displayName ?? '');

  const startEditingAccount = () => {
    setEmailInput(user?.email ?? '');
    setUsernameInput(user?.username ?? '');
    setDisplayNameInput(user?.displayName ?? '');
    setIsEditingAccount(true);
  };

  const handleSaveAccount = async () => {
    setSavingAccount(true);
    try {
      const profile = await usersApi.updateAccount({
        email: emailInput,
        username: usernameInput,
        displayName: displayNameInput,
      });
      updateUser(profile);
      setIsEditingAccount(false);
      addToast({ message: 'Account updated!', type: 'success', duration: 3000 });
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not update account.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setSavingAccount(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and preferences.
        </p>
      </div>

      {/* Account Section */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <User size={20} />
            Account Information
          </h2>
          {!isEditingAccount && (
            <button
              onClick={startEditingAccount}
              className="flex items-center gap-1.5 px-3 py-1.5 glass-chip text-foreground rounded-full text-xs font-medium hover:brightness-125 transition"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>

        {isEditingAccount ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Email Address</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full mt-1 px-3 py-2 glass-input rounded-xl text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Username</label>
              <input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full mt-1 px-3 py-2 glass-input rounded-xl text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Display Name</label>
              <input
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                className="w-full mt-1 px-3 py-2 glass-input rounded-xl text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Points Balance</label>
              <p className="text-foreground mt-1">{user?.pointsBalance ?? '0'} pts</p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleSaveAccount}
                disabled={savingAccount}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm
                  brand-gradient
                  hover:brightness-110 transition disabled:opacity-70"
              >
                {savingAccount ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {savingAccount ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() => setIsEditingAccount(false)}
                disabled={savingAccount}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm glass-chip text-foreground hover:brightness-125 transition"
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Email Address</label>
              <p className="text-foreground mt-1">{user?.email || 'Not logged in'}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Username</label>
              <p className="text-foreground mt-1">@{user?.username || 'anonymous'}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Display Name</label>
              <p className="text-foreground mt-1">{user?.displayName || '—'}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Points Balance</label>
              <p className="text-foreground mt-1">{user?.pointsBalance ?? '0'} pts</p>
            </div>
          </div>
        )}
      </div>

      {/* Appearance Settings */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
          <FontAwesomeIcon icon={faPalette} className="h-5 w-5" />
          Appearance
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-foreground font-medium">Theme</label>
            <p className="text-sm text-muted-foreground mt-1">Choose between light and dark mode</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Notification Settings */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
          <Bell size={20} />
          Notifications
        </h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={notifications}
              onChange={() => setNotifications(!notifications)}
              className="w-4 h-4 rounded border-border bg-input accent-primary"
            />
            <span className="text-foreground">Enable push notifications</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border bg-input accent-primary" />
            <span className="text-foreground">Email me about new signals</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-border bg-input accent-primary" />
            <span className="text-foreground">Notify me about price changes</span>
          </label>
        </div>
      </div>

      {/* Security Section */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
          <FontAwesomeIcon icon={faCog} className="h-5 w-5" />
          Security
        </h2>
        <button className="px-4 py-2 brand-gradient hover:brightness-110 text-primary-foreground rounded-lg font-semibold transition">
          Change Password
        </button>
      </div>

      {/* Danger Zone */}
      <div className="glass-danger rounded-2xl p-6">
        <h2 className="text-lg font-bold text-destructive mb-4">Danger Zone</h2>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to logout?')) {
              logout();
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-destructive hover:bg-destructive/90 text-white rounded-lg font-semibold transition"
        >
          <FontAwesomeIcon icon={faSignOut} className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
