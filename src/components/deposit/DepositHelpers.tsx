import React from 'react';

export function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-gray-600">{children}</p>;
}

export function SecurityBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1 text-gray-700">
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}
