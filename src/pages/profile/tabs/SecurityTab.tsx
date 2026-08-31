import React from 'react';
import { motion } from 'framer-motion';
import { Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface SecurityTabProps {
  passwordMsg: { type: 'success' | 'error'; text: string } | null;
  handleChangePassword: (e: React.FormEvent) => void;
  showCurrentPw: boolean;
  setShowCurrentPw: (val: boolean) => void;
  currentPassword: string;
  setCurrentPassword: (val: string) => void;
  showNewPw: boolean;
  setShowNewPw: (val: boolean) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmNewPassword: string;
  setConfirmNewPassword: (val: string) => void;
  inputClass: string;
  savingPassword: boolean;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({
  passwordMsg,
  handleChangePassword,
  showCurrentPw,
  setShowCurrentPw,
  currentPassword,
  setCurrentPassword,
  showNewPw,
  setShowNewPw,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  inputClass,
  savingPassword,
}) => {
  return (
    <motion.div
      key="security"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-2xl p-6 space-y-5"
      style={{
        background: 'rgba(13,14,20,0.9)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <h2 className="font-display text-lg uppercase tracking-wider text-white">Change Password</h2>

      {passwordMsg && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            passwordMsg.type === 'success'
              ? 'text-green-400 bg-green-500/10 border border-green-500/20'
              : 'text-red-400 bg-red-500/10 border border-red-500/20'
          }`}
        >
          {passwordMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {passwordMsg.text}
        </div>
      )}

      <form onSubmit={handleChangePassword} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrentPw ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPw(!showCurrentPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNewPw ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowNewPw(!showNewPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={savingPassword}
          className="w-full py-3 rounded-xl font-display text-sm uppercase tracking-wider font-bold transition-all active:scale-95 disabled:opacity-60 text-white"
          style={{
            background: 'linear-gradient(135deg, #9b5cff, #7b3cdf)',
            boxShadow: '0 0 20px -5px rgba(155,92,255,0.4)',
          }}
        >
          {savingPassword ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </motion.div>
  );
};
