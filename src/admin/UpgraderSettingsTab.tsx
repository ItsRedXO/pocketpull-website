import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { blink } from '../lib/blink';

// API helper
const BACKEND_BASE = 'https://b2nnhe2n.backend.blink.new';

async function fetchSettings() {
  const res = await fetch(`${BACKEND_BASE}/upgrader/settings`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch settings');
  return data.settings as Array<{ multiplier: number; maxChance: number }>;
}

async function saveSettings(settings: Array<{ multiplier: number; maxChance: number }>) {
  const adminSecret = localStorage.getItem('pocketpull_admin_pass') || '';
  const token = await blink.auth.getValidToken();

  const res = await fetch(`${BACKEND_BASE}/admin/upgrader/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': adminSecret,
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ settings })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save settings');
  return data;
}

interface Props {
  showToast?: (msg: string, ok?: boolean) => void;
}

export function UpgraderSettingsTab({ showToast }: Props) {
  const qc = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Array<{ multiplier: number; maxChance: number }>>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { isLoading } = useQuery({
    queryKey: ['upgrader-settings'],
    queryFn: async () => {
      const data = await fetchSettings();
      setLocalSettings(data);
      return data;
    },
    staleTime: Infinity
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => {
      if (showToast) {
        showToast('Upgrader settings saved successfully!');
      } else {
        setSuccessMsg('Settings saved successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
      qc.invalidateQueries({ queryKey: ['upgrader-settings'] });
      qc.invalidateQueries({ queryKey: ['public-upgrader-settings'] });
    },
    onError: (err: any) => {
      if (showToast) {
        showToast(err.message, false);
      } else {
        setErrorMsg(err.message);
        setTimeout(() => setErrorMsg(''), 5000);
      }
    }
  });

  const handleChanceChange = (multiplier: number, val: string) => {
    const num = parseFloat(val);
    setLocalSettings(prev => prev.map(s => 
      s.multiplier === multiplier ? { ...s, maxChance: isNaN(num) ? 0 : num } : s
    ));
  };

  const handleSave = () => {
    // Validation
    const invalid = localSettings.some(s => s.maxChance < 0 || s.maxChance > 75);
    if (invalid) {
      setErrorMsg('Success chance must be between 0% and 75%');
      return;
    }
    mutation.mutate(localSettings);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/20">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm uppercase tracking-widest font-display">Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="font-display text-xl uppercase tracking-wider text-white">Upgrader Settings</h2>
        <p className="text-[11px] text-white/30 mt-0.5">Control the maximum success chance per multiplier</p>
      </div>

      <div className="space-y-4 mb-8">
        {localSettings.map((s) => (
          <div 
            key={s.multiplier}
            className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10"
          >
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">{s.multiplier}x Multiplier</span>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Max success cap</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="75"
                  value={s.maxChance}
                  onChange={(e) => handleChanceChange(s.multiplier, e.target.value)}
                  className="w-24 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00c8ff] transition-all pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">%</span>
              </div>
              
              <div className="w-48 hidden sm:block">
                <input
                  type="range"
                  min="0"
                  max="75"
                  step="0.5"
                  value={s.maxChance}
                  onChange={(e) => handleChanceChange(s.multiplier, e.target.value)}
                  className="w-full accent-[#00c8ff]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle size={14} />
            {errorMsg}
          </div>
        )}
        
        {successMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
            <CheckCircle2 size={14} />
            {successMsg}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-[#00c8ff] text-black font-display font-bold uppercase tracking-widest hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          Save Settings
        </button>
      </div>
    </div>
  );
}
