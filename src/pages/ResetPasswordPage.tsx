import React, { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const ResetPasswordPage: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) { setError('Password reset is not available right now.'); return; }

    // Our own emailed link (see backend/routes/passwordReset.ts) carries a
    // `token_hash` we resolve directly via verifyOtp -- no dependency on
    // Supabase's hosted verify redirect or its Redirect URL allow-list.
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    if (tokenHash && params.get('type') === 'recovery') {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error: verifyError }) => {
        if (verifyError) setError('This reset link is invalid or has expired. Please request a new one.');
        else setReady(true);
      });
      return;
    }

    // Fallback for the old-style link (a Supabase-hosted redirect that lands
    // here with a session already in the URL hash) -- kept for any such
    // email still sitting unread in someone's inbox.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setSubmitting(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0b0f] px-4">
      <div
        className="relative w-full max-w-md p-8"
        style={{
          background: 'rgba(13, 14, 20, 0.98)',
          border: '1px solid rgba(0,200,255,0.15)',
          borderRadius: '20px',
          boxShadow: '0 0 60px -10px rgba(0,200,255,0.2), 0 40px 80px rgba(0,0,0,0.8)',
        }}
      >
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src="/pocketpull-logo.png" alt="PocketPull" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: '50%' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="font-display text-2xl bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #00c8ff, #9b5cff)' }}>
            POCKETPULL
          </span>
        </div>

        <h1 className="text-center text-white font-display text-lg uppercase tracking-wider mb-6">Reset Password</h1>

        {done ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle size={32} className="text-green-400" />
            <p className="text-sm text-gray-300">Your password has been updated. You can close this tab and log in with your new password.</p>
          </div>
        ) : !ready ? (
          <div className="flex flex-col items-center gap-3 text-center">
            {error ? (
              <>
                <AlertCircle size={32} className="text-red-400" />
                <p className="text-sm text-gray-300">{error}</p>
              </>
            ) : (
              <p className="text-sm text-gray-400">Verifying your reset link...</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-red-400 text-sm" style={{ background: 'rgba(255,50,50,0.1)', border: '1px solid rgba(255,50,50,0.2)' }}>
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">New Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl font-display text-sm uppercase tracking-wider font-bold transition-all active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #00c8ff, #0099cc)', boxShadow: '0 0 20px -5px rgba(0,200,255,0.5)', color: '#000' }}
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
