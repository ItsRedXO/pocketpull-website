import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blink } from '../lib/blink';

export interface SupportMessage {
  id: string;
  chatId: string;
  userId: string;
  senderType: 'user' | 'admin';
  message: string;
  createdAt: string;
}

export interface SupportChat {
  id: string;
  userId: string;
  username: string;
  status: 'pending' | 'active' | 'completed' | 'archived';
  subject?: string;
  lastMessage?: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export const SUPPORT_CHANNEL = 'support-chat';
export const SUPPORT_CHATS_QUERY_KEY = ['support-chats'];
export const SUPPORT_MESSAGES_QUERY_KEY = ['support-messages'];

function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── USER HOOK ────────────────────────────────────────────────────────────────
export function useUserSupportChat(userId: string | null, username: string, enabled = true) {
  const qc = useQueryClient();
  const [chat, setChat] = useState<SupportChat | null>(null);
  const channelRef = useRef<any>(null);

  const { data: messages = [], isLoading: loading } = useQuery<SupportMessage[]>({
    queryKey: [...SUPPORT_MESSAGES_QUERY_KEY, chat?.id],
    enabled: enabled && !!chat?.id,
    queryFn: async () => {
      if (!chat?.id) return [];
      const rows = await blink.db.supportMessages.list({
        where: { chatId: chat.id },
        orderBy: { createdAt: 'asc' },
        limit: 200,
      });
      return (rows as any[]).map((r: any) => ({
        id: r.id,
        chatId: r.chatId,
        userId: r.userId,
        senderType: r.senderType,
        message: r.message,
        createdAt: r.createdAt,
      }));
    },
    refetchInterval: 10000,
  });

  const loadOrCreateChat = useCallback(async () => {
    if (!userId || !enabled) return;
    try {
      const rows = await blink.db.supportChats.list({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        limit: 1,
      });
      const existing = (rows as any[]).find((r: any) => r.status !== 'archived');
      if (existing) {
        setChat({
          id: existing.id,
          userId: existing.userId,
          username: existing.username,
          status: existing.status as SupportChat['status'],
          subject: existing.subject || '',
          lastMessage: existing.lastMessage || '',
          lastMessageAt: existing.lastMessageAt || existing.createdAt,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt || existing.createdAt,
        });
      }
    } catch (e: any) {
      // Support is optional and must never surface a noisy startup error when
      // the database is rate-limited; chat can retry when the user opens it.
      if (e?.status !== 429 && e?.details?.code !== 'RATE_LIMIT_EXCEEDED') {
        console.warn('loadOrCreateChat failed');
      }
    }
  }, [enabled, userId]);

  const sendMessage = async (text: string) => {
    if (!userId || !enabled || !text.trim()) return;
    let chatId = chat?.id;

    // Create chat if it doesn't exist
    if (!chatId) {
      const newChatId = genId('chat');
      const now = new Date().toISOString();
      await blink.db.supportChats.create({
        id: newChatId,
        userId,
        username,
        status: 'pending',
        subject: text.trim().slice(0, 80),
        lastMessage: text.trim(),
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
      const newChat: SupportChat = {
        id: newChatId,
        userId,
        username,
        status: 'pending',
        subject: text.trim().slice(0, 80),
        lastMessage: text.trim(),
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      };
      setChat(newChat);
      chatId = newChatId;
    }

    const msgId = genId('msg');
    const now = new Date().toISOString();
    const newMsg: SupportMessage = {
      id: msgId,
      chatId,
      userId,
      senderType: 'user',
      message: text.trim(),
      createdAt: now,
    };

    await blink.db.supportMessages.create({
      id: msgId,
      chatId,
      userId,
      senderType: 'user',
      message: text.trim(),
      createdAt: now,
    });

    await blink.db.supportChats.update(chatId, {
      lastMessage: text.trim(),
      lastMessageAt: now,
      updatedAt: now,
      status: chat?.status === 'completed' ? 'active' : (chat?.status ?? 'pending'),
    });

    qc.setQueryData([...SUPPORT_MESSAGES_QUERY_KEY, chatId], (prev: SupportMessage[] | undefined) => [...(prev || []), newMsg]);
    setChat(prev => prev ? { ...prev, lastMessage: text.trim(), lastMessageAt: now } : prev);

    // Publish realtime event for admin
    try {
      await blink.realtime.publish(SUPPORT_CHANNEL, 'new_message', {
        chatId,
        message: newMsg,
        fromUser: true,
      });
    } catch {}
  };

  // Subscribe to realtime for admin replies
  useEffect(() => {
    if (!userId || !enabled) return;
    let unsub: (() => void) | null = null;
    let mounted = true;

    const sub = async () => {
      try {
        unsub = await blink.realtime.subscribe(SUPPORT_CHANNEL, (event: any) => {
          if (!mounted) return;
          
          if (event.type === 'admin_reply' && event.data?.chatId === chat?.id) {
            qc.invalidateQueries({ queryKey: [...SUPPORT_MESSAGES_QUERY_KEY, chat?.id] });
          }
          if (event.type === 'chat_status_changed' && event.data?.chatId === chat?.id) {
            setChat(prev => prev ? { ...prev, status: event.data.status } : prev);
          }
        });
      } catch {}
    };

    sub();
    
    return () => { mounted = false; unsub?.(); };
  }, [enabled, userId, chat?.id, qc]);

  useEffect(() => {
    if (enabled && userId) loadOrCreateChat();
  }, [enabled, userId, loadOrCreateChat]);

  return { chat, messages, loading, sendMessage, loadOrCreateChat };
}

// ── ADMIN HOOK ───────────────────────────────────────────────────────────────
export function useAdminSupportChats() {
  const qc = useQueryClient();

  const { data: chats = [], isLoading: loading, refetch: loadChats } = useQuery<SupportChat[]>({
    queryKey: SUPPORT_CHATS_QUERY_KEY,
    queryFn: async () => {
      const rows = await blink.db.supportChats.list({
        orderBy: { lastMessageAt: 'desc' },
        limit: 200,
      });
      return (rows as any[]).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        username: r.username,
        status: r.status as SupportChat['status'],
        subject: r.subject || '',
        lastMessage: r.lastMessage || '',
        lastMessageAt: r.lastMessageAt || r.createdAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt || r.createdAt,
      }));
    },
    refetchInterval: 15000, // Admin poll every 15s
  });

