import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package } from 'lucide-react';
import { blink } from '../../lib/blink';
import { InventoryItem, ShippingForm, CashOutModalProps } from './types';
import { StepDot } from './shared';
import { StepSelectCards } from './StepSelectCards';
import { StepShipping } from './StepShipping';
import { StepReview } from './StepReview';
import { StepSuccess } from './StepSuccess';
import { submitCashout } from '../../lib/api';

export const CashOutModalRoot: React.FC<CashOutModalProps> = ({ isOpen, onClose, userId, username, userEmail }) => {
  const [step, setStep] = useState(1);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  const [selected, setSelected] = useState<InventoryItem[]>([]);
  const [selError, setSelError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState<ShippingForm>({ name: '', address: '', city: '', state: '', zip: '', email: userEmail, phone: '' });
  const [formErrors, setFormErrors] = useState<Partial<ShippingForm>>({});
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idError, setIdError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmationNumber, setConfirmationNumber] = useState('');

  const MAX_CARDS = 25;
  const MIN_VALUE = 25;

  const totalValue = selected.reduce((s, c) => s + c.value, 0);

  // Fetch inventory on open
  useEffect(() => {
    if (!isOpen) { reset(); return; }
    setForm(f => ({ ...f, email: userEmail }));
    setLoadingInv(true);
    blink.db.inventory.list({ where: { userId }, limit: 500 })
      .then((rows: any[]) => {
        const sorted = (Array.isArray(rows) ? rows : [])
          .filter(r => !Number(r.isLocked))
          .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
          .map(r => ({
            id: r.id,
            userId: r.userId,
            cardId: r.cardId,
            cardName: r.cardName,
            rarity: r.rarity,
            value: Number(r.value),
            emoji: r.emoji,
            cardImageUrl: r.cardImageUrl,
            packName: r.packName,
            isFavorite: Boolean(r.isFavorite)
          }));
        setInventory(sorted);
      })
      .catch(() => setInventory([]))
      .finally(() => setLoadingInv(false));
  }, [isOpen, userId, userEmail]);

  const reset = () => {
    setStep(1); setInventory([]); setSelected([]); setSelError('');
    setCurrentPage(1);
    setForm({ name: '', address: '', city: '', state: '', zip: '', email: userEmail, phone: '' });
    setFormErrors({}); setIdFile(null); setIdError('');
    setSubmitting(false); setSubmitError(''); setConfirmationNumber('');
  };

  const close = () => { reset(); onClose(); };

  const toggleCard = (item: InventoryItem) => {
    const isSelected = selected.some(s => s.id === item.id);
    if (isSelected) {
      setSelected(prev => prev.filter(s => s.id !== item.id));
      return;
    }
    if (selected.length >= MAX_CARDS) {
      setSelError(`Maximum ${MAX_CARDS} cards per request.`);
      setTimeout(() => setSelError(''), 2500);
      return;
    }
    setSelError('');
    setSelected(prev => [...prev, item]);
  };

  const validateForm = () => {
    const errs: Partial<ShippingForm> = {};
    if (!form.name.trim()) errs.name = 'Required';
    if (!form.address.trim()) errs.address = 'Required';
    if (!form.city.trim()) errs.city = 'Required';
    if (!form.state.trim()) errs.state = 'Required';
    if (!form.zip.trim()) errs.zip = 'Required';
    if (!form.email.trim()) errs.email = 'Required';
    if (!form.phone.trim()) errs.phone = 'Required';
    setFormErrors(errs);
    if (!idFile) { setIdError('Please upload a photo ID.'); return false; }
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      // 1. Upload ID (storage is fine client-side — not economy-sensitive)
      const ext = idFile!.name.split('.').pop() ?? 'jpg';
      const uploadResult = await blink.storage.upload(idFile!, `cashout-ids/${userId}_${Date.now()}.${ext}`);
      const idImageUrl: string = typeof uploadResult === 'string' ? uploadResult : (uploadResult as { publicUrl: string }).publicUrl;

      // 2. Call backend — server validates ownership, removes cards, creates record, sends email
      const result = await submitCashout({
        inventoryIds: selected.map(c => c.id),
        shipping: {
          name: form.name,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          email: form.email,
          phone: form.phone,
        },
        idImageUrl,
      });

      setConfirmationNumber(result.confirmationNumber);
      setStep(4);
    } catch (err: unknown) {
      setSubmitError((err as Error)?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="cashout-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(4,5,10,0.94)', backdropFilter: 'blur(8px)' }}
        onClick={e => { if (e.target === e.currentTarget && step < 3) close(); }}
      >
        <motion.div
          key="cashout-panel"
          initial={{ opacity: 0, scale: 0.93, y: 28 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-2xl rounded-2xl flex flex-col"
          style={{
            background: 'rgba(7,8,14,0.98)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 0 0 1px rgba(155,92,255,0.07), 0 0 70px -14px rgba(155,92,255,0.22), 0 36px 90px rgba(0,0,0,0.75)',
            maxHeight: '90vh',
          }}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(155,92,255,0.55), rgba(0,200,255,0.4), transparent)' }} />

          {/* Header */}
          <div className="flex items-start justify-between px-7 pt-6 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(155,92,255,0.15)', border: '1px solid rgba(155,92,255,0.3)' }}>
                <Package size={17} style={{ color: '#9b5cff' }} />
              </div>
              <div>
                <h2 className="font-display text-[21px] text-white tracking-wide leading-tight">Cash Out Cards</h2>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  {step === 1 && 'Select cards from your inventory'}
                  {step === 2 && 'Shipping & age verification'}
                  {step === 3 && 'Review & confirm'}
                  {step === 4 && 'Request submitted!'}
                </p>
              </div>
            </div>
            {step <= 2 && (
              <button 
                onClick={close} 
                className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/5 transition-all"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Step indicator */}
          {step < 4 && (
            <div className="flex items-center gap-2 px-7 pb-4 shrink-0">
              {[1, 2, 3].map((n, i) => (
                <React.Fragment key={n}>
                  <StepDot num={n} active={step === n} done={step > n} />
                  {i < 2 && <div className="flex-1 h-px" style={{ background: step > n ? '#10b981' : 'rgba(255,255,255,0.07)' }} />}
                </React.Fragment>
              ))}
              <span className="ml-2 text-[11px] text-gray-600 font-medium">Step {step} of 3</span>
            </div>
          )}

          {/* Scrollable body */}
          <div className="overflow-y-auto px-7 pb-7 flex-1 min-h-0">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <StepSelectCards
                  inventory={inventory}
                  loadingInv={loadingInv}
                  selected={selected}
                  onToggleCard={toggleCard}
                  selError={selError}
                  onContinue={() => setStep(2)}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                />
              )}
              {step === 2 && (
                <StepShipping
                  form={form}
                  onChange={patch => setForm(f => ({ ...f, ...patch }))}
                  errors={formErrors}
                  idFile={idFile}
                  idError={idError}
                  onIdChange={f => { setIdFile(f); setIdError(''); }}
                  onBack={() => setStep(1)}
                  onContinue={() => { if (validateForm()) setStep(3); }}
                />
              )}
              {step === 3 && (
                <StepReview
                  selected={selected}
                  form={form}
                  submitting={submitting}
                  submitError={submitError}
                  onBack={() => setStep(2)}
                  onSubmit={handleSubmit}
                />
              )}
              {step === 4 && (
                <StepSuccess
                  confirmationNumber={confirmationNumber}
                  email={form.email}
                  onClose={close}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
