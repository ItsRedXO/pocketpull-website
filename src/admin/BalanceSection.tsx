import React, { useState } from 'react';
import { api } from '../lib/api';
import { UserRow } from './types';

export const BalanceSection: React.FC<{user:UserRow;showToast?:(msg:string,ok?:boolean)=>void;onUpdated?:()=>void}> = ({user,showToast,onUpdated}) => {
 const [amount,setAmount]=useState(''); const [busy,setBusy]=useState(false);
 const adjust=async(type:'credit'|'debit')=>{const value=Number(amount);if(!Number.isFinite(value)||value<=0)return showToast?.('Enter a valid amount',false);setBusy(true);try{await api.post('/api/admin/users/'+user.id+'/balance',{type,amount:value});setAmount('');showToast?.('Balance updated');onUpdated?.()}catch(e:any){showToast?.(e?.message||'Balance update failed',false)}finally{setBusy(false)}};
 return <div className="space-y-3"><div className="text-sm text-white/60">Balance: <span className="text-white">${Number(user.balance||0).toFixed(2)}</span></div><div className="flex gap-2"><input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount" className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"/><button disabled={busy} onClick={()=>void adjust('credit')} className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">Credit</button><button disabled={busy} onClick={()=>void adjust('debit')} className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-300">Debit</button></div></div>;
};