  const loadChatMessages = async (chatId: string): Promise<SupportMessage[]> => {
    const rows = await blink.db.supportMessages.list({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      limit: 200,
    });
    return (rows as any[]).map((r: any) => ({
      id: r.id,
      chatId: r.chatId,
      userId: r.userId,
      senderType: r.senderType,
      message: r.message,
      createdAt: r.createdAt,
    }));
  };

  const sendAdminReply = async (chatId: string, adminId: string, text: string) => {
    const msgId = genId('msg');
    const now = new Date().toISOString();
    const newMsg: SupportMessage = {
      id: msgId,
      chatId,
      userId: adminId,
      senderType: 'admin',
      message: text.trim(),
      createdAt: now,
    };

    await blink.db.supportMessages.create({
      id: msgId,
      chatId,
      userId: adminId,
      senderType: 'admin',
      message: text.trim(),
      createdAt: now,
    });

    await blink.db.supportChats.update(chatId, {
      lastMessage: text.trim(),
      lastMessageAt: now,
      updatedAt: now,
      status: 'active',
    });

    qc.invalidateQueries({ queryKey: SUPPORT_CHATS_QUERY_KEY });
    qc.invalidateQueries({ queryKey: [...SUPPORT_MESSAGES_QUERY_KEY, chatId] });

    try {
      await blink.realtime.publish(SUPPORT_CHANNEL, 'admin_reply', {
        chatId,
        message: newMsg,
        fromAdmin: true,
      });
    } catch {}

    return newMsg;
  };

  const updateChatStatus = async (chatId: string, status: SupportChat['status']) => {
    const now = new Date().toISOString();
    await blink.db.supportChats.update(chatId, { status, updatedAt: now });
    qc.invalidateQueries({ queryKey: SUPPORT_CHATS_QUERY_KEY });
    try {
      await blink.realtime.publish(SUPPORT_CHANNEL, 'chat_status_changed', {
        chatId,
        status,
      });
    } catch {}
  };

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let mounted = true;

    const sub = async () => {
      try {
        unsub = await blink.realtime.subscribe(SUPPORT_CHANNEL, (event: any) => {
          if (!mounted) return;
          if (event.type === 'new_message' && event.data?.fromUser) {
            qc.invalidateQueries({ queryKey: SUPPORT_CHATS_QUERY_KEY });
          }
        });
      } catch {}
    };

    sub();
    return () => { mounted = false; unsub?.(); };
  }, [qc]);

  return { chats, loading, loadChats, loadChatMessages, sendAdminReply, updateChatStatus };
}
