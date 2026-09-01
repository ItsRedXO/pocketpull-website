import React from 'react';
import { blink } from '../lib/blink';
import { UserRow } from './types';

export const BalanceSection: React.FC<{ user: UserRow; onUpdate: () => void; showToast?: (msg: string, ok?: boolean) => void }> = ({ user }) => {
  return <div className="text-sm text-white/60">Balance: <span className="text-white">${Number(user.balance || 0).toFixed(2)}</span></div>;
};
