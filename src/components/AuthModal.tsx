import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, Mail, Lock, User, User2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'login' }) => {
  const [tab, setTab] = useState<'login' | 'signup' | 'forgot'>(defaultTab);

  // Sync tab when defaultTab prop changes (e.g. Login vs Sign Up button clicked)
  React.useEffect(() => {
    if (isOpen) setTab(defaultTab);
  }, [defaultTab, isOpen]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  const { signIn, signUp, sendPasswordReset } = useAuth();

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setUsername('');
    setReferralCode('');
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setAgreeTerms(false);
  };

  const switchTab = (newTab: 'login' | 'signup' | 'forgot') => {
    resetForm();
    setTab(newTab);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await signIn(email, password);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'BANNED_ACCOUNT' || message.includes('BANNED_ACCOUNT')) {
        setError('Your account has been banned. Please contact support.');
      } else if (message.includes('rate') || message.includes('RATE_LIMITED')) {
        setError('Too many attempts. Please try again later.');
      } else {
        setError('Invalid email/username or password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !username || !confirmPassword) { setError('Please fill in all fields'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (username.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { setError('Username can only contain letters, numbers, and underscores'); return; }
    if (!agreeTerms) { setError('You must agree to the Terms of Service'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await signUp(email, password, username, referralCode);
      setSuccess('Account created! Welcome to PocketPull — you can now log in.');
      setTimeout(() => { switchTab('login'); onClose(); }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'EMAIL_BANNED' || message.includes('EMAIL_BANNED')) {
        setError('This email address has been banned and cannot be used to create a new account.');
      } else if (message.includes('USERNAME_TAKEN')) {
        setError('That username is already taken. Please choose a different one.');
      } else if (message.includes('EMAIL_ALREADY_EXISTS') || message.includes('already')) {
        setError('An account with this email already exists. Try logging in.');
      } else {
        setError(message || 'Sign up failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setError('Please enter your email'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await sendPasswordReset(email);
      setSuccess('Password reset email sent! Check your inbox.');
    } catch {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl px-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md"
          style={{
            background: 'rgba(13, 14, 20, 0.98)',
            border: '1px solid rgba(0,200,255,0.15)',
            borderRadius: '20px',
            boxShadow: '0 0 60px -10px rgba(0,200,255,0.2), 0 40px 80px rgba(0,0,0,0.8)',
          }}
        >
          {/* Glow top border */}
          <div
            className="absolute top-0 left-0 right-0 h-[1px] rounded-t-[20px]"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,200,255,0.5), rgba(155,92,255,0.5), transparent)' }}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={16} />
          </button>

          <div className="p-8">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <img
                src="/pocketpull-logo.png"
                alt="PocketPull"
                style={{
                  width: 40,
                  height: 40,
                  objectFit: 'contain',
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span
                className="font-display text-2xl bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #00c8ff, #9b5cff)' }}
              >
                POCKETPULL
              </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1">
              <button
                onClick={() => switchTab('login')}
                className="flex-1 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all"
                style={tab === 'login' ? { background: '#00c8ff', color: '#000' } : { color: '#9ca3af' }}
              >
                Login
              </button>
              <button
                onClick={() => switchTab('signup')}
                className="flex-1 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all"
                style={tab === 'signup' ? { background: '#9b5cff', color: '#fff' } : { color: '#9ca3af' }}
              >
                Sign Up
              </button>
            </div>

            {/* Error / Success messages */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 mb-4 p-3 rounded-lg text-red-400 text-sm"
                  style={{ background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.2)' }}
                >
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 mb-4 p-3 rounded-lg text-green-400 text-sm"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <CheckCircle size={14} className="shrink-0" />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login Form */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email or Username</label>
                  <div className="relative">
                    <User2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="trainer@example.com or CoolTrainer99"
                      autoComplete="username"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => switchTab('forgot')}
                  className="text-xs text-right w-full transition-colors"
                  style={{ color: 'rgba(0,200,255,0.6)' }}
                >
                  Forgot password?
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl font-display text-sm uppercase tracking-wider font-bold transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #00c8ff, #0099cc)', boxShadow: '0 0 20px -5px rgba(0,200,255,0.5)', color: '#000' }}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </button>
                <p className="text-center text-xs text-gray-500">
                  No account?{' '}
                  <button
                    type="button"
                    onClick={() => switchTab('signup')}
                    className="font-bold"
                    style={{ color: '#9b5cff' }}
                  >
                    Create one
                  </button>
                </p>
              </form>
            )}

            {/* Sign Up Form */}
            {tab === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Username</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="CoolTrainer99"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="trainer@example.com"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Referral Code (Optional)</label>
                  <div className="relative">
                    <User2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={referralCode}
                      onChange={e => setReferralCode(e.target.value)}
                      placeholder="CODE123"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 accent-purple-500"
                  />
                  <span className="text-xs text-gray-400">
                    I agree to the{' '}
                    <span style={{ color: '#9b5cff' }}>Terms of Service</span>
                    {' '}and{' '}
                    <span style={{ color: '#9b5cff' }}>Privacy Policy</span>.
                    {' '}Must be 18+.
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl font-display text-sm uppercase tracking-wider font-bold transition-all active:scale-95 disabled:opacity-60 text-white"
                  style={{ background: 'linear-gradient(135deg, #9b5cff, #7b3cdf)', boxShadow: '0 0 20px -5px rgba(155,92,255,0.5)' }}
                >
                  {isSubmitting ? 'Creating account...' : 'Create Account'}
                </button>
                <p className="text-center text-xs text-gray-500">
                  Have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchTab('login')}
                    className="font-bold"
                    style={{ color: '#00c8ff' }}
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {/* Forgot Password Form */}
            {tab === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-sm text-gray-400 text-center mb-2">
                  Enter your email and we'll send you a password reset link.
                </p>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="trainer@example.com"
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl font-display text-sm uppercase tracking-wider font-bold transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #00c8ff, #0099cc)', boxShadow: '0 0 20px -5px rgba(0,200,255,0.5)', color: '#000' }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Reset Email'}
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ← Back to login
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
