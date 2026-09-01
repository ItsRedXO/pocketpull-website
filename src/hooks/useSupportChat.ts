import { useState,useEffect,useRef,useCallback } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';

export interface SupportMessage{id:string;chatId:string;userId:string;senderType:'user'|'admin';message:string;createdAt:string;}
export interface SupportChat{id:string;userId:string;username:string;status:'pending'|'active'|'completed'|'archived';subject?:string;lastMessage?:string;lastMessageAt:string;createdAt:string;updatedAt:string;}
export const SUPPORT_CHANNEL='support-chat';export const SUPPORT_CHATS_QUERY_KEY=['support-chats'];export const SUPPORT_MESSAGES_QUERY_KEY=['support-messages'];
const API=import.meta.env.VITE_API_BASE_URL||'/api';
async function request<T>(path:string,init:RequestInit={}):Promise<T>{const token=await blink.auth.getValidToken();const r=await fetch(`${API}${path}`,{...init,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(init.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||`API error ${r.status}`);return d as T;}
function genId(prefix:string){return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0,6)}`;}

export function useUserSupportChat(userId:string|null,username:string,enabled=true){
 const qc=useQueryClient();const [chat,setChat]=useState<SupportChat|null>(null);
 const {data:messages=[],isLoading:loading}=useQuery<SupportMessage[]>({queryKey:[...SUPPORT_MESSAGES_QUERY_KEY,chat?.id],enabled:enabled&&!!chat?.id,queryFn:async()=>chat?.id?(await request<{messages:SupportMessage[]}>(`/support/messages?chatId=${encodeURIComponent(chat.id)}`)).messages:[],refetchInterval:10000});
 const loadOrCreateChat=useCallback(async()=>{if(!userId||!enabled)return;try{const d=await request<{chat:SupportChat|null}>('/support/chat');setChat(d.chat);}catch(err){console.warn('[support] load failed',err);}},[enabled,userId]);
 const sendMessage=async(text:string)=>{if(!userId||!enabled||!text.trim())return;const d=await request<{success:boolean;message:SupportMessage}>('/support/send',{method:'POST',body:JSON.stringify({chatId:chat?.id,message:text.trim()})});setChat(prev=>prev?{...prev,lastMessage:text.trim(),lastMessageAt:d.message.createdAt,status:prev.status==='completed'?'active':prev.status}:null);if(!chat){await loadOrCreateChat();}qc.setQueryData([...SUPPORT_MESSAGES_QUERY_KEY,d.message.chatId],(prev:SupportMessage[]|undefined)=>[...(prev||[]),d.message]);try{await blink.realtime.publish(SUPPORT_CHANNEL,'new_message',{chatId:d.message.chatId,message:d.message,fromUser:true});}catch{}};
 useEffect(()=>{if(enabled&&userId)loadOrCreateChat();},[enabled,userId,loadOrCreateChat]);
 useEffect(()=>{if(!userId||!enabled)return;let unsub:(()=>void)|null=null;let mounted=true;(async()=>{try{unsub=await blink.realtime.subscribe(SUPPORT_CHANNEL,(event:any)=>{if(!mounted)return;if(event.type==='admin_reply'&&event.data?.chatId===chat?.id)qc.invalidateQueries({queryKey:[...SUPPORT_MESSAGES_QUERY_KEY,chat?.id]});if(event.type==='chat_status_changed'&&event.data?.chatId===chat?.id)setChat(prev=>prev?{...prev,status:event.data.status}:prev);});}catch{}})();return()=>{mounted=false;unsub?.();};},[enabled,userId,chat?.id,qc]);
 return {chat,messages,loading,sendMessage,loadOrCreateChat};
}

export function useAdminSupportChats(){
 const qc=useQueryClient();
 const {data:chats=[],isLoading:loading,refetch:loadChats}=useQuery<SupportChat[]>({queryKey:SUPPORT_CHATS_QUERY_KEY,queryFn:async()=>(await request<{chats:SupportChat[]}>('/admin/support/chats')).chats,refetchInterval:15000});
 const loadChatMessages=async(chatId:string)=>(await request<{messages:SupportMessage[]}>(`/admin/support/messages?chatId=${encodeURIComponent(chatId)}`)).messages;
 const sendAdminReply=async(chatId:string,adminId:string,text:string)=>{const d=await request<{message:SupportMessage}>('/admin/support/reply',{method:'POST',body:JSON.stringify({chatId,adminId,message:text.trim()})});qc.invalidateQueries({queryKey:SUPPORT_CHATS_QUERY_KEY});qc.invalidateQueries({queryKey:[...SUPPORT_MESSAGES_QUERY_KEY,chatId]});try{await blink.realtime.publish(SUPPORT_CHANNEL,'admin_reply',{chatId,message:d.message,fromAdmin:true});}catch{}return d.message;};
 const updateChatStatus=async(chatId:string,status:SupportChat['status'])=>{await request('/admin/support/status',{method:'POST',body:JSON.stringify({chatId,status})});qc.invalidateQueries({queryKey:SUPPORT_CHATS_QUERY_KEY});try{await blink.realtime.publish(SUPPORT_CHANNEL,'chat_status_changed',{chatId,status});}catch{}};
 useEffect(()=>{let unsub:(()=>void)|null=null;let mounted=true;(async()=>{try{unsub=await blink.realtime.subscribe(SUPPORT_CHANNEL,(event:any)=>{if(mounted&&event.type==='new_message'&&event.data?.fromUser)qc.invalidateQueries({queryKey:SUPPORT_CHATS_QUERY_KEY});});}catch{}})();return()=>{mounted=false;unsub?.();};},[qc]);
 return {chats,loading,loadChats,loadChatMessages,sendAdminReply,updateChatStatus};
}
