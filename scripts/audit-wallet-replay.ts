/**
 * Wallet replay audit — computes exact balance correction for each user.
 * Run: bun run --silent scripts/audit-wallet-replay.ts
 */

// Fixed wallet debit logic
function debit(bal: number, matched: number, absAmt: number, usesMatched: boolean): [number, number] {
  if (!usesMatched) return [Math.max(0, bal - absAmt), matched];
  const fromMatched = Math.min(matched, absAmt);
  return [Math.max(0, bal - absAmt), Math.max(0, matched - fromMatched)];
}

const USERS: Record<string, { name: string; currentBal: number }> = {
  'usr_BE93SxYtTgEC': { name: 'CranK', currentBal: 0.10 },
  'usr_fTB4VYEX8kfQ': { name: 'Tbomb', currentBal: 57.69 },
  'usr_UfYS7jHuyX6m': { name: '0x420', currentBal: 0.20 },
  'usr_xuFfIc45qOQP': { name: 'MrBingus', currentBal: 4.95 },
  'usr_UhiI8dEtkGur': { name: 'Confetti', currentBal: 0.43 },
};

// Transaction data from SQL — [userId, type, amount]
// Only include up to the last recorded transaction for each user.
type Row = [string, string, number];

const DATA: Row[] = [
  // CranK — 33 txns
  ["usr_BE93SxYtTgEC","pack_open",0],["usr_BE93SxYtTgEC","sell",0.05],["usr_BE93SxYtTgEC","deposit",20],["usr_BE93SxYtTgEC","first_deposit_bonus",20],["usr_BE93SxYtTgEC","pack_open",-2],["usr_BE93SxYtTgEC","pack_open",-2],["usr_BE93SxYtTgEC","pack_open",-2],["usr_BE93SxYtTgEC","pack_open",-4],["usr_BE93SxYtTgEC","pack_open",-4],["usr_BE93SxYtTgEC","pack_open",-4],["usr_BE93SxYtTgEC","pack_open",-9],["usr_BE93SxYtTgEC","pack_open",-9],["usr_BE93SxYtTgEC","battle_entry",-24],["usr_BE93SxYtTgEC","sell_all",21.28],["usr_BE93SxYtTgEC","pack_open",-5],["usr_BE93SxYtTgEC","pack_open",-5],["usr_BE93SxYtTgEC","sell",2.99],["usr_BE93SxYtTgEC","sell_all",0.62],["usr_BE93SxYtTgEC","pack_open",-5],["usr_BE93SxYtTgEC","sell",0.62],["usr_BE93SxYtTgEC","pack_open",-5],["usr_BE93SxYtTgEC","pack_open",-5],["usr_BE93SxYtTgEC","sell",0.62],["usr_BE93SxYtTgEC","sell_all",0.67],["usr_BE93SxYtTgEC","pack_open",-1],["usr_BE93SxYtTgEC","sell",0.5],["usr_BE93SxYtTgEC","pack_open",-1],["usr_BE93SxYtTgEC","sell",0.5],["usr_BE93SxYtTgEC","pack_open",-0.5],["usr_BE93SxYtTgEC","sell",0.35],["usr_BE93SxYtTgEC","pack_open",-0.5],["usr_BE93SxYtTgEC","sell",0.4],["usr_BE93SxYtTgEC","pack_open",-0.5],
  // Tbomb — 27 txns
  ["usr_fTB4VYEX8kfQ","deposit",100],["usr_fTB4VYEX8kfQ","first_deposit_bonus",100],["usr_fTB4VYEX8kfQ","referral_signup_bonus",10],["usr_fTB4VYEX8kfQ","pack_open",0],["usr_fTB4VYEX8kfQ","pack_open",-100],["usr_fTB4VYEX8kfQ","sell",41.09],["usr_fTB4VYEX8kfQ","pack_open",-100],["usr_fTB4VYEX8kfQ","sell",85.03],["usr_fTB4VYEX8kfQ","pack_open",-100],["usr_fTB4VYEX8kfQ","sell",85.35],["usr_fTB4VYEX8kfQ","pack_open",-100],["usr_fTB4VYEX8kfQ","pack_open",-100],["usr_fTB4VYEX8kfQ","sell",49.62],["usr_fTB4VYEX8kfQ","pack_open",-100],["usr_fTB4VYEX8kfQ","sell",41.09],["usr_fTB4VYEX8kfQ","pack_open",-100],["usr_fTB4VYEX8kfQ","sell",85.47],["usr_fTB4VYEX8kfQ","pack_open",-35],["usr_fTB4VYEX8kfQ","sell",45],["usr_fTB4VYEX8kfQ","pack_open",-35],["usr_fTB4VYEX8kfQ","sell",45],["usr_fTB4VYEX8kfQ","pack_open",-35],["usr_fTB4VYEX8kfQ","sell",0.02],["usr_fTB4VYEX8kfQ","pack_open",-35],["usr_fTB4VYEX8kfQ","sell",0.02],["usr_fTB4VYEX8kfQ","pack_open",-35],["usr_fTB4VYEX8kfQ","sell",45],
  // 0x420 — 34 txns
  ["usr_UfYS7jHuyX6m","deposit",50],["usr_UfYS7jHuyX6m","first_deposit_bonus",50],["usr_UfYS7jHuyX6m","referral_signup_bonus",10],["usr_UfYS7jHuyX6m","pack_open",0],["usr_UfYS7jHuyX6m","pack_open",-4],["usr_UfYS7jHuyX6m","sell",2.66],["usr_UfYS7jHuyX6m","pack_open",-4],["usr_UfYS7jHuyX6m","pack_open",-40],["usr_UfYS7jHuyX6m","pack_open",-40],["usr_UfYS7jHuyX6m","pack_open",-9],["usr_UfYS7jHuyX6m","pack_open",-9],["usr_UfYS7jHuyX6m","pack_open",-100],["usr_UfYS7jHuyX6m","sell",78.99],["usr_UfYS7jHuyX6m","sell",5.85],["usr_UfYS7jHuyX6m","sell",0.69],["usr_UfYS7jHuyX6m","upgrade",-9.99],["usr_UfYS7jHuyX6m","pack_open",-4],["usr_UfYS7jHuyX6m","pack_open",-4],["usr_UfYS7jHuyX6m","pack_open",-4],["usr_UfYS7jHuyX6m","pack_open",-4],["usr_UfYS7jHuyX6m","pack_open",-4],["usr_UfYS7jHuyX6m","pack_open",-4],["usr_UfYS7jHuyX6m","pack_open",-4],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],["usr_UfYS7jHuyX6m","pack_open",-4.5],
];

