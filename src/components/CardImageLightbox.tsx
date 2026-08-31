import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  rarityColor?: string;
  onClose: () => void;
}

export const CardImageLightbox: React.FC<Props> = ({ src, alt, rarityColor = '#00c8ff', onClose }) => {
  const handleKey = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [handleKey]);

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(18px)' }}
        onClick={onClose}
      >
        {/* Glow halo behind the card */}
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            width: '320px',
            height: '320px',
            background: `radial-gradient(ellipse, ${rarityColor}30 0%, transparent 70%)`,
            filter: 'blur(40px)',
          }}
        />

        {/* Card image — stop propagation so clicking the image doesn't close */}
        <motion.div
          key="lightbox-card"
          initial={{ opacity: 0, scale: 0.82, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 12 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center"
          onClick={e => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt}
            className="rounded-xl object-contain select-none"
            style={{
              maxHeight: 'min(520px, 80vh)',
              maxWidth: 'min(380px, 90vw)',
              boxShadow: `0 0 60px -10px ${rarityColor}88, 0 30px 80px rgba(0,0,0,0.8)`,
              border: `1.5px solid ${rarityColor}40`,
            }}
            draggable={false}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-150 hover:scale-110 active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
            }}
            aria-label="Close preview"
          >
            <X size={14} className="text-white/80" />
          </button>
        </motion.div>

        {/* Tap-anywhere-to-close hint — mobile */}
        <p
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] text-white/25 uppercase tracking-widest select-none"
        >
          Tap anywhere to close
        </p>
      </motion.div>
    </AnimatePresence>
  );
};
