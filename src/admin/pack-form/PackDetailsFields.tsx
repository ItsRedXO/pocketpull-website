import React from 'react';
import { Image, Plus } from 'lucide-react';
import { PackDraft } from './types';

interface Props {
  packDraft: PackDraft;
  setPackDraft: React.Dispatch<React.SetStateAction<PackDraft>>;
  imagePreviewError: boolean;
  setImagePreviewError: (val: boolean) => void;
  uploadingImage: boolean;
  handlePackImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  glow: string;
}

export const PackDetailsFields: React.FC<Props> = ({
  packDraft, setPackDraft, imagePreviewError, setImagePreviewError, uploadingImage, handlePackImageUpload, glow
}) => {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/30 mb-3 font-display">Pack Details</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Pack Name *">
          <input value={packDraft.name} onChange={e => setPackDraft(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Fire Pack" className="admin-input" />
        </Field>
        <Field label="Price (USD) *">
          <input type="number" min="0.01" step="0.01" value={packDraft.price}
            onChange={e => setPackDraft(p => ({ ...p, price: e.target.value }))}
            placeholder="2.99" className="admin-input" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea value={packDraft.description}
            onChange={e => setPackDraft(p => ({ ...p, description: e.target.value }))}
            placeholder="Pack description..." rows={2} className="admin-input resize-none" />
        </Field>
        <Field label="Quantity Limit (0 = unlimited)">
          <input type="number" min="0" max="50000" value={packDraft.quantityLimit}
            onChange={e => setPackDraft(p => ({ ...p, quantityLimit: e.target.value }))}
            placeholder="0" className="admin-input" />
        </Field>
        <Field label="Cooldown (Hours, 0 = none)">
          <input type="number" min="0" value={packDraft.cooldownHours}
            onChange={e => setPackDraft(p => ({ ...p, cooldownHours: e.target.value }))}
            placeholder="0" className="admin-input" />
        </Field>
        <Field label="Expiration Date (optional)">
          <input type="datetime-local" value={packDraft.expiresAt}
            onChange={e => setPackDraft(p => ({ ...p, expiresAt: e.target.value }))}
            className="admin-input" />
        </Field>
        <Field label="Sort Order">
          <input type="number" value={packDraft.sortOrder}
            onChange={e => setPackDraft(p => ({ ...p, sortOrder: e.target.value }))}
            className="admin-input" />
        </Field>
        <Field label="Glow Color">
          <div className="flex gap-2 items-center">
            <input type="color" value={packDraft.glowColor}
              onChange={e => setPackDraft(p => ({ ...p, glowColor: e.target.value }))}
              className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent" />
            <input value={packDraft.glowColor}
              onChange={e => setPackDraft(p => ({ ...p, glowColor: e.target.value }))}
              className="admin-input flex-1" placeholder="#00c8ff" />
          </div>
        </Field>
        <Field label="Name Color">
          <div className="flex gap-2 items-center">
            <input type="color" value={packDraft.nameColor}
              onChange={e => setPackDraft(p => ({ ...p, nameColor: e.target.value }))}
              className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent" />
            <input value={packDraft.nameColor}
              onChange={e => setPackDraft(p => ({ ...p, nameColor: e.target.value }))}
              className="admin-input flex-1" placeholder="#ffffff" />
          </div>
        </Field>
        <Field label="Description Color">
          <div className="flex gap-2 items-center">
            <input type="color" value={packDraft.descriptionColor}
              onChange={e => setPackDraft(p => ({ ...p, descriptionColor: e.target.value }))}
              className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent" />
            <input value={packDraft.descriptionColor}
              onChange={e => setPackDraft(p => ({ ...p, descriptionColor: e.target.value }))}
              className="admin-input flex-1" placeholder="#ffffff" />
          </div>
        </Field>
        <Field label="Price Color">
          <div className="flex gap-2 items-center">
            <input type="color" value={packDraft.priceColor}
              onChange={e => setPackDraft(p => ({ ...p, priceColor: e.target.value }))}
              className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent" />
            <input value={packDraft.priceColor}
              onChange={e => setPackDraft(p => ({ ...p, priceColor: e.target.value }))}
              className="admin-input flex-1" placeholder="#ffffff" />
          </div>
        </Field>
        <Field label="Open Button Text Color">
          <div className="flex gap-2 items-center">
            <input type="color" value={packDraft.buttonTextColor}
              onChange={e => setPackDraft(p => ({ ...p, buttonTextColor: e.target.value }))}
              className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent" />
            <input value={packDraft.buttonTextColor}
              onChange={e => setPackDraft(p => ({ ...p, buttonTextColor: e.target.value }))}
              className="admin-input flex-1" placeholder="#ffffff" />
          </div>
        </Field>
        <Field label="Open Another Pack Text Color">
          <div className="flex gap-2 items-center">
            <input type="color" value={packDraft.openAnotherButtonTextColor}
              onChange={e => setPackDraft(p => ({ ...p, openAnotherButtonTextColor: e.target.value }))}
              className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent" />
            <input value={packDraft.openAnotherButtonTextColor}
              onChange={e => setPackDraft(p => ({ ...p, openAnotherButtonTextColor: e.target.value }))}
              className="admin-input flex-1" placeholder="#ffffff" />
          </div>
        </Field>
      </div>

      {/* Pack image */}
      <div className="mt-3">
        <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display block mb-1.5">Pack Image</label>
        <div className="flex gap-3 items-start">
          <div className="w-20 h-24 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${glow}33` }}>
            {packDraft.imageUrl && !imagePreviewError
              ? <img src={packDraft.imageUrl} alt="Pack" className="h-full w-auto object-contain" onError={() => setImagePreviewError(true)} />
              : <Image size={20} className="text-white/20" />}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <input value={packDraft.imageUrl}
              onChange={e => { setPackDraft(p => ({ ...p, imageUrl: e.target.value })); setImagePreviewError(false); }}
              placeholder="https://... or upload below" className="admin-input text-[12px]" />
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-[11px] text-white/50 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)' }}>
              <Plus size={12} /> {uploadingImage ? 'Uploading...' : 'Upload Image'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePackImageUpload} disabled={uploadingImage} />
            </label>
          </div>
        </div>
      </div>

      {/* Active toggle */}
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={() => setPackDraft(p => ({ ...p, isActive: !p.isActive }))}
          className="relative w-10 h-5 rounded-full transition-all duration-200 shrink-0"
          style={{ background: packDraft.isActive ? glow : 'rgba(255,255,255,0.1)' }}
        >
          <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200"
            style={{ left: packDraft.isActive ? '22px' : '2px' }} />
        </button>
        <span className="text-[12px] text-white/50">{packDraft.isActive ? 'Active (visible on site)' : 'Inactive (hidden from site)'}</span>
      </div>
    </section>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display block mb-1.5">{label}</label>
    {children}
  </div>
);
