import React from 'react';
import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';

interface ProfileHeaderProps {
  displayNameValue: string;
  email?: string;
  avatarPreview: string;
  onAvatarClick: () => void;
  uploadingAvatar: boolean;
  setAvatarPreview: (url: string) => void;
  initial: string;
  balance: number;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  displayNameValue,
  email,
  avatarPreview,
  onAvatarClick,
  uploadingAvatar,
  setAvatarPreview,
  initial,
  balance,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden mb-6 p-6"
      style={{
        background: 'rgba(13,14,20,0.9)',
        border: '1px solid rgba(155,92,255,0.15)',
        boxShadow: '0 0 40px -15px rgba(155,92,255,0.2)',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(0,200,255,0.5), rgba(155,92,255,0.7), transparent)',
        }}
      />

      <div className="flex items-start gap-5">
        {/* Avatar */}
        <div className="shrink-0 relative group">
          <div
            className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(0,200,255,0.15), rgba(155,92,255,0.15))',
              border: '2px solid rgba(155,92,255,0.25)',
            }}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={() => setAvatarPreview('')}
              />
            ) : (
              <span
                className="text-3xl font-display"
                style={{
                  background: 'linear-gradient(135deg, #00c8ff, #9b5cff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {initial}
              </span>
            )}
          </div>
          {/* Camera overlay on hover */}
          <button
            onClick={onAvatarClick}
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            title="Change avatar"
          >
            <Camera size={18} className="text-white" />
          </button>
          {uploadingAvatar && (
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.7)' }}
            >
              <div className="w-5 h-5 rounded-full border-2 border-[#00c8ff]/30 border-t-[#00c8ff] animate-spin" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl text-white">{displayNameValue}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{email}</p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-green-400 text-sm font-bold">${balance.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
