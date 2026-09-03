import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, CheckCircle, ChevronLeft, Clock, Loader2, MessageCircle, RefreshCw, Search, Send, Zap } from 'lucide-react';
import { blink } from '../lib/blink';
import { isLatestRequest } from './supportChatRequest';

type Status = 'pending' | 'active' | 'completed' | 'archived';
interface SupportChat { id:string; userId:string; username:string; status:Status|string; subject?:string; lastMessage?:string; lastMessageAt?:string; createdAt:string; updatedAt?:string; }
interface SupportMessage { id:string; chatId:string; userId:string; senderType:'user'|'admin'|string; message:string; createdAt:string; }
const CHANNEL='support-chat';
const META:Record<string,{color:string;icon:React.ReactNode}>={pending:{color:'#f59e0b',icon:<Clock size={11}/>},active:{color:'#10b981',icon:<Zap size={11}/>},completed:{color:'#00c8ff',icon:<CheckCircle size={11}/>},archived:{color:'#777',icon:<Archive size={11}/>} };
const fmt=(v?:string)=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});};

export function SupportChatsTabFixed({showToast}:{showToast:(m:string,ok?:boolean)=>void}){
 const [chats,setChats]=useState<SupportChat[]>([]),[messages,setMessages]=useState<SupportMessage[]>([]),[selected,setSelected]=useState<SupportChat|null>(null),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[reply,setReply]=useState(''),[loading,setLoading]=useState(true),[loadingMessages,setLoadingMessages]=useState(false),[sending,setSending]=useState(false);
 const selectedId=useRef<string|null>(null), requestId=useRef(0), endRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{selectedId.current=selected?.id??null},[selected?.id]);

 const reconcileChats=useCallback(async(initial=false)=>{
  if(initial)setLoading(true);
  try{
   const rows=await blink.db.supportChats.list({orderBy:{lastMessageAt:'desc'},limit:500});
   const next=Array.isArray(rows)?rows as SupportChat[]:[];
   // Keep the rendered list intact while a background request is in flight.
   setChats(prev=>next.length===0&&prev.length?prev:next);
   setSelected(cur=>cur?(next.find(c=>c.id===cur.id)||cur):cur);
  }catch(e:any){if(initial)showToast(e?.message||'Failed to load support chats',false)}finally{if(initial)setLoading(false)}
 },[showToast]);

 const fetchMessages=useCallback(async(chatId:string)=>{
  const id=++requestId.current;setLoadingMessages(true);
  try{
   const rows=await blink.db.supportMessages.list({where:{chatId},orderBy:{createdAt:'asc'},limit:500});
   if(!isLatestRequest(id,requestId.current)||selectedId.current!==chatId)return;
   setMessages(Array.isArray(rows)?rows as SupportMessage[]:[]);
  }catch(e:any){if(isLatestRequest(id,requestId.current)&&selectedId.current===chatId)showToast(e?.message||'Failed to load chat messages',false)}
  finally{if(isLatestRequest(id,requestId.current))setLoadingMessages(false)}
 },[showToast]);

 useEffect(()=>{void reconcileChats(true);const timer=window.setInterval(()=>void reconcileChats(false),15000);return()=>window.clearInterval(timer)},[reconcileChats]);
 useEffect(()=>{
  let mounted=true;let unsub:(()=>void)|null=null;
  void (async()=>{try{unsub=await blink.realtime.subscribe(CHANNEL,(event:any)=>{
   if(!mounted)return;const chatId=event.data?.chatId;if(!chatId)return;
   const msg=event.data?.message as SupportMessage|undefined;
   if((event.type==='new_message'||event.type==='admin_reply')&&msg){
    if(selectedId.current===chatId)setMessages(prev=>prev.some(m=>m.id===msg.id)?prev:[...prev,msg]);
    void reconcileChats(false);
   }
   if(event.type==='chat_status_changed'&&event.data?.status){setChats(prev=>prev.map(c=>c.id===chatId?{...c,status:event.data.status}:c));setSelected(prev=>prev?.id===chatId?{...prev,status:event.data.status}:prev)}
  })}catch{}})();
  return()=>{mounted=false;unsub?.()};
 },[reconcileChats]);
 useEffect(()=>{if(selected)void fetchMessages(selected.id);else{++requestId.current;setMessages([]);setLoadingMessages(false)}},[selected?.id,fetchMessages]);
 useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages]);

 const filtered=useMemo(()=>chats.filter(c=>{const q=search.trim().toLowerCase();return(!q||`${c.username} ${c.subject||''} ${c.lastMessage||''}`.toLowerCase().includes(q))&&(filter==='all'||c.status===filter)}),[chats,search,filter]);
 const counts=useMemo(()=>({pending:chats.filter(c=>c.status==='pending').length,active:chats.filter(c=>c.status==='active').length,completed:chats.filter(c=>c.status==='completed').length,archived:chats.filter(c=>c.status==='archived').length}),[chats]);
 const changeStatus=async(chat:SupportChat,status:Status)=>{try{await blink.db.supportChats.update(chat.id,{status,updatedAt:new Date().toISOString()});setSelected(c=>c?.id===chat.id?{...c,status}:c);setChats(p=>p.map(c=>c.id===chat.id?{...c,status}:c));try{await blink.realtime.publish(CHANNEL,'chat_status_changed',{chatId:chat.id,status})}catch{}showToast(`Chat marked ${status}.`)}catch(e:any){showToast(e?.message||'Status update failed',false)}};
 const sendReply=async()=>{if(!selected||!reply.trim()||sending)return;setSending(true);const text=reply.trim(),now=new Date().toISOString();const msg:SupportMessage={id:`support_msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,chatId:selected.id,userId:selected.userId,senderType:'admin',message:text,createdAt:now};try{await blink.db.supportMessages.create(msg);await blink.db.supportChats.update(selected.id,{status:'active',lastMessage:text,lastMessageAt:now,updatedAt:now});setMessages(p=>p.some(m=>m.id===msg.id)?p:[...p,msg]);setSelected(c=>c?{...c,status:'active',lastMessage:text,lastMessageAt:now}:c);setChats(p=>p.map(c=>c.id===selected.id?{...c,status:'active',lastMessage:text,lastMessageAt:now}:c));setReply('');try{await blink.realtime.publish(CHANNEL,'admin_reply',{chatId:selected.id,message:msg,fromAdmin:true})}catch{}showToast('Reply sent.')}catch(e:any){setReply(text);showToast(e?.message||'Failed to send reply',false)}finally{setSending(false)}};

 return <section className="flex min-h-[calc(100vh-170px)] h-[calc(100vh-170px)] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
  <div className={`${selected?'hidden lg:flex':'flex'} w-full lg:w-80 shrink-0 flex-col border-r border-white/5`}>
   <div className="space-y-2 border-b border-white/5 p-3"><div className="flex gap-2"><label className="relative flex-1"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats" className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-7 pr-2 text-[11px] text-white outline-none"/></label><button onClick={()=>void reconcileChats(true)} disabled={loading} className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/40"><RefreshCw size={12} className={loading?'animate-spin':''}/></button></div><div className="flex flex-wrap gap-1">{[['all','All',chats.length],['pending','Pending',counts.pending],['active','Active',counts.active],['completed','Done',counts.completed],['archived','Archived',counts.archived]].map(([id,label,count])=><button key={String(id)} onClick={()=>setFilter(String(id))} className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" style={{background:filter===id?'rgba(155,92,255,.18)':'transparent',color:filter===id?'#c4a0ff':'#ffffff40'}}>{label} ({count})</button>)}</div></div>
   <div className="flex-1 overflow-y-auto">{loading&&!chats.length?<div className="p-10 text-center"><Loader2 size={16} className="mx-auto animate-spin text-white/30"/></div>:filtered.length===0?<div className="p-10 text-center text-xs text-white/20">No support chats.</div>:filtered.map(chat=>{const meta=META[chat.status]||META.pending;return <button key={chat.id} onClick={()=>{setSelected(chat);if(chat.status==='pending')void changeStatus(chat,'active')}} className="w-full border-b border-white/5 px-4 py-3 text-left hover:bg-white/[0.03]" style={{borderLeft:selected?.id===chat.id?'2px solid #9b5cff':'2px solid transparent',background:selected?.id===chat.id?'rgba(155,92,255,.08)':undefined}}><div className="flex justify-between gap-2"><span className="truncate text-xs font-bold text-white">{chat.username||'User'}</span><span className="text-[9px] text-white/25">{fmt(chat.lastMessageAt||chat.createdAt)}</span></div><p className="mt-1 truncate text-[10px] text-white/35">{chat.lastMessage||chat.subject||'No messages yet'}</p><span className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{color:meta.color,background:`${meta.color}20`}}>{meta.icon}{chat.status}</span></button>})}</div>
  </div>
  <div className={`${selected?'flex':'hidden lg:flex'} min-w-0 flex-1 flex-col`}>{!selected?<div className="flex h-full items-center justify-center text-center"><div><MessageCircle size={36} className="mx-auto mb-3 text-white/10"/><p className="text-sm text-white/20">Select a support chat</p></div></div>:<><div className="flex items-center gap-3 border-b border-white/5 px-4 py-3"><button onClick={()=>setSelected(null)} className="p-2 text-white/40 lg:hidden"><ChevronLeft size={16}/></button><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#9b5cff] to-[#00c8ff] text-sm font-bold text-black">{(selected.username||'U').slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-white">{selected.username}</p><p className="truncate text-[10px] text-white/30">{selected.subject||'No subject'} · {fmt(selected.createdAt)}</p></div><div className="flex gap-1">{(['pending','active','completed','archived'] as Status[]).map(s=><button key={s} onClick={()=>void changeStatus(selected,s)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[9px] font-bold uppercase" style={{color:selected.status===s?META[s].color:'#ffffff35'}}>{s}</button>)}</div></div><div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">{loadingMessages?<div className="flex h-20 items-center justify-center"><Loader2 size={18} className="animate-spin text-white/30"/></div>:messages.length===0?<p className="py-10 text-center text-xs text-white/20">No messages yet.</p>:messages.map(m=><div key={m.id} className={`flex ${m.senderType==='admin'?'justify-end':'justify-start'}`}><div className="max-w-[80%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed" style={m.senderType==='admin'?{background:'linear-gradient(135deg,#9b5cff,#7c3aed)',color:'white'}:{background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.08)',color:'#ddd'}}><p>{m.message}</p><p className="mt-1 text-[9px] opacity-40">{m.senderType==='admin'?'Admin':selected.username} · {fmt(m.createdAt)}</p></div></div>)}<div ref={endRef}/></div><div className="border-t border-white/5 p-3"><div className="flex gap-2"><textarea value={reply} onChange={e=>setReply(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void sendReply()}}} placeholder="Write a reply…" rows={2} className="min-h-10 flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white outline-none"/><button onClick={()=>void sendReply()} disabled={sending||!reply.trim()} className="self-stretch rounded-xl border border-[#9b5cff]/25 bg-[#9b5cff]/15 px-4 text-[#c4a0ff] disabled:opacity-30"><Send size={14}/></button></div><p className="mt-1 text-[9px] text-white/20">Enter to send · Shift+Enter for a new line</p></div></>}</div>
 </section>;
}
