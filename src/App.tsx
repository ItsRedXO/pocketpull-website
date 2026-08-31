import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AdminApp } from './admin/AdminApp';
import { blink } from './lib/blink';

// Core layout
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

// Homepage sections
import { HeroSection } from './components/HeroSection';
import { HowItWorks } from './components/HowItWorks';
import { FeaturedPacksSection } from './components/FeaturedPacksSection';
import { Leaderboard } from './components/Leaderboard';
import { TrustSection } from './components/TrustSection';
import { CommunitySection } from './components/CommunitySection';

// Pages
import { UpgraderPage } from './pages/UpgraderPage';
import { PackBattlesPage } from './pages/PackBattlesPage';
import { ExchangerPage } from './pages/ExchangerPage';
import { Inventory } from './pages/Inventory';
import { ProfilePage } from './pages/ProfilePage';

import type { Pack } from './data/mockData';

type Page = 'home' | 'upgrader' | 'battle' | 'exchanger' | 'inventory' | 'profile';

export default function App() {
  // ── Admin route: /admin path renders the separate admin panel ──────────────
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return <AdminApp />;
  }

  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');
  const [depositOpen, setDepositOpen] = useState(false);
  const [infoModalType, setInfoModalType] = useState<InfoModalType | null>(null);
  const [provablyFairOpen, setProvablyFairOpen] = useState(false);

  const { user, isLoading: authLoading, signOut } = useAuth();
  const { stats, loading: statsLoading, updateBalance, setStats } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const { isLoading: balanceLoading } = useBalance(user?.id);
  const packsQuery = usePacks();
  const recentPullsQuery = useRecentPulls();
  const homepageReady = !authLoading
    && (!user || (!statsLoading && !balanceLoading && !!stats))
    && (packsQuery.isSuccess || packsQuery.isError)
    && (recentPullsQuery.isSuccess || recentPullsQuery.isError);

  // Stable callback refs for memoized components
  const handlePageChange = useCallback((page: string) => {
    if (page === 'home' || page === 'upgrader' || page === 'battle' || page === 'exchanger' || page === 'inventory' || page === 'profile') {
      setCurrentPage(page);
    }
  }, []);
  const handleProfileOpen = useCallback(() => setCurrentPage('profile'), []);
  const handleDepositOpen = useCallback(() => setDepositOpen(true), []);
  const handleDepositClose = useCallback(() => setDepositOpen(false), []);
  const handleAuthClose = useCallback(() => setAuthModalOpen(false), []);
  const handleInfoClose = useCallback(() => setInfoModalType(null), []);
  const handlePackClose = useCallback(() => setSelectedPack(null), []);

  // Capture referral code from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      console.log('[Referral] Capturing code from URL:', ref);
      localStorage.setItem('pending_referral_code', ref.trim().toUpperCase());
      // Clean up URL without refreshing
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  useEffect(() => {
    // Auto sign-out deleted accounts (email was released, old session is invalid)
    if (stats?.isDeleted) {
      signOut();
    }
    // Auto sign-out banned accounts — ban is enforced at login in useAuth,
    // but if the ban happens while the user is already logged in, kick them out.
    if (stats?.isBanned) {
      signOut();
    }
  }, [stats?.isDeleted, stats?.isBanned, signOut]);

  // (Audio unlock is handled globally by Howler.js — see src/hooks/useTickSound.ts.
  //  Howler installs its own pointerdown/touchstart/keydown listeners on the
  //  document and runs a silent play().then(pause()) pattern the first time
  //  the user interacts with the page, which fully unlocks the Web Audio
  //  context for subsequent howl.play() calls inside async chains.)

  // ── Global custom event listeners ────────────────────────────────────────────
  useEffect(() => {
    const handleOpenInfo = (e: any) => setInfoModalType(e.detail);
    const handleOpenAuth = (e: any) => openAuthModal(e.detail || 'login');
    const handleOpenProvablyFair = () => setProvablyFairOpen(true);
    window.addEventListener('pocketpull-open-info', handleOpenInfo);
    window.addEventListener('pocketpull-open-auth', handleOpenAuth);
    window.addEventListener('pocketpull-open-provably-fair', handleOpenProvablyFair);
    return () => {
      window.removeEventListener('pocketpull-open-info', handleOpenInfo);
      window.removeEventListener('pocketpull-open-auth', handleOpenAuth);
      window.removeEventListener('pocketpull-open-provably-fair', handleOpenProvablyFair);
    };
  }, []);

  const openAuthModal = (tab: 'login' | 'signup') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  return (
    <AudioProvider>
    <>
      <LoadingSplash ready={homepageReady} />
      <AgeGate />
      <ParticleBackground />

      <AnimatePresence>
        {stats?.isBanned && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-3 text-center font-display uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(220,38,38,0.5)] border-b border-red-500/50"
          >
            Your account is currently banned. Please contact support.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 min-h-screen bg-[#0a0b0f]">
        {/* Fixed header stack */}
        <Navbar
          onPageChange={handlePageChange}
          currentPage={currentPage}
          openAuthModal={openAuthModal}
          onProfileOpen={handleProfileOpen}
          onDepositOpen={handleDepositOpen}
        />
        <LiveTicker />

        {/* Main content — extra bottom padding on mobile for fixed bottom nav */}
        <main className="pb-20 lg:pb-0">
          <AnimatePresence mode="wait">
            {currentPage === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <HeroSection
                  onPackOpen={(pack: Pack) => setSelectedPack(pack)}
                  onPageChange={handlePageChange}
                />
                <FeaturedPacksSection onPackOpen={(pack: Pack) => setSelectedPack(pack)} />
                <Leaderboard />
                <CommunitySection />
                <HowItWorks />
                <TrustSection />
              </motion.div>
            )}

            {currentPage === 'upgrader' && (
              <motion.div
                key="upgrader"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <UpgraderPage />
              </motion.div>
            )}

            {currentPage === 'battle' && (
              <motion.div
                key="battle"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <PackBattlesPage />
              </motion.div>
            )}

            {currentPage === 'exchanger' && (
              <motion.div
                key="exchanger"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <ExchangerPage />
              </motion.div>
            )}

            {currentPage === 'inventory' && (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <Inventory
                  onDepositOpen={handleDepositOpen}
                  onProfileOpen={handleProfileOpen}
                />
              </motion.div>
            )}

            {currentPage === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <ProfilePage onBack={() => setCurrentPage('home')} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <Footer onPageChange={handlePageChange} />

        {/* Fixed bottom navigation — mobile only */}
        <MobileBottomNav currentPage={currentPage} onPageChange={handlePageChange} />
      </div>

      {/* Pack Opening Modal */}
      <AnimatePresence>
        {selectedPack && (
          <PackOpeningModal
            pack={selectedPack}
            onClose={handlePackClose}
          />
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={handleAuthClose}
        defaultTab={authModalTab}
      />

      {/* Deposit Modal — rendered at root so fixed positioning is relative to viewport */}
      <DepositModal
        isOpen={depositOpen}
        onClose={handleDepositClose}
        userId={user?.id || ''}
        username={stats?.username}
        email={stats?.email || user?.email}
        currentBalance={stats?.balance || 0}
        onBalanceUpdate={(nb) => updateBalance(nb)}
      />

      {/* Audio mute button — desktop only */}
      <AudioButton />
      <SupportChat />

      <InfoModal
        type={infoModalType}
        onClose={handleInfoClose}
      />

      <ProvablyFairModal
        isOpen={provablyFairOpen}
        onClose={() => setProvablyFairOpen(false)}
      />
    </>
    </AudioProvider>
  );
}
