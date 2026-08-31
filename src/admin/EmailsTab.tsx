import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Search, X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { blink } from '../lib/blink';

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

function EmailDetail({ email, onClose }: { email: OutboundEmail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f1a] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#9b5cff]">Email details</p>
            <h2 className="truncate font-display text-xl text-white">{email.subject}</h2>
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

export const EmailsTab: React.FC<{ showToast?: (msg: string, ok?: boolean) => void }> = ({ showToast }) => {
  const [emails, setEmails] = useState<OutboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<OutboundEmail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await blink.db.table<OutboundEmail>('outboundEmails').list({ orderBy: { sentAt: 'desc' }, limit: 500 });
      setEmails(Array.isArray(rows) ? rows : []);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-bold uppercase tracking-widest text-[#9b5cff]">Delivery records</p><h1 className="font-display text-2xl uppercase text-white">Email Center</h1></div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_180px_150px]">
        <label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search recipient or subject" className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-[#9b5cff]/50" /></label>
        <select value={type} onChange={e => setType(e.target.value)} className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/70 outline-none"><option value="">All email types</option>{types.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-white/10 bg-[#141622] px-3 text-xs text-white/70 outline-none"><option value="">All statuses</option><option value="success">Success</option><option value="failure">Failure</option></select>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <div className="hidden grid-cols-[1.2fr_1.7fr_1fr_1.25fr_100px] gap-3 border-b border-white/10 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/35 md:grid"><span>Recipient</span><span>Subject</span><span>Type</span><span>Sent</span><span>Status</span></div>
        {loading ? <div className="p-10 text-center text-sm text-white/35">Loading email records...</div> : filtered.length === 0 ? <div className="p-10 text-center"><Mail className="mx-auto mb-3 text-white/20" size={24} /><p className="text-sm text-white/45">No outbound emails match these filters.</p></div> : filtered.map(email => <button key={email.id} onClick={() => setSelected(email)} className="grid w-full gap-2 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.05] md:grid-cols-[1.2fr_1.7fr_1fr_1.25fr_100px] md:items-center"><span className="truncate text-xs text-white/75">{email.recipient}</span><span className="truncate text-sm text-white">{email.subject}</span><span className="truncate text-[11px] text-[#9b5cff]">{email.emailType}</span><span className="text-[11px] text-white/45">{formatDate(email.sentAt)}</span><span><StatusBadge status={email.status} /></span></button>)}
      </div>
      <p className="text-[11px] text-white/30">Showing {filtered.length} of {emails.length} recorded email attempts. Select a row to inspect its captured content.</p>
      {selected && <EmailDetail email={selected} onClose={() => setSelected(null)} />}
    </section>
  );
};
