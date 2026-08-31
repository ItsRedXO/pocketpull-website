import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Star, CheckCircle, CreditCard, Users } from 'lucide-react';

const reviewPool = [
  // 5 Stars
  { user: 'DragonMaster99', stars: 5, text: 'Finally found a site with real odds! Pulled a Secret Rare on my first day. The animations are top-tier.' },
  { user: 'PokeQueen_Liz', stars: 5, text: 'Best Pokémon TCG site out there. Instant withdrawals and the community battles are so much fun.' },
  { user: 'VaultHunter_X', stars: 5, text: 'CINEMATIC! Opening packs here feels like a movie. Just got my dream card, thanks PocketPull!' },
  { user: 'RareHunter_88', stars: 5, text: 'The upgrader system is a game changer. Turned a few commons into a legendary pull. 5 stars all the way.' },
  { user: 'EliteTrainer_Jo', stars: 5, text: 'Super smooth experience. Support helped me instantly when I had a question. Very professional.' },
  { user: 'ShinyLover_22', stars: 5, text: 'The interface is so clean and addictive. Love the dark-glow aesthetic. Definitely the best in the industry.' },
  { user: 'PackRipper_Pro', stars: 5, text: 'I\'ve tried other sites but this one is the most transparent. Verified fair odds actually mean something here.' },
  { user: 'GottaCatchEmAll', stars: 5, text: 'The variety of packs is insane. Always something new to open. My inventory is looking amazing!' },
  // 4 Stars
  { user: 'ShinySeeker', stars: 4, text: 'Solid site. Pulls are decent and the design is beautiful. Wish there were a few more free packs, but still great.' },
  { user: 'CardCollector_77', stars: 4, text: 'Everything works as expected. The pack variety is excellent. Had some bad luck today, but that\'s part of the game.' },
  { user: 'MysticMew', stars: 4, text: 'Good platform for serious collectors. The inventory management is easy to use. Highly recommend giving it a try.' },
  { user: 'BattleKing_X', stars: 4, text: 'Really enjoy the battles. Sometimes the matchmaking takes a minute, but the rewards make it worth the wait.' },
  { user: 'TrainerRed_01', stars: 4, text: 'Great experience overall. The upgrader is a bit risky but when it hits, it really hits big. Fun site!' },
  { user: 'NeoCollector', stars: 4, text: 'Love the leaderboard system. Gives you a reason to keep climbing. Very engaging community features.' },
  // 3 Stars (Rare)
  { user: 'CasualPulls', stars: 3, text: 'It\'s okay. The site looks great but I\'ve been on a losing streak lately. Still worth using for the unique packs.' },
  { user: 'MobileTrainer', stars: 3, text: 'Decent experience overall. A bit slow to load on mobile sometimes, but the pack openings are definitely exciting.' },
];

const badges = [
  { icon: <ShieldCheck size={18} className="text-primary" />, label: '256-bit SSL Encrypted' },
  { icon: <Zap size={18} className="text-primary" />, label: 'Instant Card Delivery' },
  { icon: <Star size={18} className="text-primary" />, label: '10,000+ 5-Star Reviews' },
  { icon: <CheckCircle size={18} className="text-primary" />, label: 'Verified Fair Odds' },
  { icon: <CreditCard size={18} className="text-primary" />, label: 'Secure Payments' },
];

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.5 } }),
};

export const TrustSection: React.FC = () => {
  const selectedTestimonials = useMemo(() => {
    // Shuffle and pick 3
    const shuffled = [...reviewPool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  }, []);

  return (
    <section id="trust" className="py-24 bg-black/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-display uppercase tracking-tighter mb-4"
          >
            Trusted by <span className="text-primary text-glow-blue">10,000+</span> Trainers
          </motion.h2>
          <div className="h-1 w-16 bg-primary mx-auto neon-glow-blue rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h3 className="text-2xl font-display uppercase tracking-widest text-primary mb-8">
              Why Players Trust Us
            </h3>
            <div className="space-y-4">
              {badges.map((badge, i) => (
                <motion.div
                  key={i}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={itemVariants}
                  className="glass-card px-6 py-5 flex items-center gap-5 border-primary/10 hover:border-primary/30 hover:neon-glow-blue transition-all cursor-default"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    {badge.icon}
                  </div>
                  <span className="font-bold text-base">{badge.label}</span>
                </motion.div>
              ))}
            </div>

            <div className="glass-card p-6 border-white/5 mt-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users size={20} className="text-primary" />
                </div>
                <span className="text-sm text-muted-foreground italic">
                  Over <strong className="text-foreground not-italic">10,000</strong> verified members worldwide and counting.
                </span>
              </div>
            </div>
          </motion.div>

          {/* Testimonials */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            {/* Satisfaction Rate */}
            <div className="glass-card p-6 border-primary/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-display uppercase tracking-wider text-muted-foreground">Satisfaction Rate</span>
                <span className="font-display text-2xl text-primary">97%</span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: '97%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                  style={{ boxShadow: '0 0 15px var(--primary)' }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 text-center uppercase tracking-widest">Based on independent third-party audits</p>
            </div>

            <div className="space-y-4">
              {selectedTestimonials.map((t, i) => (
                <motion.div
                  key={t.user + i}
                  custom={i + 2}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={itemVariants}
                  className="glass-card p-6 space-y-4 border-white/5 hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-display text-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.2)]">
                        {t.user.charAt(0)}
                      </div>
                      <span className="font-bold text-sm">{t.user}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {Array(t.stars).fill(0).map((_, s) => (
                        <span key={s} className="text-rarity-secret text-sm drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]">★</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">&ldquo;{t.text}&rdquo;</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
