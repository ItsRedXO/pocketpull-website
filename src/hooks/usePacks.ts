import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { blink } from '../lib/blink';

const API=import.meta.env.VITE_API_BASE_URL||'/api';
async function authHeaders(){const token=await blink.auth.getValidToken();return {'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})};}
async function get<T>(path:string):Promise<T>{const r=await fetch(`${API}${path}`,{headers:await authHeaders()});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||`API error ${r.status}`);return d as T;}

export interface PackCatalog {id:string;packType:'standard'|'mystery';name:string;price:number;description:string;imageUrl:string;glowColor:string;borderColor:string;isActive:number;sortOrder:number;quantityLimit:number;currentQuantity:number;cooldownHours:number;expiresAt:string|null;nameColor?:string;descriptionColor?:string;priceColor?:string;buttonTextColor?:string;openAnotherButtonTextColor?:string;}
export interface PackCard {id:string;packId:string;cardName:string;rarity:'common'|'uncommon'|'rare'|'ultra'|'secret'|'god';pullChance:number;estimatedValue:number;cardImageUrl?:string;sortOrder:number;quantity?:number;originalQuantity?:number;packName?:string;}

export function usePacks(){return useQuery<PackCatalog[]>({queryKey:['packs-catalog'],queryFn:async()=>{const d=await get<{packs:PackCatalog[]}>('/packs');return d.packs;},staleTime:60000,refetchInterval:60000,refetchOnMount:'always',refetchOnReconnect:true,retry:6});}
export function useUserCooldowns(userId:string|undefined){return useQuery<Record<string,string>>({queryKey:['user-pack-cooldowns',userId],enabled:!!userId,queryFn:async()=>{const d=await get<{cooldowns:Record<string,string>}>('/pack-cooldowns');return d.cooldowns;},staleTime:20000,refetchInterval:20000});}
export function usePackCards(packId:string|null){return useQuery<PackCard[]>({queryKey:['pack-cards',packId],enabled:!!packId,queryFn:async()=>{const d=await get<{cards:PackCard[]}>(`/packs/${encodeURIComponent(packId!)}/cards`);return d.cards;},staleTime:600000});}
export function useAllCards(){return useQuery<PackCard[]>({queryKey:['all-pack-cards'],queryFn:async()=>{const d=await get<{cards:PackCard[]}>('/all-cards');return d.cards;},staleTime:900000,refetchOnMount:'always',refetchOnReconnect:true,retry:3});}
export function useRecentPulls(limit=12){return useQuery({queryKey:['recent-pulls',limit],queryFn:async()=>{const d=await get<{pulls:any[]}>(`/recent-pulls?limit=${limit}`);return d.pulls.map((p:any)=>({...p,user:p.user||'Trainer',time:formatDistanceToNow(new Date(p.created_at||p.createdAt),{addSuffix:true})}));},staleTime:30000,refetchOnMount:'always',refetchOnReconnect:true,retry:6});}
export function useHallOfFame(limit=5){return useQuery({queryKey:['hall-of-fame',limit],queryFn:async()=>{const d=await get<{pulls:any[]}>(`/hall-of-fame?limit=${limit}`);return d.pulls.map((p:any)=>({...p,user:p.user||'Trainer',time:formatDistanceToNow(new Date(p.created_at||p.createdAt),{addSuffix:true})}));},staleTime:60000,refetchOnMount:'always',refetchOnReconnect:true,retry:6});}
export function useGodPulls(){return useQuery({queryKey:['god-pulls-catalog'],queryFn:async()=>{const d=await get<{cards:any[]}>('/god-pulls-catalog');return d.cards;},staleTime:600000,refetchOnMount:'always',refetchOnReconnect:true,retry:6});}
