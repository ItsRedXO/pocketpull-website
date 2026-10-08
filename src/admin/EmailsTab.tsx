import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail, Search, X, RefreshCw, CheckCircle, AlertCircle, PenSquare,
  Send, Loader2, Users, UserCheck, UserX, Radio, RotateCcw,
} from 'lucide-react';
import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';

function adminHeaders(): Record<string, string> {
  const adminSecret = typeof window !== 'undefined' ? localStorage.getItem('pocketpull_admin_pass') : null;
  return adminSecret ? { 'X-Admin-Secret': adminSecret } : {};
}

interface OutboundEmail {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  emailType: string;
  sentAt: string;
  status: string;
  providerMessageId?: string | null;
  cashoutId?: string | null;
  errorMessage?: string | null;
  textContent?: string | null;
  htmlContent?: string | null;
}

interface Subscriber {
  id: string;
  email: string;
  username: string;
  email_subscribed: boolean;
  created_at: string;
}

function formatDate(value: string) {
  try { return new Date(value).toLocaleString(); } catch { return value; }
}

function StatusBadge({ status }: { status: string }) {
  const success = status === 'success';
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
      style={{
        color: success ? '#10b981' : '#f87171',
        background: success ? 'rgba(16,185,129,0.12)' : 'rgba(248,113,113,0.12)',
        border: `1px solid ${success ? 'rgba(16,185,129,0.25)' : 'rgba(248,113,113,0.25)'}`,
      }}>
      {success ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
      {status}
    </span>
  );
}

function SubBadge({ subscribed }: { subscribed: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
      style={{
        color: subscribed ? '#10b981' : '#9ca3af',
        background: subscribed ? 'rgba(16,185,129,0.12)' : 'rgba(156,163,175,0.1)',
        border: `1px solid ${subscribed ? 'rgba(16,185,129,0.25)' : 'rgba(156,163,175,0.2)'}`,
      }}>
      {subscribed ? <UserCheck size={11} /> : <UserX size={11} />}
      {subscribed ? 'Subscribed' : 'Unsubscribed'}
    </span>
  );
}

function EmailDetail({ email, onClose }: { email: OutboundEmail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f1a] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9b5cff]">Email details</p>
            <h2 className="truncate font-sans text-xl text-white">{email.subject}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Close email details"><X size={18} /></button>
        </div>
        <div className="max-h-[calc(90vh-76px)] space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <Meta label="Recipient" value={email.recipient} />
            <Meta label="Sender" value={email.sender} />
            <Meta label="Type" value={email.emailType} />
            <Meta label="Sent" value={formatDate(email.sentAt)} />
            <Meta label="Status" value={email.status} />
            {email.providerMessageId && <Meta label="Provider message ID" value={email.providerMessageId} />}
            {email.cashoutId && <Meta label="Cashout ID" value={email.cashoutId} />}
            {email.errorMessage && <Meta label="Error" value={email.errorMessage} />}
          </div>
          {email.textContent && (
            <section>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Plain text</h3>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-white/70">{email.textContent}</pre>
            </section>
          )}
          {email.htmlContent && (
            <section>
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">HTML source</h3>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-5 text-[#00c8ff]/80">{email.htmlContent}</pre>
            </section>
          )}
          {!email.textContent && !email.htmlContent && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/35">No message body was captured for this record.</p>}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-white/5 bg-white/[0.03] p-3"><p className="mb-1 text-[10px] uppercase tracking-wider text-white/35">{label}</p><p className="break-words text-white/75">{value}</p></div>;
}

