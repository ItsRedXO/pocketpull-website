import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export type InfoModalType = 
  | 'shipping' 
  | 'returns' 
  | 'how-it-works' 
  | 'fairness' 
  | 'terms' 
  | 'privacy' 
  | 'cookies' 
  | 'responsible';

interface InfoModalProps {
  type: InfoModalType | null;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ type, onClose }) => {
  const getContent = () => {
    switch (type) {
      case 'shipping':
        return {
          title: 'Shipping Policy',
          content: (
            <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
              <p>• All approved card shipment orders are shipped on Wednesdays.</p>
              <p>• The weekly shipment cutoff is Sunday night at 11:59 PM.</p>
              <p>• Shipment requests submitted after Sunday 11:59 PM will move to the following Wednesday.</p>
              <p>• Players must have at least $25 worth of cards to request shipping.</p>
              <p>• Shipping requests are limited to 25 cards per shipment/order.</p>
              <p>• Players are responsible for entering the correct shipping address.</p>
            </div>
          )
        };
      case 'returns':
        return {
          title: 'Returns & Refunds',
          content: (
            <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
              <p>• All sales are final.</p>
              <p>• We do not accept returns on trading cards due to fraud concerns, including card swapping, counterfeiting, card tampering, and condition disputes.</p>
              <p>• Once an order has been shipped and accepted by the carrier, shipping and delivery are the responsibility of the carrier.</p>
              <p>• If your package is lost, damaged, or delayed during transit, please contact the shipping carrier first. PocketPull will assist when possible but cannot guarantee carrier outcomes.</p>
              <p>• If PocketPull ships the wrong card, wrong item, or makes an order fulfillment error, contact support within 7 days of delivery and we will work with you to resolve the issue.</p>
              <p>• Any approved resolution for a fulfillment error may include replacement of the item, store credit, or another reasonable solution determined by PocketPull.</p>
              <p>• By using PocketPull and requesting shipment of cards, you acknowledge and agree to this Returns & Refunds Policy.</p>
            </div>
          )
        };
      case 'how-it-works':
        return {
          title: 'How It Works',
          content: (
            <div className="space-y-6 text-gray-400 text-sm leading-relaxed">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00c8ff]/20 text-[#00c8ff] flex items-center justify-center font-bold text-xs">1</span>
                  <p><strong className="text-white">Deposit:</strong> Deposit credits into your PocketPull account.</p>
                </div>
                <div className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00c8ff]/20 text-[#00c8ff] flex items-center justify-center font-bold text-xs">2</span>
                  <p><strong className="text-white">Choose:</strong> Choose mystery packs you like.</p>
                </div>
                <div className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00c8ff]/20 text-[#00c8ff] flex items-center justify-center font-bold text-xs">3</span>
                  <p><strong className="text-white">Open:</strong> Open packs and collect real trading cards.</p>
                </div>
                <div className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00c8ff]/20 text-[#00c8ff] flex items-center justify-center font-bold text-xs">4</span>
                  <p><strong className="text-white">Trade:</strong> Use the Upgrader or Exchanger to trade toward cards you want.</p>
                </div>
                <div className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#00c8ff]/20 text-[#00c8ff] flex items-center justify-center font-bold text-xs">5</span>
                  <p><strong className="text-white">Ship:</strong> Request shipping and get your cards shipped directly to your home.</p>
                </div>
              </div>
              <p className="p-4 rounded-xl bg-white/5 italic border border-white/5">
                "PocketPull is a collector entertainment platform. Players always receive collectible card rewards and can request eligible cards to be shipped."
              </p>
            </div>
          )
        };
      case 'fairness':
        return {
          title: 'Fairness & Odds',
          content: (
            <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
              <p>• Pack odds are displayed before opening.</p>
              <p>• Pull outcomes are generated through the site’s backend system.</p>
              <p>• Admins cannot manually change the result of a specific player’s pack opening after it starts.</p>
              <p>• Pack contents, odds, and card values are managed through the admin panel.</p>
              <p>• Our system ensures that every pull is random and strictly follows the displayed probabilities.</p>
            </div>
          )
        };
      case 'terms':
        return {
          title: 'Terms of Service',
          content: (
            <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
              <p>• PocketPull is a collector entertainment platform, not a gambling platform.</p>
              <p>• Users must be 18+ to participate.</p>
              <p>• Users purchase credits to open digital mystery packs and receive collectible trading card rewards.</p>
              <p>• Card values are estimates and may change based on market conditions.</p>
              <p>• PocketPull is not affiliated with, endorsed by, or connected to Nintendo, The Pokémon Company, Game Freak, or any card manufacturer.</p>
              <p>• Users are responsible for following local laws.</p>
              <p>• Abuse, fraud, chargebacks, fake accounts, or exploit attempts may result in account suspension.</p>
              <p>• Shipping is subject to the posted Shipping Policy.</p>
              <p>• Returns/refunds are subject to the posted Returns & Refunds Policy.</p>
            </div>
          )
        };
      case 'privacy':
        return {
          title: 'Privacy Policy',
          content: (
            <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
              <p>• We collect account info like name, email, login details, shipping details, transaction history, and support messages.</p>
              <p>• We use this info to operate accounts, process deposits, track card ownership, ship cards, prevent fraud, and provide support.</p>
              <p>• We do not sell personal information.</p>
              <p>• Payment information is handled securely by our payment processors and not stored directly by PocketPull.</p>
              <p>• Users can contact support for privacy questions.</p>
            </div>
          )
        };
      case 'cookies':
        return {
          title: 'Cookie Policy',
          content: (
            <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
              <p>• The site may use cookies or local storage to keep users logged in, remember preferences, improve performance, and support analytics/security.</p>
              <p>• Users can disable cookies in their browser, but some site features may stop working properly.</p>
            </div>
          )
        };
      case 'responsible':
        return {
          title: 'Responsible Collecting',
          content: (
            <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
              <p>• PocketPull is designed as a collector entertainment platform.</p>
              <p>• Set a personal budget before buying credits.</p>
              <p>• Do not spend money needed for bills, rent, food, or other responsibilities.</p>
              <p>• Pack openings are random and should be treated as entertainment.</p>
              <p>• If the experience stops feeling fun, take a break and contact support.</p>
            </div>
          )
        };
      default:
        return { title: '', content: null };
    }
  };

  const { title, content } = getContent();

  return (
    <AnimatePresence>
      {type && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-[#0d0e14] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h2 className="text-xl font-display text-white uppercase tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {content}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
