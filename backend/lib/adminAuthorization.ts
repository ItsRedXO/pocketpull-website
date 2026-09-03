export function isAdminSecretCandidate(secret: string | null | undefined): boolean {
  const value = String(secret ?? '').trim();
  return value.length > 0 && value !== 'true';
}
