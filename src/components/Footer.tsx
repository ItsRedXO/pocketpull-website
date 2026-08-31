import React from 'react';
import { motion } from 'framer-motion';

type Page = 'home' | 'upgrader' | 'battle' | 'exchanger' | 'inventory' | 'profile';

const socialLinks = [
  { name: 'Join Our Discord', href: 'https://discord.gg/J9KYr7aXCu' },
];

const DiscordIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>
);

const supportLinks = [
  { label: 'Contact Us', id: 'contact' },
  { label: 'Shipping Policy', id: 'shipping' },
  { label: 'Returns & Refunds', id: 'returns' },
  { label: 'How It Works', id: 'how-it-works' },
  { label: 'Provably Fair', id: 'provably-fair' },
];

const legalLinks = [
  { label: 'Terms of Service', id: 'terms' },
  { label: 'Privacy Policy', id: 'privacy' },
  { label: 'Cookie Policy', id: 'cookies' },
  { label: 'Responsible Collecting', id: 'responsible' },
];

interface FooterProps {
  onPageChange?: (page: Page) => void;
}

export const Footer: React.FC<FooterProps> = React.memo(({ onPageChange }) => {
  const openInfo = (id: string) => {
    if (id === 'contact') {
      window.dispatchEvent(new CustomEvent('pocketpull-open-support'));
    } else if (id === 'provably-fair') {
      window.dispatchEvent(new CustomEvent('pocketpull-open-provably-fair'));
    } else {
      window.dispatchEvent(new CustomEvent('pocketpull-open-info', { detail: id }));
    }
  };

  return (
    <footer className="bg-[#060710] border-t border-white/5 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-14 text-center sm:text-left">
          {/* Col 1 — Brand */}
          <div className="space-y-5 flex flex-col items-center sm:items-start">
            <button
              onClick={() => onPageChange?.('home')}
              className="inline-block"
            >
              <span className="text-2xl font-display bg-gradient-to-r from-[#00c8ff] to-[#9b5cff] bg-clip-text text-transparent">
                ⚡ POCKETPULL
              </span>
            </button>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              The premier Pokémon mystery pack experience. Pull rare cards, compete in pack battles, and chase the God Pull.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.name}
                  className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:text-[#5865F2] hover:border-[#5865F2]/30 transition-all duration-200 hover:shadow-[0_0_15px_rgba(88,101,242,0.4)]"
                >
                  <DiscordIcon />
                </a>
              ))}
              <a
                href="https://www.instagram.com/pocketpulltcg/"
                target="_blank"
                rel="noopener noreferrer"
                title="Follow on Instagram"
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 hover:text-[#E4405F] hover:border-[#E4405F]/30 transition-all duration-200 hover:shadow-[0_0_15px_rgba(228,64,95,0.4)]"
              >
                <InstagramIcon />
              </a>
            </div>
          </div>

          {/* Col 2 — Platform */}
          <div className="space-y-4 flex flex-col items-center sm:items-start">
            <h4 className="font-display text-sm uppercase tracking-[0.2em] text-gray-500">Platform</h4>
            <ul className="space-y-2">
              {[
                { label: 'Mystery Packs', page: 'home' as Page },
                { label: 'Upgrader', page: 'upgrader' as Page },
                { label: 'Pack Battles', page: 'battle' as Page },
                { label: 'Exchanger', page: 'exchanger' as Page },
                { label: 'My Collection', page: 'inventory' as Page },
              ].map((item) => (
                <li key={item.label}>
                  <button
                    onClick={() => onPageChange?.(item.page)}
                    className="text-sm text-gray-500 hover:text-[#00c8ff] transition-colors hover:pl-1 duration-200 text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Support */}
          <div className="space-y-4 flex flex-col items-center sm:items-start">
            <h4 className="font-display text-sm uppercase tracking-[0.2em] text-gray-500">Support</h4>
            <ul className="space-y-2">
              {supportLinks.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => openInfo(item.id)}
                    className="text-sm text-gray-500 hover:text-[#00c8ff] transition-colors hover:pl-1 duration-200 text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Legal */}
          <div className="space-y-4 flex flex-col items-center sm:items-start">
            <h4 className="font-display text-sm uppercase tracking-[0.2em] text-gray-500">Legal</h4>
            <ul className="space-y-2">
              {legalLinks.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => openInfo(item.id)}
                    className="text-sm text-gray-500 hover:text-[#00c8ff] transition-colors hover:pl-1 duration-200 text-left"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
              <li>
                <span className="text-sm text-red-400 font-bold flex items-center gap-2">
                  🔞 18+ Only
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <p>© 2025 PocketPull. All rights reserved.</p>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>All systems operational</span>
              <span className="text-gray-700">|</span>
              <button onClick={() => openInfo('provably-fair')} className="hover:text-[#00c8ff]">Provably Fair</button>
            </div>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[11px] text-gray-700 leading-relaxed max-w-4xl"
          >
            PocketPull is a collector entertainment platform. PocketPull is not affiliated with, endorsed by, or connected to Nintendo, The Pokémon Company, Game Freak, or any card manufacturer. Users must be 18+. If you feel you may have a problem with collecting habits, visit{' '}
            <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">BeGambleAware.org</a>.
          </motion.p>
        </div>
      </div>
    </footer>
  );
});