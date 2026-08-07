'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, X } from 'lucide-react';
import { useAuth, useToast } from '@/lib/stores';
import {
  loginSchema,
  signupSchema,
  otpSchema,
  forgotPasswordSchema,
  newPasswordSchema,
  type SignupInput,
  type LoginInput,
  type OtpInput as OtpFormInput,
  type ForgotPasswordInput,
  type NewPasswordInput,
} from '@/lib/schemas';
import { authApi, ApiError } from '@/lib/api';
import { signInWithGoogle, isUserCancelledAuth, isFirebaseConfigured } from '@/lib/firebase';
import {
  EmailInput,
  PasswordInput,
  TextInput,
  DateInput,
  SelectInput,
  OtpInput,
} from './FormInputs';
import { BrandMark } from '@/components/BrandMark';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const RESEND_COOLDOWN_SECONDS = 600;

function formatCooldown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type View =
  | 'login'
  | 'signup'
  | 'verify-otp'
  | 'forgot-password'
  | 'verify-reset-otp'
  | 'reset-password';

export const AuthGateModal = () => {
  const { authModalOpen, setAuthModalOpen, login, pendingVerificationEmail, setPendingVerificationEmail } =
    useAuth();
  const { addToast } = useToast();
  const [view, setView] = useState<View>(pendingVerificationEmail ? 'verify-otp' : 'login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      username: '',
      dateOfBirth: '',
      gender: '' as SignupInput['gender'],
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const otpForm = useForm<OtpFormInput>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const forgotPasswordForm = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const resetOtpForm = useForm<OtpFormInput>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const newPasswordForm = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const isLoading =
    view === 'signup'
      ? signupForm.formState.isSubmitting
      : view === 'login'
        ? loginForm.formState.isSubmitting
        : view === 'verify-otp'
          ? otpForm.formState.isSubmitting
          : view === 'forgot-password'
            ? forgotPasswordForm.formState.isSubmitting
            : view === 'verify-reset-otp'
              ? resetOtpForm.formState.isSubmitting
              : newPasswordForm.formState.isSubmitting;

  const handleLogin = async (data: LoginInput) => {
    try {
      const res = await authApi.login(data);
      login(res.user, res.accessToken);
      setAuthModalOpen(false);
      addToast({
        message: `Welcome back, ${res.user.firstName}!`,
        type: 'success',
        duration: 4000,
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setPendingVerificationEmail(data.email);
        otpForm.reset();
        setView('verify-otp');
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        authApi.resendOtp({ email: data.email }).catch(() => {});
        addToast({
          message: 'Please verify your email to continue. We sent you a new code.',
          type: 'info',
          duration: 5000,
        });
        return;
      }
      addToast({
        message: err instanceof Error ? err.message : 'Login failed. Please try again.',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const res = await authApi.google({ idToken });
      login(res.user, res.accessToken);
      setAuthModalOpen(false);
      addToast({
        message: res.isNewUser
          ? `Welcome to Signal Face, ${res.user.firstName}!`
          : `Welcome back, ${res.user.firstName}!`,
        type: 'success',
        duration: 4000,
      });
    } catch (err) {
      if (isUserCancelledAuth(err)) return;
      addToast({
        message: err instanceof Error ? err.message : 'Google sign-in failed. Please try again.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = async (data: SignupInput) => {
    try {
      const { confirmPassword: _, ...payload } = data;
      const res = await authApi.register(payload);
      setPendingVerificationEmail(res.email);
      otpForm.reset();
      setView('verify-otp');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      addToast({ message: res.message, type: 'success', duration: 5000 });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Registration failed. Please try again.',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const handleVerifyOtp = async (data: OtpFormInput) => {
    if (!pendingVerificationEmail) return;
    try {
      const res = await authApi.verifyEmail({ email: pendingVerificationEmail, otp: data.otp });
      login(res.user, res.accessToken);
      setAuthModalOpen(false);
      addToast({
        message: `Welcome, ${res.user.firstName}! Your email is verified.`,
        type: 'success',
        duration: 5000,
      });
    } catch (err) {
      otpForm.setError('otp', {
        message: err instanceof Error ? err.message : 'Invalid or expired code',
      });
    }
  };

  const handleResendOtp = async () => {
    if (!pendingVerificationEmail || resending || resendCooldown > 0) return;
    setResending(true);
    try {
      await authApi.resendOtp({ email: pendingVerificationEmail });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      addToast({ message: 'A new code has been sent to your email.', type: 'success', duration: 4000 });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not resend code.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setResending(false);
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordInput) => {
    try {
      const res = await authApi.forgotPassword(data);
      setResetEmail(data.email);
      resetOtpForm.reset();
      setView('verify-reset-otp');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      addToast({ message: res.message, type: 'success', duration: 5000 });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const handleVerifyResetOtp = async (data: OtpFormInput) => {
    try {
      await authApi.verifyResetOtp({ email: resetEmail, otp: data.otp });
      setResetOtp(data.otp);
      newPasswordForm.reset();
      setView('reset-password');
    } catch (err) {
      resetOtpForm.setError('otp', {
        message: err instanceof Error ? err.message : 'Invalid or expired code',
      });
    }
  };

  const handleResendResetOtp = async () => {
    if (!resetEmail || resending || resendCooldown > 0) return;
    setResending(true);
    try {
      await authApi.forgotPassword({ email: resetEmail });
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      addToast({ message: 'A new code has been sent to your email.', type: 'success', duration: 4000 });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not resend code.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setResending(false);
    }
  };

  const handleResetPassword = async (data: NewPasswordInput) => {
    try {
      const res = await authApi.resetPassword({
        email: resetEmail,
        otp: resetOtp,
        password: data.password,
      });
      login(res.user, res.accessToken);
      setAuthModalOpen(false);
      addToast({ message: 'Password reset! You are now signed in.', type: 'success', duration: 5000 });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not reset password.',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const switchMode = () => {
    setView(view === 'signup' ? 'login' : 'signup');
    loginForm.reset();
    signupForm.reset();
  };

  const backToLogin = () => {
    setPendingVerificationEmail(null);
    setView('login');
  };

  if (!authModalOpen) return null;

  const title =
    view === 'signup'
      ? 'Create Account'
      : view === 'verify-otp'
        ? 'Verify Your Email'
        : view === 'forgot-password'
          ? 'Forgot Password'
          : view === 'verify-reset-otp'
            ? 'Verify Code'
            : view === 'reset-password'
              ? 'Reset Password'
              : 'Welcome Back';

  const subtitle =
    view === 'signup'
      ? 'Join the future of influence'
      : view === 'verify-otp'
        ? `Enter the 6-digit code we sent to ${pendingVerificationEmail ?? 'your email'}`
        : view === 'forgot-password'
          ? "Enter your account's email and we'll send you a reset code"
          : view === 'verify-reset-otp'
            ? `Enter the 6-digit code we sent to ${resetEmail}`
            : view === 'reset-password'
              ? 'Choose a new password for your account'
              : 'Sign in to access your signals';

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl w-full max-w-md shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-0 flex-shrink-0">
          <button
            onClick={() => setAuthModalOpen(false)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <BrandMark />
            <h1 className="text-xl font-bold text-foreground">Signal Face</h1>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">{title}</h2>
          <p className="text-muted-foreground text-sm mb-5">{subtitle}</p>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {(view === 'login' || view === 'signup') && isFirebaseConfigured && (
            <div className="mt-2">
              <GoogleButton
                label={view === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
                isLoading={googleLoading}
                disabled={isLoading}
                onClick={handleGoogle}
              />

              <div className="flex items-center gap-3 my-4">
                <span className="h-px flex-1 bg-border" />
                <span className="text-muted-foreground text-xs uppercase tracking-wide">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          {view === 'signup' && (
            <form onSubmit={signupForm.handleSubmit(handleRegister)} className="space-y-3 mt-2">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  value={signupForm.watch('firstName')}
                  onChange={(v) => signupForm.setValue('firstName', v)}
                  placeholder="First name"
                  error={signupForm.formState.errors.firstName?.message}
                />
                <TextInput
                  value={signupForm.watch('lastName')}
                  onChange={(v) => signupForm.setValue('lastName', v)}
                  placeholder="Last name"
                  error={signupForm.formState.errors.lastName?.message}
                />
              </div>

              <TextInput
                value={signupForm.watch('username')}
                onChange={(v) => signupForm.setValue('username', v)}
                placeholder="Username (e.g. kingjay)"
                error={signupForm.formState.errors.username?.message}
              />

              {/* DOB + Gender row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date of birth</label>
                  <DateInput
                    value={signupForm.watch('dateOfBirth')}
                    onChange={(v) => signupForm.setValue('dateOfBirth', v)}
                    error={signupForm.formState.errors.dateOfBirth?.message}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Gender</label>
                  <SelectInput
                    value={signupForm.watch('gender')}
                    onChange={(v) =>
                      signupForm.setValue('gender', v as SignupInput['gender'])
                    }
                    options={GENDER_OPTIONS}
                    placeholder="Select"
                    error={signupForm.formState.errors.gender?.message}
                  />
                </div>
              </div>

              <EmailInput
                value={signupForm.watch('email')}
                onChange={(v) => signupForm.setValue('email', v)}
                error={signupForm.formState.errors.email?.message}
              />

              <PasswordInput
                value={signupForm.watch('password')}
                onChange={(v) => signupForm.setValue('password', v)}
                showStrength
                error={signupForm.formState.errors.password?.message}
              />

              <PasswordInput
                value={signupForm.watch('confirmPassword')}
                onChange={(v) => signupForm.setValue('confirmPassword', v)}
                placeholder="Confirm password"
                error={signupForm.formState.errors.confirmPassword?.message}
              />

              <SubmitButton isLoading={isLoading} label="Create Account" />
            </form>
          )}

          {view === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-3 mt-2">
              <EmailInput
                value={loginForm.watch('email')}
                onChange={(v) => loginForm.setValue('email', v)}
                error={loginForm.formState.errors.email?.message}
              />

              <PasswordInput
                value={loginForm.watch('password')}
                onChange={(v) => loginForm.setValue('password', v)}
                error={loginForm.formState.errors.password?.message}
              />

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    forgotPasswordForm.reset();
                    setView('forgot-password');
                  }}
                  className="text-primary text-xs font-semibold hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <SubmitButton isLoading={isLoading} label="Sign In" />
            </form>
          )}

          {view === 'verify-otp' && (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-5 mt-2">
              <OtpInput
                value={otpForm.watch('otp')}
                onChange={(v) => otpForm.setValue('otp', v)}
                error={otpForm.formState.errors.otp?.message}
              />

              <SubmitButton isLoading={isLoading} label="Verify Email" />

              <div className="text-center space-y-2">
                <p className="text-muted-foreground text-sm">
                  Didn&apos;t get a code?{' '}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending || resendCooldown > 0}
                    className="text-primary font-semibold hover:underline disabled:opacity-60 disabled:no-underline"
                  >
                    {resending
                      ? 'Sending…'
                      : resendCooldown > 0
                        ? `Resend code in ${formatCooldown(resendCooldown)}`
                        : 'Resend code'}
                  </button>
                </p>
                <button
                  type="button"
                  onClick={backToLogin}
                  className="text-muted-foreground text-xs hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {view === 'forgot-password' && (
            <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-3 mt-2">
              <EmailInput
                value={forgotPasswordForm.watch('email')}
                onChange={(v) => forgotPasswordForm.setValue('email', v)}
                error={forgotPasswordForm.formState.errors.email?.message}
              />

              <SubmitButton isLoading={isLoading} label="Send Reset Code" />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-muted-foreground text-xs hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {view === 'verify-reset-otp' && (
            <form onSubmit={resetOtpForm.handleSubmit(handleVerifyResetOtp)} className="space-y-5 mt-2">
              <OtpInput
                value={resetOtpForm.watch('otp')}
                onChange={(v) => resetOtpForm.setValue('otp', v)}
                error={resetOtpForm.formState.errors.otp?.message}
              />

              <SubmitButton isLoading={isLoading} label="Verify Code" />

              <div className="text-center space-y-2">
                <p className="text-muted-foreground text-sm">
                  Didn&apos;t get a code?{' '}
                  <button
                    type="button"
                    onClick={handleResendResetOtp}
                    disabled={resending || resendCooldown > 0}
                    className="text-primary font-semibold hover:underline disabled:opacity-60 disabled:no-underline"
                  >
                    {resending
                      ? 'Sending…'
                      : resendCooldown > 0
                        ? `Resend code in ${formatCooldown(resendCooldown)}`
                        : 'Resend code'}
                  </button>
                </p>
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-muted-foreground text-xs hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {view === 'reset-password' && (
            <form onSubmit={newPasswordForm.handleSubmit(handleResetPassword)} className="space-y-3 mt-2">
              <PasswordInput
                value={newPasswordForm.watch('password')}
                onChange={(v) => newPasswordForm.setValue('password', v)}
                placeholder="New password"
                showStrength
                error={newPasswordForm.formState.errors.password?.message}
              />

              <PasswordInput
                value={newPasswordForm.watch('confirmPassword')}
                onChange={(v) => newPasswordForm.setValue('confirmPassword', v)}
                placeholder="Confirm new password"
                error={newPasswordForm.formState.errors.confirmPassword?.message}
              />

              <SubmitButton isLoading={isLoading} label="Reset Password" />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="text-muted-foreground text-xs hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {(view === 'login' || view === 'signup') && (
            <div className="mt-5 text-center">
              <p className="text-muted-foreground text-sm">
                {view === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary font-semibold hover:underline"
                >
                  {view === 'signup' ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function GoogleButton({
  label,
  isLoading,
  disabled,
  onClick,
}: {
  label: string;
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading || disabled}
      className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-3
        bg-white text-[#1f1f1f] border border-border
        transition-all duration-200 hover:brightness-95
        disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:brightness-100"
    >
      {isLoading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Connecting…
        </>
      ) : (
        <>
          <GoogleIcon />
          {label}
        </>
      )}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function SubmitButton({ isLoading, label }: { isLoading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="w-full relative mt-2 py-3 rounded-xl font-semibold text-white transition-all duration-200
        brand-gradient
        shadow-[0_0_18px_4px_rgba(139,92,246,0.4)]
        hover:shadow-[0_0_26px_6px_rgba(139,92,246,0.55)]
        hover:brightness-110
        disabled:opacity-70 disabled:cursor-not-allowed disabled:brightness-100"
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          Please wait…
        </span>
      ) : (
        label
      )}
    </button>
  );
}
