import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';

const USER_STATS_QUERY_KEY = ['user-stats'];
export const BALANCE_QUERY_KEY = ['user-balance'];
export interface BalanceData { balance: number; matchedBalance: number; }
const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'https://b2nnhe2n.backend.blink.new';

async function getBalance(): Promise<BalanceData> {
  const token = await blink.auth.getValidToken();
  const res = await fetch(`${BACKEND_BASE}/balance`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`);
  return { balance: Number(data.balance) || 0, matchedBalance: Number(data.matchedBalance ?? data.matched_balance ?? 0) || 0 };
}

export function useBalance(userId?: string) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<BalanceData>({ queryKey: [...BALANCE_QUERY_KEY, userId], enabled: !!userId, queryFn: getBalance, staleTime: 15_000, refetchOnWindowFocus: true, refetchOnMount: 'always', retry: 2, retryDelay: attempt => Math.min(750 * 2 ** attempt, 3000) });
  const updateBalance = async (newBalance: number) => { if (!userId) return; qc.setQueryData([...BALANCE_QUERY_KEY, userId], (prev: BalanceData | undefined) => prev ? { ...prev, balance: newBalance } : { balance: newBalance, matchedBalance: 0 }); qc.setQueryData([...USER_STATS_QUERY_KEY, userId], (prev: any) => prev ? { ...prev, balance: newBalance } : prev); qc.invalidateQueries({ queryKey: [...BALANCE_QUERY_KEY, userId] }); qc.invalidateQueries({ queryKey: [...USER_STATS_QUERY_KEY, userId] }); };
  const invalidate = () => qc.invalidateQueries({ queryKey: [...BALANCE_QUERY_KEY, userId] });
  return { balance: data?.balance ?? 0, matchedBalance: data?.matchedBalance ?? 0, isLoading, updateBalance, invalidate };
}
