import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Plus, Shield } from 'lucide-react';
import { useAuth, useUserStats } from '../hooks/useAuth';
import { useBalance } from '../hooks/useBalance';

type Page = 'home' | 'upgrader' | 'battle' | 'exchanger' | 'inventory' | 'profile';

interface NavbarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  openAuthModal: (tab: 'login' | 'signup') => void;
  onProfileOpen: () => void;
  onDepositOpen: () => void;
}

const navTabs: { id: Page; label: string }[] = [
  { id: 'home', label: 'Packs' },
  { id: 'upgrader', label: 'Upgrader' },
  { id: 'battle', label: 'Pack Battle' },
  { id: 'exchanger', label: 'Exchanger' },
  { id: 'inventory', label: 'My Collection' },
];

const DiscordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
);

export const Navbar: React.FC<NavbarProps> = React.memo(({
  currentPage, onPageChange, openAuthModal, onProfileOpen, onDepositOpen,
}) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { stats } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const { balance: liveBalance, isLoading: balanceLoading } = useBalance(user?.id);

  const isAdminUser = stats?.role === 'admin';

  const openAdminPanel = () => {
    window.open('/admin', '_blank');
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center border-b border-white/5"
      style={{ background: '#0d0e14', boxShadow: '0 2px 20px rgba(0,0,0,0.6)' }}
    >
      <div className="w-full px-4 lg:px-6 flex items-center justify-between gap-4">

        {/* Left: Logo + Social */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onPageChange('home')}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <img
              src="/pocketpull-logo.png"
              alt="PocketPull"
              className="w-8 h-8 rounded-full object-cover"
              style={{ boxShadow: '0 0 12px rgba(155,92,255,0.4)' }}
            />
            <span className="text-lg font-display bg-gradient-to-r from-[#00c8ff] to-[#9b5cff] bg-clip-text text-transparent">
              POCKETPULL
            </span>
          </button>

          <div className="hidden md:flex items-center gap-1 pl-1 border-l border-white/10 ml-1">
            <a
              href="https://discord.gg/J9KYr7aXCu"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-gray-500 hover:text-[#5865F2] hover:bg-[#5865F2]/10 transition-all hover:shadow-[0_0_15px_rgba(88,101,242,0.4)]"
              title="Join Our Discord"
            >
              <DiscordIcon />
            </a>
            <a
              href="https://www.instagram.com/pocketpulltcg/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-gray-500 hover:text-[#E4405F] hover:bg-[#E4405F]/10 transition-all hover:shadow-[0_0_15px_rgba(228,64,95,0.4)]"
              title="Follow on Instagram"
            >
              <InstagramIcon />
            </a>
          </div>
        </div>

        {/* Center: Desktop Tabs only */}
        <div className="hidden lg:flex items-center gap-1 flex-1 justify-center">
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onPageChange(tab.id)}
              className={`relative px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all duration-200 ${
                currentPage === tab.id ? 'text-[#00c8ff]' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
              {currentPage === tab.id && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00c8ff]"
                  style={{ boxShadow: '0 0 8px #00c8ff' }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Right: user controls */}
        <div className="flex items-center gap-2 shrink-0">
          {authLoading || (isAuthenticated && !stats) ? (
            <div className="w-28 h-8 rounded-lg bg-white/5 animate-pulse" aria-label="Loading account" />
          ) : isAuthenticated ? (
            <>
              {/* Admin — desktop only */}
              {isAdminUser && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={openAdminPanel}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    background: 'linear-gradient(135deg, rgba(155,92,255,0.2), rgba(0,200,255,0.1))',
                    border: '1px solid rgba(155,92,255,0.4)',
                    color: '#9b5cff',
                    boxShadow: '0 0 12px -4px rgba(155,92,255,0.5)',
                  }}
                >
                  <Shield size={13} /> Admin
                </motion.button>
              )}

              {/* Balance — desktop */}
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onDepositOpen()}
                className="hidden md:flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1.5 cursor-pointer"
                style={{ boxShadow: '0 0 12px -4px rgba(16,185,129,0.4)' }}
              >
                <Plus size={12} className="text-green-400" />
                {balanceLoading ? (
                  <span className="inline-block w-12 h-3 rounded bg-green-400/20 animate-pulse" aria-label="Loading balance" />
                ) : (
                  <span className="text-green-400 text-xs font-bold">${liveBalance.toFixed(2)}</span>
                )}
              </motion.button>

              {/* Avatar+name — desktop */}
              <button
                onClick={onProfileOpen}
                className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 cursor-pointer hover:border-[#9b5cff]/30 transition-all group"
              >
                {stats?.avatarUrl ? (
                  <img src={stats.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00c8ff] to-[#9b5cff] flex items-center justify-center text-[10px] font-bold text-black">
                    {(stats?.displayName || user?.displayName || user?.email || 'T').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-gray-300">{stats?.displayName || user?.displayName || user?.email || 'Trainer'}</span>
                <ChevronDown size={12} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
              </button>

              {/* Mobile: balance pill */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onDepositOpen()}
                className="lg:hidden flex items-center gap-1 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1 cursor-pointer"
              >
                <Plus size={10} className="text-green-400" />
                {balanceLoading ? (
                  <span className="inline-block w-10 h-3 rounded bg-green-400/20 animate-pulse" aria-label="Loading balance" />
                ) : (
                  <span className="text-green-400 text-[11px] font-bold">${liveBalance.toFixed(2)}</span>
                )}
              </motion.button>

              {/* Mobile: avatar */}
              <button onClick={onProfileOpen} className="lg:hidden flex items-center cursor-pointer">
                {stats?.avatarUrl ? (
                  <img src={stats.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-white/15" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00c8ff] to-[#9b5cff] flex items-center justify-center text-xs font-bold text-black border border-white/15">
                    {(stats?.displayName || user?.displayName || user?.email || 'T').charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Desktop */}
              <button
                onClick={() => openAuthModal('login')}
                className="hidden md:block px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors font-medium"
              >
                Login
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="hidden md:block px-4 py-1.5 bg-[#00c8ff] text-black text-sm font-bold rounded-lg hover:bg-[#00c8ff]/80 transition-all active:scale-95"
                style={{ boxShadow: '0 0 15px -3px rgba(0,200,255,0.5)' }}
              >
                SIGN UP
              </button>

              {/* Mobile */}
              <button
                onClick={() => openAuthModal('login')}
                className="lg:hidden px-3 py-1.5 text-xs text-gray-400 border border-white/10 rounded-lg font-bold uppercase"
              >
                Login
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="lg:hidden px-3 py-1.5 bg-[#00c8ff] text-black text-xs font-bold rounded-lg active:scale-95"
                style={{ boxShadow: '0 0 10px -3px rgba(0,200,255,0.5)' }}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
});
