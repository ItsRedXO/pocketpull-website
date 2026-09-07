import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Shield, History, PackageOpen, Users, Settings } from 'lucide-react';
import { blink } from '../lib/blink';
import { useAuth, useUserStats } from '../hooks/useAuth';
import { CashOutModal } from '../components/CashOutModal';

// Refactored components
import { ProfileHeader } from './profile/ProfileHeader';
import { ProfileTabs, ProfileTab } from './profile/ProfileTabs';
import { ProfileTabContent } from './profile/ProfileTabContent';

interface ProfilePageProps {
  onBack: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

export const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
  const { user, signOut, isAuthenticated } = useAuth();
  const { stats, updateProfile } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // History
  const [packHistory, setPackHistory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const [packPage, setPackPage] = useState(1);
  const [totalTx, setTotalTx] = useState(0);
  const [totalPacks, setTotalPacks] = useState(0);
  const PAGE_SIZE = 25;

  // Cash out modal
  const [cashOutOpen, setCashOutOpen] = useState(false);

  useEffect(() => {
    if (stats) {
      setDisplayName(stats.displayName || '');
      setAvatarPreview(stats.avatarUrl || '');
    }
  }, [stats]);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      // Get count for packs (direct pagination)
      const packCount = await blink.db.packsOpened.count({ where: { userId: user.id } });
      setTotalPacks(packCount);

      // Fetch data
      const [packs, txns, cashouts] = await Promise.all([
        blink.db.packsOpened.list({ 
          where: { userId: user.id }, 
          orderBy: { createdAt: 'desc' }, 
          limit: PAGE_SIZE,
          offset: (packPage - 1) * PAGE_SIZE
        }).catch(() => [] as any[]),
        
        blink.db.transactions.list({ 
          where: { userId: user.id }, 
          orderBy: { createdAt: 'desc' }, 
          limit: 1000 // Fetch all for lifetime merged pagination
        }).catch(() => [] as any[]),
        
        blink.db.cashoutRequests.list({ 
          where: { userId: user.id }, 
          orderBy: { createdAt: 'desc' },
          limit: 1000 // Fetch all for lifetime merged pagination
        }).catch(() => [] as any[]),
      ]);

      setPackHistory(Array.isArray(packs) ? packs : []);
      
      // For transactions/cashouts, since we merge them, we paginate in-memory 
      // from a larger pool (1000 records should cover "lifetime" for most users)
      
      // Filter transactions: only 'deposit' and 'sell'
      const filteredTxns = (Array.isArray(txns) ? txns : []).filter(t => 
        t.type === 'deposit' || t.type === 'sell'
      ).map(t => ({
        ...t,
        historyType: 'transaction'
      }));

      // Map cashouts to a similar structure
      const mappedCashouts = (Array.isArray(cashouts) ? cashouts : []).map(c => ({
        id: c.id,
        userId: c.userId,
        type: 'cashout',
        amount: c.totalValue,
        description: `Cash Out — ${c.totalCards} card(s)`,
        createdAt: c.createdAt,
        historyType: 'cashout',
        status: c.status,
        rawRequest: c // Ensure this is preserved
      }));
      
      // Merge and sort
      const combined = [...filteredTxns, ...mappedCashouts].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Update total count for combined list
      setTotalTx(combined.length);

      // Paginate the combined list
      const paginatedCombined = combined.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);

