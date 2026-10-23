import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, LogOut, Shield, ShieldCheck, CheckCircle, AlertCircle, Users, BarChart3, Home, MessageCircle, Banknote, FileText, Mail, Swords, SlidersHorizontal, Ticket, Crown, Star } from 'lucide-react';
import { BACKEND_BASE } from '../lib/backend';
import { getAdminAuthHeaders } from './adminAuthHeaders';
import { PacksTab } from './PacksTab';
import { UsersTab } from './UsersTab';
import { StatsTabFixed } from './StatsTabFixed';
import { SupportChatsTabFixed } from './SupportChatsTabFixed';
import { CashOutsTabFixed } from './CashOutsTabFixed';
import { LogsTabFixed } from './LogsTabFixed';
import { ProvablyFairTab } from './ProvablyFairTab';
import { EmailsTab } from './EmailsTab';
import { AdminPokeBrawlPanel } from './AdminPokeBrawlPanel';
import { SiteSettingsTab } from './SiteSettingsTab';
import { CodesAndDealsTab } from './CodesAndDealsTab';
import { CreatorPayoutsTab } from './CreatorPayoutsTab';

type Tab = 'packs' | 'users' | 'stats' | 'support' | 'cashouts' | 'logs' | 'emails' | 'provably-fair' | 'brawl' | 'site-settings' | 'codes-deals' | 'creator-payouts';
interface Props { onLogout: () => void; }
function useToast() { const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null); const show = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); }; return { toast, show }; }

export const AdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [tab, setTab] = useState<Tab>('packs');
  const { toast, show: showToast } = useToast();
  const [callerRole, setCallerRole] = useState<'owner' | 'admin' | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const h = await getAdminAuthHeaders();
        const r = await fetch(`${BACKEND_BASE}/admin/roles/me`, { headers: h });
        if (r.ok) {
          const j = await r.json();
          setCallerRole(j.role === 'owner' ? 'owner' : 'admin');
        }
      } catch { /* non-critical */ }
    })();
  }, []);
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'packs', label: 'Packs', icon: <Package size={14} /> }, { id: 'users', label: 'Users', icon: <Users size={14} /> }, { id: 'stats', label: 'Stats', icon: <BarChart3 size={14} /> }, { id: 'support', label: 'Support Chats', icon: <MessageCircle size={14} /> }, { id: 'cashouts', label: 'Cash Outs', icon: <Banknote size={14} /> }, { id: 'logs', label: 'Logs', icon: <FileText size={14} /> }, { id: 'emails', label: 'Emails', icon: <Mail size={14} /> }, { id: 'provably-fair', label: 'Provably Fair', icon: <ShieldCheck size={14} /> }, { id: 'brawl', label: 'Poke Brawl', icon: <Swords size={14} /> }, { id: 'site-settings', label: 'Site Settings', icon: <SlidersHorizontal size={14} /> }, { id: 'codes-deals', label: 'Codes and Deals', icon: <Ticket size={14} /> }, { id: 'creator-payouts', label: 'Creator Payouts', icon: <Star size={14} /> },
  ];
  return <div className="min-h-screen text-white" style={{ background: '#111113' }}>
    <header className="sticky top-0 z-30 min-h-14 flex items-center justify-between gap-3 px-3 sm:px-6 py-2 border-b border-white/5" style={{ background: 'rgba(7,8,14,0.96)', backdropFilter: 'blur(20px)' }}><div className="flex items-center gap-2 min-w-0">{callerRole === 'owner' ? <Crown size={17} className="text-red-400 shrink-0" /> : <Shield size={17} className="text-[#9b5cff] shrink-0" />}<span className="font-sans text-xs sm:text-sm uppercase tracking-widest text-white/70 truncate">Admin Panel</span>{callerRole === 'owner' ? (<span className="hidden sm:inline text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}>Owner</span>) : callerRole === 'admin' ? (<span className="hidden sm:inline text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0" style={{ background: 'rgba(155,92,255,0.15)', color: '#9b5cff', border: '1px solid rgba(155,92,255,0.3)' }}>Admin</span>) : (<span className="hidden sm:inline text-[9px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0" style={{ background: 'rgba(155,92,255,0.15)', color: '#9b5cff', border: '1px solid rgba(155,92,255,0.3)' }}>PocketPull TCG</span>)}</div><div className="flex items-center gap-1.5 shrink-0"><button onClick={() => { window.location.href = '/'; }} aria-label="Back to Site" className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider" style={{ color: '#00c8ff', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.2)' }}><Home size={13} /><span className="hidden sm:inline">Back to Site</span></button><button onClick={onLogout} aria-label="Logout" className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider"><LogOut size={13} /><span className="hidden sm:inline">Logout</span></button></div></header>
    <div className="sticky top-14 z-20 border-b border-white/5 px-2 sm:px-6" style={{ background: 'rgba(7,8,14,0.94)', backdropFilter: 'blur(16px)' }}><div className="max-w-[1900px] mx-auto flex gap-1 overflow-x-auto overscroll-x-contain snap-x snap-mandatory" role="tablist">{tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={tab === t.id} className="relative flex items-center gap-1.5 px-3 sm:px-4 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 snap-start" style={{ color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.3)' }}>{t.icon} {t.label}{tab === t.id && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-1 right-1 h-0.5" style={{ background: 'linear-gradient(90deg, #9b5cff, #00c8ff)' }} />}</button>)}</div></div>
    <main className="max-w-[1900px] mx-auto px-3 sm:px-4 py-4 sm:py-6 min-w-0 overflow-x-hidden"><AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>{tab === 'packs' && <PacksTab showToast={showToast} />}{tab === 'users' && <UsersTab showToast={showToast} />}{tab === 'stats' && <StatsTabFixed />}{tab === 'support' && <SupportChatsTabFixed showToast={showToast} />}{tab === 'cashouts' && <CashOutsTabFixed showToast={showToast} />}{tab === 'logs' && <LogsTabFixed />}{tab === 'emails' && <EmailsTab showToast={showToast} />}{tab === 'provably-fair' && <ProvablyFairTab showToast={showToast} />}{tab === 'brawl' && <AdminPokeBrawlPanel showToast={showToast} />}{tab === 'site-settings' && <SiteSettingsTab showToast={showToast} />}{tab === 'codes-deals' && <CodesAndDealsTab showToast={showToast} />}{tab === 'creator-payouts' && <CreatorPayoutsTab showToast={showToast} />}</motion.div></AnimatePresence></main>
    <AnimatePresence>{toast && <motion.div key="toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-xl text-[12px] font-sans z-[200] whitespace-nowrap" style={{ background: toast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(248,113,113,0.15)', border: `1px solid ${toast.ok ? 'rgba(16,185,129,0.4)' : 'rgba(248,113,113,0.4)'}`, color: toast.ok ? '#10b981' : '#f87171', backdropFilter: 'blur(12px)' }}>{toast.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}{toast.msg}</motion.div>}</AnimatePresence>
  </div>;
};
