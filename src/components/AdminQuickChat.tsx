import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Send, ChevronLeft, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAdminSupportChats, SUPPORT_CHANNEL } from '../hooks/useSupportChat';
import type { SupportChat, SupportMessage } from '../hooks/useSupportChat';
import { blink } from '../lib/blink';

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString())
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return '';
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  active: '#10b981',
  completed: '#00c8ff',
  archived: '#555',
};

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  isDesktop: boolean;
}

export const AdminQuickChat: React.FC<Props> = ({ isOpen, setIsOpen, isDesktop }) => {
  const { user } = useAuth();
  const { chats, loading, loadChats, loadChatMessages, sendAdminReply, updateChatStatus } =
    useAdminSupportChats();
  const [selectedChat, setSelectedChat] = useState<SupportChat | null>(null);
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'active'>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const pendingCount = chats.filter(c => c.status === 'pending').length;

  useEffect(() => {
    if (isOpen) loadChats();
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Realtime messages for the currently open chat
  useEffect(() => {
    if (!selectedChat?.id || !isOpen) return;

    let unsub: (() => void) | null = null;
    let mounted = true;

    const sub = async () => {
      try {
        unsub = await blink.realtime.subscribe(SUPPORT_CHANNEL, (event: any) => {
          if (!mounted) return;
          if (event.type === 'new_message' && event.data?.chatId === selectedChat.id) {
            const msg: SupportMessage = event.data.message;
            setChatMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        });
      } catch (err) {
        console.error('Admin message realtime error', err);
      }
    };

    sub();

    // Polling fallback for messages
    const iv = setInterval(async () => {
      if (mounted) {
        const msgs = await loadChatMessages(selectedChat.id);
        setChatMessages(prev => {
          if (msgs.length === prev.length) return prev;
          return msgs;
        });
      }
    }, 2500);

    return () => {
      mounted = false;
      unsub?.();
      clearInterval(iv);
    };
  }, [selectedChat?.id, isOpen, loadChatMessages]);

  const openChat = async (chat: SupportChat) => {
    setSelectedChat(chat);
    setLoadingMsgs(true);
    const msgs = await loadChatMessages(chat.id);
    setChatMessages(msgs);
    setLoadingMsgs(false);
    if (chat.status === 'pending') {
      await updateChatStatus(chat.id, 'active');
      setSelectedChat(c => (c ? { ...c, status: 'active' } : c));
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedChat || !user || sending) return;
    setSending(true);
    const text = replyText.trim();
    setReplyText('');
    const newMsg = await sendAdminReply(selectedChat.id, user.id, text);
    setChatMessages(prev => [...prev, newMsg]);
    setSending(false);
  };

  const handleStatusChange = async (status: SupportChat['status']) => {
    if (!selectedChat) return;
    await updateChatStatus(selectedChat.id, status);
    setSelectedChat(c => (c ? { ...c, status } : c));
  };

  const filteredChats = chats
    .filter(c => {
      if (filterStatus === 'all') return c.status !== 'archived';
      return c.status === filterStatus;
    })
    .slice(0, 30);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={
              isDesktop
                ? 'fixed bottom-24 right-6 z-50 w-96 rounded-2xl overflow-hidden flex flex-col'
                : 'fixed inset-0 z-[60] w-full rounded-none overflow-hidden flex flex-col'
            }
            style={{
              background: '#0d0e14',
              border: '1px solid rgba(155,92,255,0.3)',
              boxShadow: '0 0 40px -10px rgba(155,92,255,0.4), 0 20px 60px rgba(0,0,0,0.8)',
              height: '480px',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#9b5cff]/5 shrink-0">
              <div className="flex items-center gap-2">
                {selectedChat && (
                  <button
                    onClick={() => { setSelectedChat(null); setChatMessages([]); }}
                    className="p-1 rounded-lg text-white/40 hover:text-white transition-all"
                  >
                    <ChevronLeft size={14} />
                  </button>
                )}
                <Shield size={14} className="text-[#9b5cff]" />
                <span className="text-sm font-display text-white uppercase tracking-wide">
                  {selectedChat ? selectedChat.username : 'Support Chats'}
                </span>
                {!selectedChat && pendingCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-yellow-400/20 text-yellow-400">
                    {pendingCount} pending
                  </span>
                )}
                {selectedChat && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      background: STATUS_COLORS[selectedChat.status] + '20',
                      color: STATUS_COLORS[selectedChat.status],
                    }}
                  >
                    {selectedChat.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {selectedChat && (
                  <button
                    onClick={() => handleStatusChange('completed')}
                    title="Mark completed"
                    className="p-1.5 rounded-lg text-white/30 hover:text-[#00c8ff] transition-all"
                  >
                    <CheckCircle size={13} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* ── LIST VIEW ── */}
            {!selectedChat && (
              <>
                {/* Filter tabs */}
                <div className="flex gap-1 px-3 py-2 border-b border-white/5 shrink-0">
                  {(['all', 'pending', 'active'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                      style={{
                        background:
                          filterStatus === s
                            ? (s === 'all' ? '#10b981' : STATUS_COLORS[s]) + '20'
                            : 'transparent',
                        color:
                          filterStatus === s
                            ? s === 'all'
                              ? '#10b981'
                              : STATUS_COLORS[s]
                            : 'rgba(255,255,255,0.3)',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div
                  className="flex-1 overflow-y-auto"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center h-24">
                      <Loader2 size={16} className="animate-spin text-white/30" />
                    </div>
                  ) : filteredChats.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-white/20 text-sm">
                      No chats
                    </div>
                  ) : (
                    filteredChats.map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => openChat(chat)}
                        className="w-full text-left px-4 py-3 border-b border-white/5 transition-all"
                        style={{ background: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-bold text-white truncate">
                                {chat.username}
                              </span>
                              <span
                                className="text-[8px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
                                style={{
                                  background: STATUS_COLORS[chat.status] + '20',
                                  color: STATUS_COLORS[chat.status],
                                }}
                              >
                                {chat.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/40 truncate mt-0.5">{chat.lastMessage}</p>
                          </div>
                          <span className="text-[9px] text-white/20 shrink-0 mt-0.5">
                            {formatTime(chat.lastMessageAt)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="px-4 py-2 border-t border-white/5 shrink-0 flex justify-between items-center">
                  <span className="text-[10px] text-white/20">
                    {chats.filter(c => c.status !== 'archived').length} active chats
                  </span>
                  <a href="/admin" className="text-[10px] text-[#9b5cff] hover:opacity-80 transition-all">
                    Full Admin Panel →
                  </a>
                </div>
              </>
            )}

            {/* ── CHAT DETAIL ── */}
            {selectedChat && (
              <>
                <div
                  className="flex-1 overflow-y-auto p-3 space-y-2"
                  style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
                >
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center h-24">
                      <Loader2 size={16} className="animate-spin text-white/30" />
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <p className="text-center text-white/20 text-xs py-8">No messages yet</p>
                  ) : (
                    chatMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${msg.senderType === 'admin' ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                            msg.senderType === 'admin'
                              ? 'text-white'
                              : 'border border-white/10 text-gray-300'
                          }`}
                          style={
                            msg.senderType === 'admin'
                              ? { background: 'linear-gradient(135deg, #9b5cff, #7c3aed)' }
                              : { background: 'rgba(255,255,255,0.06)' }
                          }
                        >
                          {msg.message}
                        </div>
                        <span className="text-[9px] text-white/20 mt-0.5 px-1">
                          {msg.senderType === 'admin'
                            ? '🛡 You · '
                            : `${selectedChat.username} · `}
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    ))
                  )}
                  {sending && (
                    <div className="flex justify-end">
                      <div className="px-3 py-2 rounded-xl text-xs text-[#9b5cff]"
                        style={{ background: 'rgba(155,92,255,0.2)' }}>
                        <Loader2 size={10} className="animate-spin inline" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Status controls */}
                <div className="px-3 py-2 border-t border-white/5 flex gap-1.5 shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {(['pending', 'active', 'completed', 'archived'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shrink-0"
                      style={{
                        background:
                          selectedChat.status === s
                            ? STATUS_COLORS[s] + '25'
                            : 'rgba(255,255,255,0.04)',
                        color:
                          selectedChat.status === s
                            ? STATUS_COLORS[s]
                            : 'rgba(255,255,255,0.25)',
                        border: `1px solid ${
                          selectedChat.status === s
                            ? STATUS_COLORS[s] + '40'
                            : 'rgba(255,255,255,0.08)'
                        }`,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {/* Reply Input */}
                <div className="flex items-center gap-2 px-3 pb-3 pt-1 shrink-0">
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleReply()}
                    placeholder="Reply as support..."
                    disabled={sending}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-[#9b5cff]/40 transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || sending}
                    className="p-2 rounded-xl text-white transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #9b5cff, #00c8ff)' }}
                  >
                    <Send size={12} />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button — admin style, desktop only */}
      {isDesktop && (
        <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: 'spring', stiffness: 200 }}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 rounded-full flex items-center justify-center text-white font-bold"
        style={{
          background: 'linear-gradient(135deg, #9b5cff, #00c8ff)',
          boxShadow: '0 0 30px -5px rgba(155,92,255,0.7), 0 8px 24px rgba(0,0,0,0.5)',
        }}
        aria-label="Admin Support Chat"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span key="x" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <X size={20} />
            </motion.span>
          ) : (
            <motion.span key="shield" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Shield size={20} />
            </motion.span>
          )}
        </AnimatePresence>

        {/* Pending badge */}
        {!isOpen && pendingCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 text-black text-[9px] font-bold flex items-center justify-center z-10"
          >
            {pendingCount > 9 ? '9+' : pendingCount}
          </motion.span>
        )}
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: 'linear-gradient(135deg, #9b5cff, #00c8ff)', animationDuration: '2.5s' }}
        />
      </motion.button>
      )}
    </>
  );
};