      setTransactions(paginatedCombined);
    } catch (err) {
      console.error('Fetch history failed:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.id, txPage, packPage]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, fetchHistory]);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');

    if (stats?.isBanned) {
      setAvatarError('Account banned. Avatar update disabled.');
      return;
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError('Only JPG, JPEG, PNG, or GIF files are allowed.');
      return;
    }
    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setAvatarError('File is too large. Maximum size is 5MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `avatars/${user!.id}_${Date.now()}.${ext}`;
      const { publicUrl } = await blink.storage.upload(file, path, {
        onProgress: () => {},
      });
      setAvatarPreview(publicUrl);
      // Auto-save to DB immediately so it's persistent
      await updateProfile({ avatarUrl: publicUrl });
      await blink.auth.updateMe({ displayName });
      setProfileMsg({ type: 'success', text: 'Avatar updated!' });
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (err: any) {
      setAvatarError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploadingAvatar(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    if (stats?.isBanned) {
      setProfileMsg({ type: 'error', text: 'Your account is banned. Profile updates are disabled.' });
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await updateProfile({ displayName, avatarUrl: avatarPreview });
      await blink.auth.updateMe({ displayName });
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setProfileMsg(null), 3000);
    } catch {
      setProfileMsg({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordMsg({ type: 'error', text: 'Please fill in all fields' }); return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' }); return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters' }); return;
    }
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      await blink.auth.changePassword(currentPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
      setTimeout(() => setPasswordMsg(null), 3000);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err?.message || 'Failed to change password. Check your current password.' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
            <User size={32} className="text-gray-500" />
          </div>
          <h2 className="text-2xl font-display text-white">Sign In Required</h2>
          <p className="text-gray-400 text-sm">Please log in to view your profile.</p>
          <button
            onClick={onBack}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/20 transition-all text-sm font-bold"
          >
            <ArrowLeft size={14} /> Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  const displayNameValue = stats?.displayName || 'Trainer';
  const initial = displayNameValue.charAt(0).toUpperCase();
  const balance = stats?.balance ?? 0;

  const inputClass = 'w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00c8ff]/50 transition-all';

  const tabs = [
    { id: 'profile' as ProfileTab, label: 'Profile', icon: User },
    { id: 'security' as ProfileTab, label: 'Security', icon: Shield },
    { id: 'history' as ProfileTab, label: 'History', icon: History },
    { id: 'referrals' as ProfileTab, label: 'Referrals', icon: Users },
    { id: 'settings' as ProfileTab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen py-8 px-4 md:px-6" style={{ backgroundColor: '#0a0b0f' }}>
      <div className="max-w-3xl mx-auto">
        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group text-sm font-bold">
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>

        {/* Profile header card */}
        <ProfileHeader
          displayNameValue={displayNameValue}
          email={user?.email}
          avatarPreview={avatarPreview}
          onAvatarClick={() => fileInputRef.current?.click()}
          uploadingAvatar={uploadingAvatar}
          setAvatarPreview={setAvatarPreview}
          initial={initial}
          balance={balance}
        />

        {/* Cash Out Cards button - New location */}
        <div className="mb-6">
          <button
            onClick={() => setCashOutOpen(true)}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold uppercase tracking-widest transition-all active:scale-[0.98] group relative overflow-hidden"
            style={{
              background: 'rgba(155,92,255,0.08)',
              border: '1.5px solid rgba(155,92,255,0.3)',
              color: '#9b5cff',
              boxShadow: '0 8px 32px -8px rgba(0,0,0,0.5)',
            }}
          >
            {/* Animated glow background */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#9b5cff]/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            
            <div className="relative flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#9b5cff]/20 flex items-center justify-center border border-[#9b5cff]/30 group-hover:scale-110 transition-transform">
                <PackageOpen size={20} className="text-[#9b5cff]" />
              </div>
              <div className="text-left">
                <span className="block leading-tight">Cash Out Cards</span>
                <span className="block text-[10px] opacity-60 font-medium tracking-normal mt-0.5 uppercase">Request physical shipping of your pulls</span>
              </div>
            </div>
          </button>
        </div>

        {/* Tabs Navigation */}
        <ProfileTabs
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* Tab Content */}
        <ProfileTabContent
          activeTab={activeTab}
          profileMsg={profileMsg}
          displayName={displayName}
          setDisplayName={setDisplayName}
          inputClass={inputClass}
          fileInputRef={fileInputRef}
          handleAvatarFileChange={handleAvatarFileChange}
          uploadingAvatar={uploadingAvatar}
          avatarPreview={avatarPreview}
          setAvatarPreview={setAvatarPreview}
          initial={initial}
          avatarError={avatarError}
          userEmail={user?.email}
          handleSaveProfile={handleSaveProfile}
          savingProfile={savingProfile}
          signOut={signOut}
          onBack={onBack}
          passwordMsg={passwordMsg}
          handleChangePassword={handleChangePassword}
          showCurrentPw={showCurrentPw}
          setShowCurrentPw={setShowCurrentPw}
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          showNewPw={showNewPw}
          setShowNewPw={setShowNewPw}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmNewPassword={confirmNewPassword}
          setConfirmNewPassword={setConfirmNewPassword}
          savingPassword={savingPassword}
          loadingHistory={loadingHistory}
          packHistory={packHistory}
          transactions={transactions}
          fetchHistory={fetchHistory}
          txPage={txPage}
          setTxPage={setTxPage}
          packPage={packPage}
          setPackPage={setPackPage}
          totalTx={totalTx}
          totalPacks={totalPacks}
          pageSize={PAGE_SIZE}
          referralCode={stats?.referralCode ?? ''}
        />
      </div>

      {/* Cash Out Modal */}
      <CashOutModal
        isOpen={cashOutOpen}
        onClose={() => setCashOutOpen(false)}
        userId={user?.id ?? ''}
        username={stats?.username ?? stats?.displayName ?? 'Trainer'}
        userEmail={user?.email ?? ''}
      />
    </div>
  );
};
