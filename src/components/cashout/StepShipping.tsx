import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import { ShippingForm } from './types';
import { Label, FieldInput } from './shared';

interface Props {
  form: ShippingForm;
  onChange: (patch: Partial<ShippingForm>) => void;
  errors: Partial<ShippingForm>;
  idFile: File | null;
  idError: string;
  onIdChange: (f: File | null) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const StepShipping: React.FC<Props> = ({
  form, onChange, errors, idFile, idError, onIdChange, onBack, onContinue,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-3"
    >
      <div>
        <Label>Full Legal Name</Label>
        <FieldInput placeholder="Jane Smith" value={form.name} onChange={e => onChange({ name: e.target.value })} error={errors.name} />
      </div>
      <div>
        <Label>Street Address</Label>
        <FieldInput placeholder="123 Main St" value={form.address} onChange={e => onChange({ address: e.target.value })} error={errors.address} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>City</Label>
          <FieldInput placeholder="Springfield" value={form.city} onChange={e => onChange({ city: e.target.value })} error={errors.city} />
        </div>
        <div>
          <Label>State</Label>
          <FieldInput placeholder="IL" value={form.state} onChange={e => onChange({ state: e.target.value })} error={errors.state} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>ZIP Code</Label>
          <FieldInput placeholder="62701" value={form.zip} onChange={e => onChange({ zip: e.target.value })} error={errors.zip} />
        </div>
        <div>
          <Label>Phone Number</Label>
          <FieldInput type="tel" placeholder="+1 555 000 0000" value={form.phone} onChange={e => onChange({ phone: e.target.value })} error={errors.phone} />
        </div>
      </div>
      <div>
        <Label>Email</Label>
        <FieldInput type="email" placeholder="you@example.com" value={form.email} onChange={e => onChange({ email: e.target.value })} error={errors.email} />
      </div>

      {/* ID Upload */}
      <div>
        <Label>Upload ID / Driver's License</Label>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1.5px dashed ${idError ? 'rgba(248,113,113,0.5)' : idFile ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.15)'}`,
            color: idFile ? '#10b981' : '#6b7280',
          }}
        >
          <Upload size={16} style={{ flexShrink: 0 }} />
          <span className="text-sm truncate">{idFile ? idFile.name : 'Click to upload image…'}</span>
        </button>
        <input
          ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { onIdChange(e.target.files?.[0] ?? null); }}
        />
        {idError && <p className="text-[11px] text-red-400 mt-1">{idError}</p>}
        <p className="text-[11px] text-gray-600 mt-2 leading-relaxed">
          We only use your ID to verify you are 18 years or older. This information is not permanently stored after verification.
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-sm text-gray-500 hover:text-gray-300 transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <ChevronLeft size={15} /> Back
        </button>
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
          onClick={onContinue}
          className="flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl font-display text-base uppercase tracking-wide"
          style={{ background: 'linear-gradient(135deg,#9b5cff,#7c3aed)', boxShadow: '0 0 28px -6px rgba(155,92,255,0.55)', color: '#fff' }}
        >
          Review Order <ChevronRight size={16} />
        </motion.button>
      </div>
    </motion.div>
  );
};
