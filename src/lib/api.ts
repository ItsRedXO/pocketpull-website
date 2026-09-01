import { blink } from './blink';

const BACKEND_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function getAuthHeaders(): Promise<Record<string,string>> {
  try { const token = await blink.auth.getValidToken(); if (token) return {'Content-Type':'application/json',Authorization:`Bearer ${token}`}; } catch {}
  return {'Content-Type':'application/json'};
}
async function request<T>(path:string, init:RequestInit={}):Promise<T>{
  const res=await fetch(`${BACKEND_BASE}${path}`,{...init,headers:{...await getAuthHeaders(),...(init.headers||{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data?.error||`API error ${res.status}`);
  return data as T;
}
export async function apiGet<T>(path:string){return request<T>(path);}
export async function apiPost<T>(path:string,body:unknown){return request<T>(path,{method:'POST',body:JSON.stringify(body)});}
export async function apiPut<T>(path:string,body:unknown){return request<T>(path,{method:'PUT',body:JSON.stringify(body)});}
export async function apiDelete<T>(path:string){return request<T>(path,{method:'DELETE'});}

export interface OpenPackResult { success:boolean; card:{name:string;rarity:string;value:number;emoji:string;imageUrl:string|null}; inventoryId:string; newBalance:number; }
export const openPack=(packId:string)=>apiPost<OpenPackResult>('/open-pack',{packId});
export interface UpgraderSpinResult { success:boolean; isWin:boolean; winChance:number; wonCards:Array<{id:string;cardId:string;name:string;rarity:string;value:number;emoji:string;cardImageUrl:string|null}>; newBalance:number; removedCardIds:string[]; }
export const upgraderSpin=(params:{inventoryIds:string[];targetCardIds:string[];useBalance:boolean;addedBalance:number;multiplier:number})=>apiPost<UpgraderSpinResult>('/upgrader/spin',params);
export interface ExchangeResult { success:boolean; removedCardIds:string[]; addedCards:Array<{id:string;cardId:string;cardName:string;rarity:string;value:number;emoji:string;cardImageUrl:string|null;isLocked:boolean}>; refund:number; newBalance:number; }
export const exchangeTrade=(params:{offerInventoryIds:string[];receivePackCardIds:string[]})=>apiPost<ExchangeResult>('/exchanger/trade',params);
export const createBattle=(params:{selectedPackIds:string[];mode:string;playerCount:number;isPublic:boolean;teamMode?:boolean})=>apiPost<any>('/battles/create',params);
export const fetchBattleStateAPI=(battleId:string)=>apiGet<any>(`/battles/state?battleId=${encodeURIComponent(battleId)}`);
export const joinBattle=(battleId:string,teamSide?:'left'|'right')=>apiPost<any>('/battles/join',{battleId,teamSide});
export const resolvePrivateBattleCode=(privateCode:string)=>apiPost<any>('/battles/resolve-code',{privateCode});
export const cancelBattle=(battleId:string)=>apiPost<any>('/battles/cancel',{battleId});
export const addAIOpponent=(battleId:string,aiName?:string)=>apiPost<any>('/battles/add-ai',{battleId,aiName});
export const startBattleCountdown=(battleId:string)=>apiPost<any>('/battles/start-countdown',{battleId});
export const executeBattle=(battleId:string)=>apiPost<any>('/battles/execute', {battleId});
export const adminCancelBattle=(battleId:string)=>apiPost<any>('/battles/admin/cancel',{battleId});
export const submitCashout=(params:any)=>apiPost<any>('/cashout/submit',params);
export const lockCard=(inventoryId:string,isLocked:boolean)=>apiPost<any>('/inventory/lock',{inventoryId,isLocked});
export const favoriteCard=(inventoryId:string,isFavorite:boolean)=>apiPost<any>('/inventory/favorite',{inventoryId,isFavorite});
export const sellCard=(inventoryId:string)=>apiPost<any>('/inventory/sell',{inventoryId});
export const sellAllCards=()=>apiPost<any>('/inventory/sell-all',{});
export const fetchReferrals=(page:number=1)=>apiGet<any>(`/referrals?page=${page}`);
export const fetchProvablyFairOpenings=()=>apiGet<any>('/provably-fair/my-openings');
export const fetchProvablyFairVerify=(openingId:string)=>apiGet<any>(`/provably-fair/verify/${encodeURIComponent(openingId)}`);
export const fetchProvablyFairSeedHistory=()=>apiGet<any>('/provably-fair/seed-history');
export const fetchProvablyFairUpgrades=()=>apiGet<any>('/provably-fair/my-upgrades');
export const fetchProvablyFairVerifyUpgrade=(spinId:string)=>apiGet<any>(`/provably-fair/verify-upgrade/${encodeURIComponent(spinId)}`);
export const fetchAdminSeedStatus=()=>apiGet<any>('/admin/provably-fair/status');
export const adminGenerateSeed=()=>apiPost<any>('/admin/provably-fair/generate-seed',{});
export const adminCompleteRotation=(oldSeed:string)=>apiPost<any>('/admin/provably-fair/complete-rotation',{oldSeed});

export async function dbList<T=any>(collection:string,options:any={}){return apiPost<T[]>(`/compat/db/${encodeURIComponent(collection)}/list`,{options,where:options.where||{}});}
export async function dbGet<T=any>(collection:string,id:string){return apiPost<T|null>(`/compat/db/${encodeURIComponent(collection)}/get`,{id});}
export async function dbCount(collection:string,options:any={}){return apiPost<number>(`/compat/db/${encodeURIComponent(collection)}/count`,{options,where:options.where||{}});}
export async function dbCreate<T=any>(collection:string,data:any){return apiPost<T>(`/compat/db/${encodeURIComponent(collection)}/create`,{data});}
export async function dbUpdate<T=any>(collection:string,id:string,data:any){return apiPost<T>(`/compat/db/${encodeURIComponent(collection)}/update`,{id,data});}
export async function dbDelete<T=any>(collection:string,id:string){return apiPost<T>(`/compat/db/${encodeURIComponent(collection)}/delete`,{id});}
export async function dbUpdateMany<T=any>(collection:string,where:any,data:any){return apiPost<T>(`/compat/db/${encodeURIComponent(collection)}/updateMany`,{where,data});}
export async function dbUpsert<T=any>(collection:string,data:any){return apiPost<T>(`/compat/db/${encodeURIComponent(collection)}/upsert`,{data});}
