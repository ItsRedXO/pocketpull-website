import { useState,useEffect,useMemo,useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { blink } from '../lib/blink';
import { startOfDay } from 'date-fns';
import { getDailyIncrementalValue } from '../lib/simulation';
import { getLeaderboardData } from '../lib/leaderboard';

export function useLiveCounters(){
 const packsOpenedRef=useRef(0);const lastDateRef=useRef('');const todayPacific=new Date().toLocaleDateString('en-US',{timeZone:'America/Los_Angeles'});if(lastDateRef.current&&lastDateRef.current!==todayPacific)packsOpenedRef.current=0;lastDateRef.current=todayPacific;
 const {data:backendStats}=useQuery({queryKey:['battle-stats-centralized'],queryFn:async()=>{const r=await fetch(`${import.meta.env.VITE_API_BASE_URL||'/api'}/battles/stats`);if(!r.ok)throw new Error('Failed to fetch stats');return r.json() as Promise<{liveBattles:number;packsOpened:number}>;},refetchInterval:3000,staleTime:1000,retry:false});
 const raw=backendStats?.packsOpened??0;if(raw>packsOpenedRef.current)packsOpenedRef.current=raw;const packsOpened=packsOpenedRef.current;const realLiveBattles=backendStats?.liveBattles||0;const simulatedBattlesCount=useMemo(()=>8+(new Date().getHours()%6),[]);const liveBattles=realLiveBattles+simulatedBattlesCount;
 const cardsWonToday=useMemo(()=>getDailyIncrementalValue(420,10000),[]);const totalUpgrades=useMemo(()=>getDailyIncrementalValue(180,5000),[]);const exchangesToday=useMemo(()=>getDailyIncrementalValue(110,3000),[]);const avgPullValue=useMemo(()=>{const seed=startOfDay(new Date()).getTime(),hour=new Date().getHours(),minute=new Date().getMinutes();return Math.floor(115+Math.sin(seed+hour+minute)*15);},[]);
 const {data:biggestPull=0}=useQuery({queryKey:['biggest-pull-sync'],queryFn:async()=>{const pulls=await getLeaderboardData('pulls');return pulls[0]?.numericValue||0;},staleTime:30000,refetchInterval:30000,retry:false});
 const [realPlayers,setRealPlayers]=useState(0);const [simulatedOffset,setSimulatedOffset]=useState(180);
 useEffect(()=>{let channel:any=null;let unsubscribeAuth:(()=>void)|undefined;const init=async()=>{if(!blink.auth.isAuthenticated())return;channel=blink.realtime.channel('app-presence');try{await channel.subscribe();channel.onPresence((users:any[])=>setRealPlayers(users.length));setRealPlayers((await channel.getPresence()).length);}catch{}};unsubscribeAuth=blink.auth.onAuthStateChanged((state:any)=>{if(!state.isLoading)void init();});const interval=setInterval(()=>setSimulatedOffset(prev=>Math.min(250,Math.max(150,prev+Math.floor(Math.random()*7)-3))),15000);return()=>{unsubscribeAuth?.();void channel?.unsubscribe();clearInterval(interval);};},[]);
 return {packsOpened,cardsWonToday,totalUpgrades,exchangesToday,avgPullValue,biggestPull,livePlayers:simulatedOffset+realPlayers,liveBattles};
}
