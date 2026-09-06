import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminApp } from './admin/AdminApp';
import { LoadingSplash } from './components/LoadingSplash';
import { AgeGate } from './components/AgeGate';
import { ParticleBackground } from './components/ParticleBackground';
import { Navbar } from './components/Navbar';
import { LiveTicker } from './components/LiveTicker';
import { Footer } from './components/Footer';
import { AudioProvider, AudioButton } from './components/AudioSystem';
import { SupportChat } from './components/SupportChat';
import { InfoModal, InfoModalType } from './components/InfoModal';
import ProvablyFairModal from './components/ProvablyFairModal';
import { PackOpeningModal } from './components/PackOpeningModal';
import { AuthModal } from './components/AuthModal';
import { DepositModal } from './components/DepositModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { useAuth, useUserStats } from './hooks/useAuth';
import { useBalance } from './hooks/useBalance';
import { usePacks, useRecentPulls } from './hooks/usePacks';
import { HeroSection } from './components/HeroSection';
import { HowItWorks } from './components/HowItWorks';
import { FeaturedPacksSection } from './components/FeaturedPacksSection';
import { Leaderboard } from './components/Leaderboard';
import { TrustSection } from './components/TrustSection';
import { CommunitySection } from './components/CommunitySection';
import { UpgraderPage } from './pages/UpgraderPage';
import { PackBattlesPage } from './pages/PackBattlesPage';
import { ExchangerPage } from './pages/ExchangerPage';
import { Inventory } from './pages/Inventory';
import { ProfilePage } from './pages/ProfilePage';
import { VaultPage } from './pages/VaultPage';
import type { Pack } from './data/mockData';

type Page = 'home' | 'upgrader' | 'battle' | 'exchanger' | 'inventory' | 'profile' | 'vault';

export default function App() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return <AdminApp />;
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');
  const [depositOpen, setDepositOpen] = useState(false);
  const [infoModalType, setInfoModalType] = useState<InfoModalType | null>(null);
  const [provablyFairOpen, setProvablyFairOpen] = useState(false);
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { stats, loading: statsLoading, updateBalance } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const { isLoading: balanceLoading } = useBalance(user?.id);
  const packsQuery = usePacks();
  const recentPullsQuery = useRecentPulls();
  const homepageReady = !authLoading && (!user || (!statsLoading && !balanceLoading && !!stats)) && (packsQuery.isSuccess || packsQuery.isError) && (recentPullsQuery.isSuccess || recentPullsQuery.isError);
  const handlePageChange = useCallback((page: string) => {
    if (['home', 'upgrader', 'battle', 'exchanger', 'inventory', 'profile', 'vault'].includes(page)) setCurrentPage(page as Page);
  }, []);
  const handleProfileOpen = useCallback(() => setCurrentPage('profile'), []);
  const handleDepositOpen = useCallback(() => setDepositOpen(true), []);
  const handleDepositClose = useCallback(() => setDepositOpen(false), []);
  const handleAuthClose = useCallback(() => setAuthModalOpen(false), []);
  const handleInfoClose = useCallback(() => setInfoModalType(null), []);
  const handlePackClose = useCallback(() => setSelectedPack(null), []);
  const openAuthModal = useCallback((tab: 'login' | 'signup') => { setAuthModalTab(tab); setAuthModalOpen(true); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search); const ref = params.get('ref');
    if (ref) { localStorage.setItem('pending_referral_code', ref.trim().toUpperCase()); window.history.replaceState({}, '', window.location.pathname + window.location.hash); }
  }, []);
  useEffect(() => { if (stats?.isDeleted || stats?.isBanned) signOut(); }, [stats?.isDeleted, stats?.isBanned, signOut]);
  useEffect(() => {
    const handleOpenInfo = (e: any) => setInfoModalType(e.detail);
    const handleOpenAuth = (e: any) => openAuthModal(e.detail || 'login');
    const handleOpenProvablyFair = () => setProvablyFairOpen(true);
    window.addEventListener('pocketpull-open-info', handleOpenInfo); window.addEventListener('pocketpull-open-auth', handleOpenAuth); window.addEventListener('pocketpull-open-provably-fair', handleOpenProvablyFair);
    return () => { window.removeEventListener('pocketpull-open-info', handleOpenInfo); window.removeEventListener('pocketpull-open-auth', handleOpenAuth); window.removeEventListener('pocketpull-open-provably-fair', handleOpenProvablyFair); };
  }, [openAuthModal]);
  return <AudioProvider><><LoadingSplash ready={homepageReady} /><AgeGate /><ParticleBackground /><AnimatePresence>{stats?.isBanned && <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}} className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-3 text-center font-display uppercase tracking-widest text-sm">Your account is currently banned. Please contact support.</motion.div>}</AnimatePresence><div className="relative z-10 min-h-screen bg-[#0a0b0f]"><Navbar onPageChange={handlePageChange} currentPage={currentPage} openAuthModal={openAuthModal} onProfileOpen={handleProfileOpen} onDepositOpen={handleDepositOpen} /><LiveTicker /><main className="pb-20 lg:pb-0"><AnimatePresence mode="wait">{currentPage === 'home' && <motion.div key="home" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.35}}><HeroSection onPackOpen={setSelectedPack} onPageChange={handlePageChange} /><FeaturedPacksSection onPackOpen={setSelectedPack} /><Leaderboard /><CommunitySection /><HowItWorks /><TrustSection /></motion.div>}{currentPage === 'vault' && <motion.div key="vault" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.35}}><VaultPage onPackOpen={setSelectedPack} /></motion.div>}{currentPage === 'upgrader' && <UpgraderPage />}{currentPage === 'battle' && <PackBattlesPage />}{currentPage === 'exchanger' && <ExchangerPage />}{currentPage === 'inventory' && <Inventory onDepositOpen={handleDepositOpen} onProfileOpen={handleProfileOpen} />}{currentPage === 'profile' && <ProfilePage onBack={() => setCurrentPage('home')} />}</AnimatePresence></main><Footer onPageChange={handlePageChange} /><MobileBottomNav currentPage={currentPage} onPageChange={handlePageChange} /></div><AnimatePresence>{selectedPack && <PackOpeningModal pack={selectedPack} onClose={handlePackClose} />}</AnimatePresence><AuthModal isOpen={authModalOpen} onClose={handleAuthClose} defaultTab={authModalTab} /><DepositModal isOpen={depositOpen} onClose={handleDepositClose} userId={user?.id || ''} username={stats?.username} email={stats?.email || user?.email} currentBalance={stats?.balance || 0} onBalanceUpdate={updateBalance} /><AudioButton /><SupportChat /><InfoModal type={infoModalType} onClose={handleInfoClose} /><ProvablyFairModal isOpen={provablyFairOpen} onClose={() => setProvablyFairOpen(false)} /></></AudioProvider>;
}
