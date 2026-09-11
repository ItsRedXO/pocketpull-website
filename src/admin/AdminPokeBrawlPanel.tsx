import React from 'react';
import { BrawlSpeciesTab } from './BrawlSpeciesTab';

export function AdminPokeBrawlPanel({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  return <BrawlSpeciesTab showToast={showToast} />;
}
