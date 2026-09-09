export interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username?: string;
  email?: string;
  currentBalance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

export type CardFlowState = 'amount' | 'payment' | 'success' | 'error';

export const PRESET_AMOUNTS = [5, 25, 50, 100];

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
