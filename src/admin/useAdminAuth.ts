import { useState, useEffect } from 'react';
import { blink } from '../lib/blink';

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

  // ── Login ────────────────────────────────────────────────────────────────────
  // Two paths:
  //   1. admin_credentials table  → dedicated Admin / papiiredd@gmail.com account
  //   2. users table role='admin' → any promoted user (e.g. ItsRedXO) via real Blink auth
  const login = async (usernameOrEmail: string, password: string): Promise<boolean> => {
    setError(null);
    const trimmed = usernameOrEmail.trim();

    try {
      // ── PATH 1: check admin_credentials table (dedicated admin) ──────────────
      const adminRows = await blink.db.adminCredentials.list({});
      if (adminRows && adminRows.length > 0) {
        const adminRow = adminRows.find((r: any) => {
          const rowUsername = (r.username ?? '').toLowerCase();
          const rowEmail = (r.email ?? '').toLowerCase();
          return trimmed.toLowerCase() === rowUsername || trimmed.toLowerCase() === rowEmail;
        }) as any;

        if (adminRow) {
          const storedPass: string = adminRow.adminPass ?? adminRow.admin_pass ?? '';
          if (storedPass === password) {
            setIsAdmin(true);
            sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
            // Save password to localStorage for API calls
            localStorage.setItem('pocketpull_admin_pass', password);
            return true;
          }
          // Username/email matched but password wrong — don't fall through
          setError('Invalid username or password.');
          return false;
        }
      }

      // ── PATH 2: real Blink auth + role check (for promoted users like ItsRedXO)
      let emailToUse = trimmed;

      if (!trimmed.includes('@')) {
        // Resolve username → email
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

      // Authenticate with Blink (real bcrypt comparison)
      await blink.auth.signInWithEmail(emailToUse, password);

      // Fetch the user row to check role
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