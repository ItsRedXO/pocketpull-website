import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, ChevronLeft, Send, Loader2, RefreshCw, Search,
  CheckCircle, Archive, Clock, Zap, X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAdminSupportChats } from '../hooks/useSupportChat';
import type { SupportChat, SupportMessage } from '../hooks/useSupportChat';

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString())
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return '—';
  }
}

const STATUS_META: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: '#f59e0b', icon: <Clock size={11} />, label: 'Pending' },
  active: { color: '#10b981', icon: <Zap size={11} />, label: 'Active' },
  completed: { color: '#00c8ff', icon: <CheckCircle size={11} />, label: 'Completed' },
  archived: { color: '#555', icon: <Archive size={11} />, label: 'Archived' },
};

const STATUS_ORDER = ['pending', 'active', 'completed', 'archived'] as const;
type StatusFilter = 'all' | (typeof STATUS_ORDER)[number];

interface ChatListItemProps {
  chat: SupportChat;
  isSelected: boolean;
  onClick: () => void;
}

function ChatListItem({ chat, isSelected, onClick }: ChatListItemProps) {
  const meta = STATUS_META[chat.status];
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 border-b transition-all"
      style={{
        borderColor: 'rgba(255,255,255,0.05)',
        background: isSelected
          ? 'rgba(155,92,255,0.12)'
          : 'transparent',
        borderLeft: isSelected ? '2px solid #9b5cff' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[13px] font-bold text-white truncate leading-tight">
          {chat.username}
        </span>
        <span className="text-[9px] text-white/25 shrink-0 mt-0.5">{formatTime(chat.lastMessageAt)}</span>
      </div>
      <p className="text-[11px] text-white/40 truncate mb-1.5">{chat.lastMessage || chat.subject || '—'}</p>
      <div className="flex items-center gap-1.5">
        <span
          className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: meta.color + '20', color: meta.color }}
        >
          {meta.icon} {meta.label}
        </span>
        {chat.subject && (
          <span className="text-[9px] text-white/20 truncate">{chat.subject}</span>
        )}
      </div>
    </button>
  );
}

