import React, { useEffect, useState } from 'react';
import { useAdminAuth } from './useAdminAuth';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';
import { blink } from '../lib/blink';

const Spinner = () => (
  <div className="min-h-screen bg-[#07080e] flex items-center justify-center"
    style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(155,92,255,0.06) 0%, #07080e 60%)' }}>
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-[#9b5cff]/20 border-t-[#9b5cff] animate-spin" />
      <p className="text-white/20 text-[12px] uppercase tracking-widest font-display">Verifying access...</p>
    </div>
  </div>
);

export const AdminApp: React.FC = () => {
  const { isAdmin, isLoading, error, login, logout } = useAdminAuth();
  const [roleVerified, setRoleVerified] = useState<boolean | null>(null);

  // Secondary check: if a normal logged-in user navigates to /admin,
  // check their role from the DB and auto-grant if they're admin.
  useEffect(() => {
    if (isLoading) return;
    if (isAdmin) { setRoleVerified(true); return; }

    // Check if the current Blink auth session belongs to a user with role=admin
    const checkAuthUserRole = async () => {
      try {
        const currentUser = await blink.auth.me();
        if (!currentUser?.id) { setRoleVerified(false); return; }

        const rows = await blink.db.users.list({ where: { id: currentUser.id }, limit: 1 });
        if (rows && rows.length > 0 && (rows[0] as any).role === 'admin') {
          // Auto-grant admin session for this browser session
          sessionStorage.setItem('pp_admin_session', 'true');
          setRoleVerified(true);
        } else {
          setRoleVerified(false);
        }
      } catch {
        setRoleVerified(false);
      }
    };

    checkAuthUserRole();
  }, [isAdmin, isLoading]);

  if (isLoading || roleVerified === null) return <Spinner />;

  // Deny access — show login
  if (!isAdmin && !roleVerified) {
    return <AdminLogin onLogin={login} error={error} />;
  }

  return <AdminDashboard onLogout={logout} />;
};
