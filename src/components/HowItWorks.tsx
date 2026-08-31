import React from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  {
    num: '01',
    icon: '💳',
    title: 'Deposit Credits',
    desc: 'Add funds securely with your preferred payment method. Credits are instant.',
    color: '#00c8ff',
    details: ['Visa, Mastercard, crypto accepted'],
  },
  {
    num: '02',
    icon: '📦',
    title: 'Open Mystery Packs',
    desc: 'Browse 20+ pack types from $0.50 to $500. Every pack has real cards with real value.',
    color: '#9b5cff',
    details: ['Provably fair RNG system'],
  },
  {
    num: '03',
    icon: '⬆️',
    title: 'Upgrade & Trade',
    desc: 'Use the Upgrader to risk cards for better ones, or trade dupes in the Exchanger.',
    color: '#10b981',
    details: ['Strategic depth beyond luck'],
  },
  {
    num: '04',
    icon: '🚚',
    title: 'CASH OUT REAL CARDS',
    desc: 'Cash out your collection! ($25 requirement) Free shipping included. Cashout requests close every Sunday at 11:59:59 PM and all orders ship every Wednesday.',
    color: '#ffd700',
    details: [
      'Free shipping on all cashouts',
      '$25 minimum cashout',
      'Orders ship every Wednesday'
    ],
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section className="py-16 bg-[#0a0b0f]">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wider text-white">
            HOW IT WORKS
          </h2>
          <div className="w-12 h-0.5 bg-[#00c8ff] mt-2" style={{ boxShadow: '0 0 8px #00c8ff' }} />
          <p className="text-gray-500 text-sm mt-3">Simple steps. Real pulls. Infinite excitement.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="relative overflow-hidden rounded-xl p-6 cursor-default group"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${step.color}25`,
              }}
            >
              {/* Connecting line (not on last) */}
              {i < STEPS.length - 1 && (
                <div
                  className="hidden lg:block absolute top-[2.2rem] -right-2.5 w-5 h-0.5 z-10"
                  style={{ background: `linear-gradient(to right, ${step.color}60, transparent)` }}
                />
              )}

              {/* Background glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 50% 0%, ${step.color}12 0%, transparent 70%)` }}
              />

              {/* Step number */}
              <span
                className="font-display text-5xl font-bold absolute top-4 right-5 opacity-[0.07]"
                style={{ color: step.color }}
              >
                {step.num}
              </span>

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 relative z-10"
                style={{
                  background: `${step.color}15`,
                  border: `1px solid ${step.color}30`,
                  boxShadow: `0 0 16px -4px ${step.color}40`,
                }}
              >
                {step.icon}
              </div>

              {/* Content */}
              <h3
                className="font-display text-lg uppercase tracking-wide mb-2 relative z-10"
                style={{ color: step.color }}
              >
                {step.title}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed relative z-10">{step.desc}</p>
              
              <div className="mt-4 space-y-1 relative z-10">
                {step.details.map((detail, idx) => (
                  <p
                    key={idx}
                    className="text-[10px] flex items-center gap-1.5"
                    style={{ color: `${step.color}99` }}
                  >
                    <span className="text-[12px]">✓</span> {detail}
                  </p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