export function SupportChatsTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const { user } = useAuth();
  const { chats, loading, loadChats, loadChatMessages, sendAdminReply, updateChatStatus } =
    useAdminSupportChats();
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const openChat = async (chat: SupportChat) => {
    setSelectedChat(chat);
    setLoadingMsgs(true);
    const msgs = await loadChatMessages(chat.id);
    setChatMessages(msgs);
    setLoadingMsgs(false);
    if (chat.status === 'pending') {
      await updateChatStatus(chat.id, 'active');
      setSelectedChat(c => (c ? { ...c, status: 'active' } : c));
      showToast('Chat opened — marked as Active.');
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedChat || !user || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText('');
    try {
      const newMsg = await sendAdminReply(selectedChat.id, user.id, text);
      setChatMessages(prev => [...prev, newMsg]);
      setSelectedChat(c => c ? { ...c, status: 'active' } : c);
      showToast('Reply sent.');
    } catch {
      showToast('Failed to send reply.', false);
    }
    setSending(false);
  };

  const handleStatusChange = async (status: SupportChat['status']) => {
    if (!selectedChat) return;
    try {
      await updateChatStatus(selectedChat.id, status);
      setSelectedChat(c => (c ? { ...c, status } : c));
      showToast(`Chat marked as ${status}.`);
    } catch {
      showToast('Status update failed.', false);
    }
  };

  const filteredChats = chats.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch =
      !search ||
      c.username.toLowerCase().includes(search.toLowerCase()) ||
      (c.lastMessage || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.subject || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = STATUS_ORDER.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: chats.filter(c => c.status === s).length }),
    {}
  );

  return (
    <div className="flex gap-0 min-h-[calc(100vh-170px)] h-[calc(100vh-170px)] rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
      
      {/* ── LEFT: Chat List ── */}
      <div className={`${selectedChat ? 'hidden lg:flex' : 'flex'} w-full lg:w-72 shrink-0 flex-col border-r border-white/5`}>
        {/* Search & refresh */}
        <div className="p-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-white placeholder-white/25 outline-none focus:border-white/20 transition-colors"
              />
            </div>
            <button
              onClick={loadChats}
              disabled={loading}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all disabled:opacity-30"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Status filters */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setStatusFilter('all')}
              className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: statusFilter === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: statusFilter === 'all' ? 'white' : 'rgba(255,255,255,0.3)',
              }}
            >
              All ({chats.length})
            </button>
            {STATUS_ORDER.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: statusFilter === s ? STATUS_META[s].color + '25' : 'transparent',
                  color: statusFilter === s ? STATUS_META[s].color : 'rgba(255,255,255,0.3)',
                }}
              >
                {s} ({counts[s] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {loading && chats.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={16} className="animate-spin text-white/30" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <MessageCircle size={24} className="text-white/10" />
              <p className="text-[11px] text-white/20">No chats found</p>
            </div>
          ) : (
            filteredChats.map(chat => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isSelected={selectedChat?.id === chat.id}
                onClick={() => openChat(chat)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── RIGHT: Chat Detail ── */}
      <div className={`${selectedChat ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-w-0`}>
        {!selectedChat ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <MessageCircle size={36} className="text-white/10" />
            <p className="text-white/20 text-sm">Select a chat to view messages</p>
            <p className="text-white/10 text-[11px]">{chats.length} total chats</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-white/5 flex items-center justify-between gap-2 shrink-0">
              <button onClick={() => { setSelectedChat(null); setChatMessages([]); }} className="lg:hidden p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5" aria-label="Back to chats">
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full shrink-0 bg-gradient-to-br from-[#9b5cff] to-[#00c8ff] flex items-center justify-center text-sm font-bold text-black">
                  {selectedChat.username.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm sm:text-base text-white truncate max-w-[130px] sm:max-w-none">{selectedChat.username}</h3>
                    <span
                      className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{
                        background: STATUS_META[selectedChat.status].color + '20',
                        color: STATUS_META[selectedChat.status].color,
                      }}
                    >
                      {STATUS_META[selectedChat.status].icon}
                      {STATUS_META[selectedChat.status].label}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/30 truncate max-w-[170px] sm:max-w-none">
                    {selectedChat.subject || 'No subject'} · Opened {formatTime(selectedChat.createdAt)}
                  </p>
                </div>
              </div>
              {/* Status controls */}
              <div className="flex gap-1 shrink-0">
                {STATUS_ORDER.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    title={`Mark as ${s}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      background:
                        selectedChat.status === s
                          ? STATUS_META[s].color + '25'
                          : 'rgba(255,255,255,0.04)',
                      color:
                        selectedChat.status === s
                          ? STATUS_META[s].color
                          : 'rgba(255,255,255,0.25)',
                      border: `1px solid ${
                        selectedChat.status === s
                          ? STATUS_META[s].color + '40'
                          : 'rgba(255,255,255,0.08)'
                      }`,
                    }}
                  >
                    {STATUS_META[s].icon}
                    <span className="hidden lg:inline">{s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
            >
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 size={20} className="animate-spin text-white/30" />
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-24">
                  <p className="text-white/20 text-sm">No messages in this chat</p>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${msg.senderType === 'admin' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[65%] px-3 sm:px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                        msg.senderType === 'admin' ? 'text-white' : 'text-gray-200'
                      }`}
                      style={
                        msg.senderType === 'admin'
                          ? { background: 'linear-gradient(135deg, #9b5cff, #7c3aed)' }
                          : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }
                      }
                    >
                      {msg.message}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 px-1">
                      <span className="text-[10px] text-white/25">
                        {msg.senderType === 'admin' ? '🛡 Support' : `👤 ${selectedChat.username}`}
                      </span>
                      <span className="text-white/15 text-[9px]">·</span>
                      <span className="text-[10px] text-white/20">{formatTime(msg.createdAt)}</span>
                    </div>
                  </motion.div>
                ))
              )}
              {sending && (
                <div className="flex justify-end">
                  <div className="px-4 py-2.5 rounded-2xl text-[13px] text-[#9b5cff]"
                    style={{ background: 'rgba(155,92,255,0.15)' }}>
                    <Loader2 size={12} className="animate-spin inline" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <div className="px-5 py-4 border-t border-white/5 shrink-0">
              <div className="flex gap-3 items-end">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReply();
                  }}
                  placeholder="Reply as support... (Ctrl+Enter to send)"
                  disabled={sending}
                  rows={2}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#9b5cff]/40 transition-colors disabled:opacity-50 resize-none"
                />
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim() || sending}
                  className="p-3 rounded-xl text-white transition-all active:scale-95 disabled:opacity-40 shrink-0"
                  style={{ background: 'linear-gradient(135deg, #9b5cff, #00c8ff)' }}
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="text-[10px] text-white/15 mt-1.5">Press Ctrl+Enter to send quickly</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
