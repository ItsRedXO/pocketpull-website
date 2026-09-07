import type React from 'react';

export interface LogEntryRaw {
  id: string;
  type: string;
  action: string;
  details: any;
  valueIn: number;
  valueOut: number;
  result: string;
  createdAt: string;
  userId?: string;
  username?: string;
}

export interface LogsPage {
  rows: LogEntryRaw[];
  total: number;
}

export interface TimelineEntry {
  type: 'pack_open' | 'sell' | 'battle' | 'cashout' | 'deposit' | 'upgrade' | 'exchange' | 'other';
  title: string;
  subtitle: string;
  date: string;
  amount?: string;
  color: string;
  icon: React.ReactNode;
  amountColor?: string;
  logData?: LogEntryRaw;
}
