import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUserStats } from '../hooks/useAuth';
import { useUserSupportChat } from '../hooks/useSupportChat';
import { AdminQuickChat } from './AdminQuickChat';

const QUICK_REPLIES = [
  'How do pack odds work?',
  'Is this provably fair?',
  'How do I deposit?',
  'Card delivery questions',
];

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return formatTime(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + formatTime(iso);
  } catch {
    return '';
  }
}

export const SupportChat: React.FC = React.memo(() => {
  const { user, isLoading: authLoading } = useAuth();
  const { stats } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isDesktop, setIsDesktop] = useState(false);

  // Reliable matchMedia — starts false (mobile-first), never flashes on mobile
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  const isAdmin = stats?.role === 'admin';
  const username = stats?.username || stats?.displayName || user?.displayName || 'Trainer';

  const { chat, messages, loading, sendMessage } = useUserSupportChat(
    isAdmin ? null : (user?.id ?? null),
    username,
    isOpen
  );

  // Listen for footer "Contact Us" tap — works on mobile + desktop
  useEffect(() => {
    const handleOpenSupport = () => {
      setIsOpen(true);
    };
    window.addEventListener('pocketpull-open-support', handleOpenSupport);
    return () => window.removeEventListener('pocketpull-open-support', handleOpenSupport);
  }, []);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Admin gets quick chat overlay
  if (isAdmin) {
    return <AdminQuickChat isOpen={isOpen} setIsOpen={setIsOpen} isDesktop={isDesktop} />;
  }

  const handleSend = async (text: string) => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setInputVal('');
    try {
      await sendMessage(msg);
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  };

  const displayMessages = messages.length === 0
    ? [{
        id: 'init',
        senderType: 'admin' as const,
        message: '👋 Hey Trainer! Need help? Message us here and an admin will respond as soon as possible, usually within minutes or hours.',
        createdAt: new Date().toISOString(),
        chatId: '',
        userId: ''
      }]
    : messages;

  return (
    <>
      {/* Chat panel — fullscreen on mobile, corner widget on desktop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={
              isDesktop
                ? 'fixed bottom-24 right-6 z-[60] w-80 rounded-2xl overflow-hidden flex flex-col'
                : 'fixed inset-0 z-[60] w-full rounded-none overflow-hidden flex flex-col'
            }
            style={{
              background: '#0d0e14',
              border: '1px solid rgba(0,200,255,0.2)',
              boxShadow: '0 0 40px -10px rgba(0,200,255,0.3), 0 20px 60px rgba(0,0,0,0.8)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#00c8ff]/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00c8ff] to-[#9b5cff] flex items-center justify-center text-sm font-display text-black font-bold">
                  PP
                </div>
                <div>
                  <p className="text-sm font-display text-white uppercase tracking-wide">PocketPull Support</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-green-400">Online — Avg 2min reply</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
              >
                <X size={14} />
              </button>
            </div>

            {/* Status badge if chat exists */}
            {chat && (
              <div className="px-4 py-1.5 border-b border-white/5 flex items-center gap-2 shrink-0">
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  chat.status === 'active' ? 'bg-green-400/15 text-green-400' :
                  chat.status === 'completed' ? 'bg-blue-400/15 text-blue-400' :
                  'bg-yellow-400/15 text-yellow-400'
                }`}>
                  {chat.status}
                </span>
                <span className="text-[10px] text-white/20 truncate flex-1">{chat.subject}</span>
              </div>
            )}

            {/* Messages */}
            <div
              className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
              style={{ scrollbarWidth: 'none' }}
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={16} className="animate-spin text-white/30" />
                </div>
              ) : (
                <>
                  {displayMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${msg.senderType === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                          msg.senderType === 'user'
                            ? 'bg-[#00c8ff] text-black font-medium'
                            : 'bg-white/5 border border-white/10 text-gray-300'
                        }`}
                      >
                        {msg.message}
                      </div>
                      <span className="text-[9px] text-white/20 mt-0.5 px-1">
                        {msg.senderType === 'admin' ? '🛡 Support · ' : ''}{formatDate(msg.createdAt)}
                      </span>
                    </motion.div>
                  ))}
                  {sending && (
                    <div className="flex justify-end">
                      <div className="bg-[#00c8ff]/30 px-3 py-2 rounded-xl text-xs text-[#00c8ff]">
                        <Loader2 size={10} className="animate-spin inline" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Not logged in notice */}
            {!authLoading && !user && (
              <div className="px-4 pb-3 text-center shrink-0">
                <p className="text-[10px] text-white/30">Sign in to chat with support</p>
              </div>
            )}

            {/* Quick Replies */}
            {user && messages.length === 0 && (
              <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => handleSend(reply)}
                    className="shrink-0 px-2.5 py-1 rounded-full border border-[#00c8ff]/25 text-[10px] text-[#00c8ff]/70 hover:text-[#00c8ff] hover:border-[#00c8ff]/50 transition-all whitespace-nowrap"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {user && (
              <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-white/5 shrink-0"
                style={{ paddingBottom: isDesktop ? '1rem' : 'calc(1rem + env(safe-area-inset-bottom))' }}
              >
                <input
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(inputVal)}
                  placeholder={chat?.status === 'completed' ? 'Chat completed — send to reopen...' : 'Type a message...'}
                  disabled={sending}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-[#00c8ff]/40 transition-colors disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend(inputVal)}
                  disabled={!inputVal.trim() || sending}
                  className="p-2 rounded-xl bg-[#00c8ff] text-black hover:bg-[#00c8ff]/80 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Send size={12} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button — desktop only, never renders on mobile */}
      {isDesktop && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 2, type: 'spring', stiffness: 200 }}
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center text-black font-bold"
          style={{
            background: 'linear-gradient(135deg, #00c8ff, #9b5cff)',
            boxShadow: '0 0 30px -5px rgba(0,200,255,0.7), 0 8px 24px rgba(0,0,0,0.5)',
          }}
          aria-label="Support Chat"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.span key="x" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <X size={20} />
              </motion.span>
            ) : (
              <motion.span key="msg" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <MessageCircle size={22} />
              </motion.span>
            )}
          </AnimatePresence>
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: 'linear-gradient(135deg, #00c8ff, #9b5cff)', animationDuration: '2.5s' }}
          />
        </motion.button>
      )}
    </>
  );
});
