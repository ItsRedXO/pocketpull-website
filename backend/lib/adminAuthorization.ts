// Shared guard: the literal 'true' is a legacy UI marker, never an admin credential.
export function isAdminSecretCandidate(secret: string | null | undefined): boolean {
  const value = String(secret ?? '').trim();
  return value.length > 0 && value !== 'true';
}
