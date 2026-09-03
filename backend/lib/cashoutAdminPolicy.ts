const NON_RETURNABLE_STATUSES = new Set(['partial', 'shipped', 'completed', 'cancelled', 'returned']);

export function canReturnCashout(status: string | null | undefined): boolean {
  return !NON_RETURNABLE_STATUSES.has(String(status || '').toLowerCase());
}
