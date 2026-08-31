import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { ProfileTab } from './ProfileTabs';
import { EditProfileTab } from './tabs/EditProfileTab';
import { SecurityTab } from './tabs/SecurityTab';
import { HistoryTab } from './tabs/HistoryTab';
import { ReferralsTab } from './tabs/ReferralsTab';
import { SettingsTab } from './tabs/SettingsTab';

interface ProfileTabContentProps {
  activeTab: ProfileTab;
  // Edit Profile Props
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
  // Security Props
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
  savingPassword: boolean;
  // History Props
  loadingHistory: boolean;
  packHistory: any[];
  transactions: any[];
  fetchHistory: () => void;
  txPage: number;
  setTxPage: (page: number) => void;
  packPage: number;
  setPackPage: (page: number) => void;
  totalTx: number;
  totalPacks: number;
  pageSize: number;
  // Referral Props
  referralCode: string;
}

export const ProfileTabContent: React.FC<ProfileTabContentProps> = (props) => {
  const { activeTab } = props;

  return (
    <AnimatePresence mode="wait">
      {activeTab === 'profile' && (
        <EditProfileTab
          profileMsg={props.profileMsg}
          displayName={props.displayName}
          setDisplayName={props.setDisplayName}
          inputClass={props.inputClass}
          fileInputRef={props.fileInputRef}
          handleAvatarFileChange={props.handleAvatarFileChange}
          uploadingAvatar={props.uploadingAvatar}
          avatarPreview={props.avatarPreview}
          setAvatarPreview={props.setAvatarPreview}
          initial={props.initial}
          avatarError={props.avatarError}
          userEmail={props.userEmail}
          handleSaveProfile={props.handleSaveProfile}
          savingProfile={props.savingProfile}
          signOut={props.signOut}
          onBack={props.onBack}
        />
      )}

      {activeTab === 'security' && (
        <SecurityTab
          passwordMsg={props.passwordMsg}
          handleChangePassword={props.handleChangePassword}
          showCurrentPw={props.showCurrentPw}
          setShowCurrentPw={props.setShowCurrentPw}
          currentPassword={props.currentPassword}
          setCurrentPassword={props.setCurrentPassword}
          showNewPw={props.showNewPw}
          setShowNewPw={props.setShowNewPw}
          newPassword={props.newPassword}
          setNewPassword={props.setNewPassword}
          confirmNewPassword={props.confirmNewPassword}
          setConfirmNewPassword={props.setConfirmNewPassword}
          inputClass={props.inputClass}
          savingPassword={props.savingPassword}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          loadingHistory={props.loadingHistory}
          packHistory={props.packHistory}
          transactions={props.transactions}
          fetchHistory={props.fetchHistory}
          txPage={props.txPage}
          setTxPage={props.setTxPage}
          packPage={props.packPage}
          setPackPage={props.setPackPage}
          totalTx={props.totalTx}
          totalPacks={props.totalPacks}
          pageSize={props.pageSize}
        />
      )}

      {activeTab === 'referrals' && (
        <ReferralsTab referralCode={props.referralCode} />
      )}

      {activeTab === 'settings' && (
        <SettingsTab />
      )}
    </AnimatePresence>
  );
};