function ComposeModal({ onClose, onSent, showToast }: { onClose: () => void; onSent: () => void; showToast?: (msg: string, ok?: boolean) => void }) {
  const [mode, setMode] = useState<'specific' | 'broadcast'>('specific');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [subCount, setSubCount] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== 'broadcast' || subCount !== null) return;
    fetch(`${BACKEND_BASE}/admin/emails/subscribers`, { headers: adminHeaders() })
      .then(r => r.json())
      .then(d => { if (typeof d?.subscribed === 'number') setSubCount(d.subscribed); })
      .catch(() => {});
  }, [mode, subCount]);

  const send = async () => {
    if (sending) return;
    if (!subject.trim() || !message.trim()) {
      showToast?.('Subject and message are required', false);
      return;
    }
    if (mode === 'specific' && !to.trim()) {
      showToast?.('Recipient is required', false);
      return;
    }

    setSending(true);
    try {
      const endpoint = mode === 'broadcast'
        ? `${BACKEND_BASE}/admin/emails/broadcast`
        : `${BACKEND_BASE}/admin/emails/send`;
      const payload = mode === 'broadcast'
        ? { subject: subject.trim(), message }
        : { to: to.trim(), subject: subject.trim(), message };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to send (${res.status})`);

      if (mode === 'broadcast') {
        showToast?.(`Broadcast sent — ${data.sent} delivered, ${data.failed} failed`);
      } else {
        showToast?.('Email sent.');
      }
      onSent();
      onClose();
    } catch (error: any) {
      showToast?.(error?.message || 'Failed to send email', false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f1a] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9b5cff]">New message</p>
            <h2 className="font-sans text-xl text-white">Compose Email</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Close compose"><X size={18} /></button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 border-b border-white/10 p-3">
          <button
            onClick={() => setMode('specific')}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${mode === 'specific' ? 'bg-[#9b5cff]/20 text-[#c4a0ff] border border-[#9b5cff]/30' : 'text-white/40 hover:bg-white/5 hover:text-white/70 border border-transparent'}`}
          >
            <Send size={11} className="mr-1.5 inline" />Specific recipients
          </button>
          <button
            onClick={() => setMode('broadcast')}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${mode === 'broadcast' ? 'bg-[#00c8ff]/15 text-[#00c8ff] border border-[#00c8ff]/30' : 'text-white/40 hover:bg-white/5 hover:text-white/70 border border-transparent'}`}
          >
            <Radio size={11} className="mr-1.5 inline" />Broadcast to all
          </button>
        </div>

        <div className="max-h-[calc(90vh-200px)] space-y-3 overflow-y-auto p-5">
          {mode === 'specific' ? (
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">To</span>
              <input value={to} onChange={e => setTo(e.target.value)} placeholder="user@example.com (comma-separate for multiple)" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#9b5cff]/50" />
            </label>
          ) : (
            <div className="rounded-lg border border-[#00c8ff]/20 bg-[#00c8ff]/5 px-4 py-3">
              <p className="text-xs font-bold text-[#00c8ff]">
                <Radio size={12} className="mr-1.5 inline" />
                {subCount === null ? 'Loading subscriber count…' : `Will send to ${subCount.toLocaleString()} subscribed user${subCount !== 1 ? 's' : ''}`}
              </p>
              <p className="mt-1 text-[11px] text-white/40">Each email includes a personal unsubscribe link.</p>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#9b5cff]/50" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/40">Message</span>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your message…" rows={10} className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-[#9b5cff]/50" />
          </label>
          <p className="text-[11px] text-white/30">Sent from support@pocketpulltcg.com via Resend. The message is wrapped in the standard PocketPull TCG email template.</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          <button onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/60 hover:bg-white/10">Cancel</button>
          <button
            onClick={() => void send()}
            disabled={sending}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-40 ${mode === 'broadcast' ? 'border border-[#00c8ff]/25 bg-[#00c8ff]/15 text-[#00c8ff] hover:bg-[#00c8ff]/25' : 'border border-[#9b5cff]/25 bg-[#9b5cff]/15 text-[#c4a0ff] hover:bg-[#9b5cff]/25'}`}
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : mode === 'broadcast' ? <Radio size={13} /> : <Send size={13} />}
            {sending ? (mode === 'broadcast' ? 'Broadcasting…' : 'Sending…') : mode === 'broadcast' ? 'Broadcast' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubscribersView({ showToast }: { showToast?: (msg: string, ok?: boolean) => void }) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all');
  const [resubbing, setResubbing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_BASE}/admin/emails/subscribers`, { headers: adminHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Failed to load (${res.status})`);
      setSubscribers(Array.isArray(data.subscribers) ? data.subscribers : []);
    } catch (error: any) {
      showToast?.(error?.message || 'Failed to load subscribers', false);
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const resubscribe = async (userId: string) => {
    setResubbing(userId);
    try {
      const res = await fetch(`${BACKEND_BASE}/admin/emails/subscribers/${userId}/resubscribe`, {
        method: 'POST',
        headers: adminHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to resubscribe');
      setSubscribers(prev => prev.map(s => s.id === userId ? { ...s, email_subscribed: true } : s));
      showToast?.('User resubscribed.');
    } catch (error: any) {
      showToast?.(error?.message || 'Failed to resubscribe user', false);
    } finally { setResubbing(null); }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return subscribers.filter(s => {
      const matchesQuery = !needle || s.email.toLowerCase().includes(needle) || s.username.toLowerCase().includes(needle);
      const matchesFilter = filter === 'all' || (filter === 'subscribed' ? s.email_subscribed : !s.email_subscribed);
      return matchesQuery && matchesFilter;
    });
  }, [subscribers, query, filter]);

  const totalSub = subscribers.filter(s => s.email_subscribed).length;
  const totalUnsub = subscribers.length - totalSub;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Users size={16} />, label: 'Total with email', value: subscribers.length, color: '#9b5cff' },
          { icon: <UserCheck size={16} />, label: 'Subscribed', value: totalSub, color: '#10b981' },
          { icon: <UserX size={16} />, label: 'Unsubscribed', value: totalUnsub, color: '#9ca3af' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-1 flex items-center gap-1.5" style={{ color: card.color }}>{card.icon}<span className="text-[10px] font-bold uppercase tracking-wider">{card.label}</span></div>
            <p className="text-2xl font-bold text-white">{loading ? '—' : card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid gap-2 md:grid-cols-[1fr_200px]">
        <label className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search email or username" className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-[#9b5cff]/50" />
        </label>
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/70 outline-none">
          <option value="all">All users</option>
          <option value="subscribed">Subscribed only</option>
          <option value="unsubscribed">Unsubscribed only</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="hidden grid-cols-[1.5fr_1.2fr_130px_120px_80px] gap-3 border-b border-white/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/35 md:grid">
          <span>Email</span><span>Username</span><span>Status</span><span>Joined</span><span></span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-white/35">Loading subscribers…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center"><Users className="mx-auto mb-3 text-white/20" size={24} /><p className="text-sm text-white/45">No users match these filters.</p></div>
        ) : filtered.map(sub => (
          <div key={sub.id} className="grid gap-2 border-b border-white/5 px-4 py-3 last:border-b-0 md:grid-cols-[1.5fr_1.2fr_130px_120px_80px] md:items-center">
            <span className="truncate text-xs text-white/75">{sub.email}</span>
            <span className="truncate text-sm text-white">{sub.username}</span>
            <span><SubBadge subscribed={sub.email_subscribed} /></span>
            <span className="text-[11px] text-white/45">{formatDate(sub.created_at)}</span>
            <span>
              {!sub.email_subscribed && (
                <button
                  onClick={() => void resubscribe(sub.id)}
                  disabled={resubbing === sub.id}
                  title="Re-enable subscription"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  {resubbing === sub.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                  Resub
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-white/30">Showing {filtered.length} of {subscribers.length} users with email addresses.</p>
    </div>
  );
}

function mapEmailRow(r: any): OutboundEmail {
  const data = r?.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : {};
  const metadata = r?.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata) ? r.metadata : {};
  return {
    id: String(r?.id || ''),
    recipient: String(r?.recipient || data.recipient || ''),
    sender: String(r?.sender || r?.fromAddress || data.sender || data.fromAddress || 'platform-default'),
    subject: String(r?.subject || data.subject || ''),
    emailType: String(r?.emailType || data.emailType || metadata.emailType || ''),
    sentAt: String(r?.sentAt || data.sentAt || r?.createdAt || ''),
    status: String(r?.status || data.status || 'unknown'),
    providerMessageId: r?.providerMessageId ?? data.providerMessageId ?? metadata.providerMessageId ?? null,
    cashoutId: r?.cashoutId ?? data.cashoutId ?? metadata.cashoutId ?? null,
    errorMessage: r?.errorMessage ?? data.errorMessage ?? metadata.errorMessage ?? null,
    textContent: r?.textContent ?? data.textContent ?? null,
    htmlContent: r?.htmlContent ?? data.htmlContent ?? null,
  };
}

export const EmailsTab: React.FC<{ showToast?: (msg: string, ok?: boolean) => void }> = ({ showToast }) => {
  const [view, setView] = useState<'delivery' | 'subscribers'>('delivery');
  const [emails, setEmails] = useState<OutboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<OutboundEmail | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await blink.db.table('outboundEmails').list({ orderBy: { createdAt: 'desc' }, limit: 500 });
      setEmails(Array.isArray(rows) ? (rows as any[]).map(mapEmailRow) : []);
    } catch (error: any) {
      showToast?.(error?.message || 'Failed to load outbound emails', false);
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const types = useMemo(() => Array.from(new Set(emails.map(e => e.emailType).filter(Boolean))).sort(), [emails]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return emails.filter(email => {
      const matchesQuery = !needle || email.recipient.toLowerCase().includes(needle) || email.subject.toLowerCase().includes(needle);
      return matchesQuery && (!type || email.emailType === type) && (!status || email.status === status);
    });
  }, [emails, query, type, status]);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#9b5cff]">
            {view === 'delivery' ? 'Delivery records' : 'Subscription management'}
          </p>
          <h1 className="font-sans text-2xl uppercase text-white">Email Center</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setComposing(true)} className="inline-flex items-center gap-2 rounded-lg border border-[#9b5cff]/25 bg-[#9b5cff]/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#c4a0ff] hover:bg-[#9b5cff]/25"><PenSquare size={13} /> Compose</button>
          {view === 'delivery' && <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1">
        <button
          onClick={() => setView('delivery')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${view === 'delivery' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          <Mail size={13} />Delivery Records
        </button>
        <button
          onClick={() => setView('subscribers')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${view === 'subscribers' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
        >
          <Users size={13} />Subscribers
        </button>
      </div>

      {/* Views */}
      {view === 'subscribers' ? (
        <SubscribersView showToast={showToast} />
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-[1fr_180px_150px]">
            <label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search recipient or subject" className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-[#9b5cff]/50" /></label>
            <select value={type} onChange={e => setType(e.target.value)} className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/70 outline-none"><option value="">All email types</option>{types.map(item => <option key={item} value={item}>{item}</option>)}</select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/70 outline-none"><option value="">All statuses</option><option value="success">Success</option><option value="failure">Failure</option></select>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="hidden grid-cols-[1.2fr_1.7fr_1fr_1.25fr_100px] gap-3 border-b border-white/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/35 md:grid"><span>Recipient</span><span>Subject</span><span>Type</span><span>Sent</span><span>Status</span></div>
            {loading ? <div className="p-10 text-center text-sm text-white/35">Loading email records…</div> : filtered.length === 0 ? <div className="p-10 text-center"><Mail className="mx-auto mb-3 text-white/20" size={24} /><p className="text-sm text-white/45">No outbound emails match these filters.</p></div> : filtered.map(email => <button key={email.id} onClick={() => setSelected(email)} className="grid w-full gap-2 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.05] md:grid-cols-[1.2fr_1.7fr_1fr_1.25fr_100px] md:items-center"><span className="truncate text-xs text-white/75">{email.recipient}</span><span className="truncate text-sm text-white">{email.subject}</span><span className="truncate text-[11px] text-[#9b5cff]">{email.emailType}</span><span className="text-[11px] text-white/45">{formatDate(email.sentAt)}</span><span><StatusBadge status={email.status} /></span></button>)}
          </div>
          <p className="text-[11px] text-white/30">Showing {filtered.length} of {emails.length} recorded email attempts. Select a row to inspect its captured content.</p>
        </>
      )}

      {selected && <EmailDetail email={selected} onClose={() => setSelected(null)} />}
      {composing && <ComposeModal onClose={() => setComposing(false)} onSent={() => void load()} showToast={showToast} />}
    </section>
  );
};
