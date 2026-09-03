import { useState, useEffect } from 'react';
import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';

const ADMIN_SESSION_KEY = 'pp_admin_session';

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (stored === 'true') setIsAdmin(true);
    setIsLoading(false);
  }, []);

  const login = async (usernameOrEmail: string, password: string): Promise<boolean> => {
    setError(null);
    const trimmed = usernameOrEmail.trim();

    try {
      // Dedicated admin credentials are now validated directly against PostgreSQL.
      // This avoids requiring a Blink user session just to enter the admin portal.
      const adminResponse = await fetch(`${BACKEND_BASE}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: trimmed, password }),
      });
      if (adminResponse.ok) {
        setIsAdmin(true);
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        localStorage.setItem('pocketpull_admin_pass', password);
        return true;
      }

      // Path 2: real Blink auth + PostgreSQL role check for promoted users.
      let emailToUse = trimmed;
      if (!trimmed.includes('@')) {
        const userRows = await blink.db.users.list({ where: { username: trimmed }, limit: 1 });
        if (!userRows || userRows.length === 0) {
          setError('Invalid username or password.');
          return false;
        }
        emailToUse = (userRows[0].email as string) ?? '';
        if (!emailToUse) {
          setError('Invalid username or password.');
          return false;
        }
      }

      await blink.auth.signInWithEmail(emailToUse, password);
      const userRows = await blink.db.users.list({ where: { email: emailToUse }, limit: 1 });
      if (!userRows || userRows.length === 0) {
        await blink.auth.signOut();
        setError('Account not found.');
        return false;
      }

      const userRow = userRows[0] as any;
      if (userRow.role !== 'admin') {
        await blink.auth.signOut();
        setError('Access denied. This account does not have admin privileges.');
        return false;
      }

      setIsAdmin(true);
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      return true;
    } catch (err: any) {
      console.error('Admin login error:', err);
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('verify') || msg.includes('email_not_verified')) {
        setError('Account email not verified. Please verify your email first.');
      } else if (msg.includes('rate') || msg.includes('rate_limited')) {
        setError('Too many attempts. Please wait a moment.');
      } else {
        setError('Invalid username or password.');
      }
      return false;
    }
  };

  const logout = async () => {
    setIsAdmin(false);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem('pocketpull_admin_pass');
    try { await blink.auth.signOut(); } catch { /* ignore */ }
  };

  return { isAdmin, isLoading, error, login, logout };
}
