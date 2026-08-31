import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, Shield } from 'lucide-react';

interface Props {
  onLogin: (usernameOrEmail: string, password: string) => Promise<boolean>;
  error: string | null;
}

export const AdminLogin: React.FC<Props> = ({ onLogin, error }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) return;
    setLoading(true);
    await onLogin(identifier.trim(), password);
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(155,92,255,0.10) 0%, #07080e 60%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(155,92,255,0.2), rgba(0,200,255,0.1))',
              border: '1.5px solid rgba(155,92,255,0.35)',
              boxShadow: '0 0 32px -8px rgba(155,92,255,0.5)',
            }}
          >
            <Shield size={28} className="text-[#9b5cff]" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white tracking-wide uppercase">Admin Portal</h1>
          <p className="text-[12px] text-white/30 mt-1 uppercase tracking-[0.2em]">PocketPull TCG — Restricted Access</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            {/* Username or Email */}
            <div className="relative flex items-center border-b border-white/5">
              <User size={15} className="absolute left-4 text-white/25 shrink-0" />
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Username or Email"
                autoComplete="username"
                className="w-full bg-transparent pl-11 pr-4 py-4 text-sm text-white placeholder-white/20 outline-none"
              />
            </div>

            {/* Password */}
            <div className="relative flex items-center">
              <Lock size={15} className="absolute left-4 text-white/25 shrink-0" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="w-full bg-transparent pl-11 pr-11 py-4 text-sm text-white placeholder-white/20 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 text-white/25 hover:text-white/50 transition-colors"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-3 rounded-xl text-[12px] text-red-400 text-center"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              {error}
            </motion.div>
          )}

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading || !identifier.trim() || !password.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 rounded-xl font-display text-[13px] uppercase tracking-widest font-bold disabled:opacity-50 transition-all"
            style={{
              background: 'linear-gradient(135deg, #9b5cff, #00c8ff)',
              color: '#fff',
              boxShadow: '0 0 28px -6px rgba(155,92,255,0.6)',
            }}
          >
            {loading ? 'Authenticating...' : 'Enter Admin Panel'}
          </motion.button>
        </form>

        <p className="text-center text-[11px] text-white/15 mt-6">
          🔒 Secure admin access only
        </p>
      </motion.div>
    </div>
  );
};
