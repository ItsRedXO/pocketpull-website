import React from 'react';
import { motion } from 'framer-motion';
import { Check, AlertCircle, Upload, LogOut, PackageOpen } from 'lucide-react';

interface EditProfileTabProps {
  profileMsg: { type: 'success' | 'error'; text: string } | null;
  displayName: string;
  setDisplayName: (val: string) => void;
  inputClass: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleAvatarFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingAvatar: boolean;
  avatarPreview: string;
  setAvatarPreview: (val: string) => void;
  initial: string;
  avatarError: string;
  userEmail?: string;
  handleSaveProfile: () => void;
  savingProfile: boolean;
  signOut: () => void;
  onBack: () => void;
}

export const EditProfileTab: React.FC<EditProfileTabProps> = ({
  profileMsg,
  displayName,
  setDisplayName,
  inputClass,
  fileInputRef,
  handleAvatarFileChange,
  uploadingAvatar,
  avatarPreview,
  setAvatarPreview,
  initial,
  avatarError,
  userEmail,
  handleSaveProfile,
  savingProfile,
  signOut,
  onBack,
}) => {
  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-2xl p-6 space-y-5"
      style={{
        background: 'rgba(13,14,20,0.9)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <h2 className="font-display text-lg uppercase tracking-wider text-white">Edit Profile</h2>

      {profileMsg && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            profileMsg.type === 'success'
              ? 'text-green-400 bg-green-500/10 border border-green-500/20'
              : 'text-red-400 bg-red-500/10 border border-red-500/20'
          }`}
        >
          {profileMsg.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {profileMsg.text}
        </div>
      )}

      {/* Display Name */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
          Display Name / Username
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your trainer name"
          className={inputClass}
        />
      </div>

      {/* Avatar Upload */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
          Profile Avatar
        </label>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif"
          onChange={handleAvatarFileChange}
          className="hidden"
        />

        <div className="flex items-center gap-4">
          {/* Avatar preview */}
          <div
            className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '2px solid rgba(155,92,255,0.2)',
            }}
          >
            {uploadingAvatar ? (
              <div className="w-6 h-6 rounded-full border-2 border-[#9b5cff]/30 border-t-[#9b5cff] animate-spin" />
            ) : avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="w-full h-full object-cover"
                onError={() => setAvatarPreview('')}
              />
            ) : (
              <span
                className="text-2xl font-display"
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

          {/* Upload button */}
          <div className="flex-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-60 w-full justify-center"
              style={{
                background: 'rgba(155,92,255,0.1)',
                border: '1px solid rgba(155,92,255,0.3)',
                color: '#9b5cff',
              }}
            >
              <Upload size={14} />
              {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
            </button>
            <p className="text-xs text-gray-500 mt-1.5">JPG, JPEG, PNG or GIF · Max 5MB</p>
          </div>
        </div>

        {/* Error */}
        {avatarError && (
          <div className="flex items-center gap-2 mt-2 text-red-400 text-xs">
            <AlertCircle size={12} />
            {avatarError}
          </div>
        )}
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
          Email Address
        </label>
        <input
          type="email"
          value={userEmail || ''}
          disabled
          className={`${inputClass} opacity-40 cursor-not-allowed`}
        />
        <p className="text-xs text-gray-500 mt-1">Email address cannot be changed</p>
      </div>

      <button
        onClick={handleSaveProfile}
        disabled={savingProfile}
        className="w-full py-3 rounded-xl font-display text-sm uppercase tracking-wider font-bold transition-all active:scale-95 disabled:opacity-60"
        style={{
          background: 'linear-gradient(135deg, #00c8ff, #0099cc)',
          color: '#000',
          boxShadow: '0 0 20px -5px rgba(0,200,255,0.4)',
        }}
      >
        {savingProfile ? 'Saving...' : 'Save Changes'}
      </button>

      <div className="pt-2">
        <button
          onClick={() => {
            signOut();
            onBack();
          }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-95"
          style={{
            background: 'rgba(248,113,113,0.07)',
            border: '1px solid rgba(248,113,113,0.2)',
            color: '#f87171',
          }}
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </motion.div>
  );
};