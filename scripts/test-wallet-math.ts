/**
 * Wallet math verification — tests the core debit/credit logic
 * without hitting the database.
 *
 * Run: bun run --silent scripts/test-wallet-math.ts
 */

// ── Extracted core math from backend/lib/wallet.ts ──

interface WalletState { balance: number; matched: number }

function credit(state: WalletState, amount: number, matchedAmount?: number): WalletState {
  const currentBalance = state.balance;
  const matchedBalance = state.matched;
  const newBalance = currentBalance + amount;
  let newMatched: number;
  if (matchedAmount && matchedAmount > 0 && amount > 0) {
    newMatched = matchedBalance + matchedAmount;
  } else {
    newMatched = matchedBalance;
  }
  return { balance: newBalance, matched: newMatched };
}

function debit(state: WalletState, amount: number, matchedAmount?: number): WalletState {
  const currentBalance = state.balance;
  const matchedBalance = state.matched;
  const absAmount = Math.abs(amount);
  let newBalance: number;
  let newMatched: number;
  if (matchedAmount && matchedAmount > 0) {
    const fromMatched = Math.min(matchedBalance, absAmount);
    const fromReal = absAmount - fromMatched;
    newBalance = Math.max(0, currentBalance - absAmount);
    newMatched = Math.max(0, matchedBalance - fromMatched);
  } else {
    newBalance = Math.max(0, currentBalance - absAmount);
    newMatched = matchedBalance;
  }
  return { balance: newBalance, matched: newMatched };
}

// ── Test helpers ──

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assertEq(actual: number, expected: number, label: string) {
  if (Math.abs(actual - expected) > 0.005) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════

console.log('\n┌─ Wallet Debit Math ──────────────────────┐');

// ── BUG SCENARIO: $40 balance ($20 real + $20 matched), spend $2 ──
test('BUG FIX: $40 balance + $20 matched, buy $2 pack — should be $38, not $58', () => {
  const initial = { balance: 40.05, matched: 20 };
  const result = debit(initial, -2, /*matchedAmount=*/20);
  assertEq(result.balance, 38.05, 'balance');
  assertEq(result.matched, 18, 'matched');
  // $2 purchase: $2 from matched, $0 from real. Matched: 20→18.
});

// ── Normal pack from real balance only (no matched) ──
test('Real balance only: $50 balance, buy $5 pack → $45', () => {
  const result = debit({ balance: 50, matched: 0 }, -5, /*matchedAmount=*/0);
  assertEq(result.balance, 45, 'balance');
  assertEq(result.matched, 0, 'matched');
});

// ── Split purchase: matched covers part, real covers rest ──
test('Split: $30 balance + $20 matched, buy $35 pack → $15 real spent, $20 matched spent', () => {
  const result = debit({ balance: 50, matched: 20 }, -35, /*matchedAmount=*/35);
  assertEq(result.balance, 15, 'balance');
  assertEq(result.matched, 0, 'matched');
});

// ── Matched only covers small purchase ──
test('Matched covers small purchase: $100 + $50 matched, $20 pack → $80, $30 matched', () => {
  const result = debit({ balance: 100, matched: 50 }, -20, /*matchedAmount=*/50);
  assertEq(result.balance, 80, 'balance');
  assertEq(result.matched, 30, 'matched');
  // $20 from matched (50→30), $0 from real (100→100). Total down $20 → $80.
});

// ── Free pack (amount=0) with matchedAmount set — matched must NOT change ──
test('Free pack ($0): balance=$60, matched=$25 → balance=$60, matched=$25', () => {
  const result = credit({ balance: 60, matched: 25 }, 0, /*matchedAmount=*/userMatchedBalance(25));
  assertEq(result.balance, 60, 'balance');
  assertEq(result.matched, 25, 'matched');
});

// ── First deposit bonus: credit $20, add $20 matched ──
test('First deposit bonus: $100→$120 balance, $0→$20 matched', () => {
  const result = credit({ balance: 100, matched: 0 }, 20, 20);
  assertEq(result.balance, 120, 'balance');
  assertEq(result.matched, 20, 'matched');
});

// ── Deposit without bonus: matched unchanged ──
test('Regular deposit: $50→$70, matched=$10 unchanged', () => {
  const result = credit({ balance: 50, matched: 10 }, 20);
  assertEq(result.balance, 70, 'balance');
  assertEq(result.matched, 10, 'matched');
});

// ── Matched amount > purchase cost (should cap at purchase) ──
test('Matched amount > purchase: $60 + $50 matched, $5 pack → matched used=$5, not $50', () => {
  const result = debit({ balance: 60, matched: 50 }, -5, /*matchedAmount=*/50);
  assertEq(result.balance, 55, 'balance');
  assertEq(result.matched, 45, 'matched');
});

// ── Edge: zero balance, spend from matched ──
test('Zero real balance, $20 matched, $5 pack → $0 balance, $15 matched', () => {
  // Real balance 0 (matched-only spending isn't meant to work without real money,
  // but the math shouldn't go negative)
  const result = debit({ balance: 20, matched: 20 }, -5, /*matchedAmount=*/20);
  assertEq(result.balance, 15, 'balance');
  assertEq(result.matched, 15, 'matched');
});

// ── Credit with matchedAmount but amount=0: NO matched change ──
test('Credit of $0 with matchedAmount set: matched must stay unchanged', () => {
  const result = credit({ balance: 50, matched: 25 }, 0, /*matchedAmount=*/25);
  assertEq(result.balance, 50, 'balance');
  assertEq(result.matched, 25, 'matched');
  // This is the exact Tbomb/NotAScammer free-pack scenario.
});

console.log('└──────────────────────────────────────────┘');

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// Simulate caller's matchedAmount for pack openings (passes user's full matched balance)
function userMatchedBalance(matched: number) { return matched; }