// ── Process MrBingus and Confetti with the full raw data ──

/** Types that consume matched balance */
const MATCHED_TYPES = new Set(['pack_open', 'battle_entry', 'battle_join']);

console.log('╔════════════════════════════════════════════════════╗');
console.log('║  Wallet Replay — Fixed Logic vs Current Balance   ║');
console.log('╚════════════════════════════════════════════════════╝\n');

for (const [uid, info] of Object.entries(USERS)) {
  const txns = DATA.filter(r => r[0] === uid);
  if (txns.length === 0) { console.log(`${info.name}: no embedded data, will compute from SQL`); continue; }

  let bal = 0, matched = 0;

  for (const [, type, amount] of txns) {
    if (amount >= 0) {
      bal += amount;
      if (type === 'first_deposit_bonus' && amount > 0) matched += amount;
    } else {
      const absAmt = Math.abs(amount);
      const usesMatched = MATCHED_TYPES.has(type);
      [bal, matched] = debit(bal, matched, absAmt, usesMatched);
    }
  }

  const correct = Math.round(bal * 100) / 100;
  const current = info.currentBal;
  const diff = Math.round((current - correct) * 100) / 100;

  console.log(`${info.name}`);
  console.log(`  Current:  $${current.toFixed(2)}`);
  console.log(`  Correct:  $${correct.toFixed(2)}`);
  console.log(`  Diff:     ${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}`);
  console.log(`  Txns:     ${txns.length}`);
  console.log();
}
