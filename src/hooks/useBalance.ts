import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import { fetchCurrentUser } from '../lib/userApi';

const USER_STATS_QUERY_KEY = ['user-stats'];
export const BALANCE_QUERY_KEY = ['user-balance'];
export interface BalanceData { balance:number; matchedBalance:number; }

export function useBalance(userId?: string) {
  const qc=useQueryClient();
  const {data,isLoading}=useQuery<BalanceData>({
    queryKey:[...BALANCE_QUERY_KEY,userId],enabled:!!userId,
    queryFn:async()=>{const result=await fetchCurrentUser();return {balance:Number(result.user?.balance||0),matchedBalance:Number(result.user?.matchedBalance||0)};},
    staleTime:15000,refetchOnWindowFocus:true,refetchOnMount:'always',retry:2,
  });
  useEffect(()=>{
    if(!userId)return; let unsubscribe:(()=>void)|undefined; let active=true;
    const subscribe=async()=>{try{unsubscribe=await blink.realtime.subscribe(`user-updates-${userId}`,(message:any)=>{if(!active||message.type!=='balance_updated')return;const next=Number(message.data?.newBalance)||0;const matched=Number(message.data?.newMatchedBalance);qc.setQueryData([...BALANCE_QUERY_KEY,userId],(previous:BalanceData|undefined)=>({balance:next,matchedBalance:Number.isFinite(matched)?matched:previous?.matchedBalance||0}));});}catch(error){console.warn('[useBalance] realtime subscription failed:',error);}};
    subscribe(); return()=>{active=false;unsubscribe?.();};
  },[qc,userId]);
  const updateBalance=async(newBalance:number)=>{if(!userId)return;qc.setQueryData([...BALANCE_QUERY_KEY,userId],(prev:BalanceData|undefined)=>prev?{...prev,balance:newBalance}:{balance:newBalance,matchedBalance:0});qc.setQueryData([...USER_STATS_QUERY_KEY,userId],(prev:any)=>prev?{...prev,balance:newBalance}:prev);await qc.invalidateQueries({queryKey:[...BALANCE_QUERY_KEY,userId]});};
  const invalidate=()=>qc.invalidateQueries({queryKey:[...BALANCE_QUERY_KEY,userId]});
  return {balance:data?.balance??0,matchedBalance:data?.matchedBalance??0,isLoading,updateBalance,invalidate};
}
