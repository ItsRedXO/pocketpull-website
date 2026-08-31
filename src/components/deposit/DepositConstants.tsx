import React from 'react';

export interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username?: string;
  email?: string;
  currentBalance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

export type Tab = 'card' | 'crypto';
export type CryptoOption = 'BTC' | 'ETH' | 'XRP';
export type CardFlowState = 'amount' | 'payment' | 'success' | 'error';
export type CryptoFlowState = 'amount' | 'pending' | 'success' | 'error';

export const PRESET_AMOUNTS = [5, 25, 50, 100];

export interface CryptoOptionData {
  id: CryptoOption;
  name: string;
  network: string;
  color: string;
  symbol: string;
  address: string;
  icon: React.ReactNode;
}

export const CRYPTO_OPTIONS: CryptoOptionData[] = [
  {
    id: 'BTC',
    name: 'Bitcoin',
    network: 'Bitcoin Network',
    color: '#f7931a',
    symbol: '₿',
    address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.084v.006z" />
      </svg>
    ),
  },
  {
    id: 'ETH',
    name: 'Ethereum',
    network: 'ERC-20',
    color: '#627eea',
    symbol: 'Ξ',
    address: '0x742d35Cc6634C0532925a3b8D4C9B2f8B8cA8f1',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z" />
      </svg>
    ),
  },
  {
    id: 'XRP',
    name: 'XRP',
    network: 'XRP Ledger',
    color: '#00aae4',
    symbol: 'X',
    address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M19.6 3h3.03l-6.46 6.46a5.67 5.67 0 01-8.34 0L1.37 3H4.4l4.95 4.95a3.38 3.38 0 004.3 0L19.6 3zm-15.2 18h-3.03l6.46-6.46a5.67 5.67 0 018.34 0L22.63 21H19.6l-4.95-4.95a3.38 3.38 0 00-4.3 0L4.4 21z" />
      </svg>
    ),
  },
];

export const STRIPE_APPEARANCE = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#00c8ff',
    colorBackground: '#0d0e14',
    colorText: '#ffffff',
    colorDanger: '#ef4444',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    borderRadius: '12px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid rgba(255,255,255,0.1)',
      backgroundColor: '#0d0e14',
      color: '#ffffff',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid rgba(0,200,255,0.5)',
      boxShadow: '0 0 0 3px rgba(0,200,255,0.08)',
    },
    '.Label': { color: '#6b7280', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' },
    '.Tab': { border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
    '.Tab--selected': { border: '1px solid rgba(0,200,255,0.4)', backgroundColor: 'rgba(0,200,255,0.08)', color: '#00c8ff' },
    '.Error': { color: '#ef4444' },
  },
};
