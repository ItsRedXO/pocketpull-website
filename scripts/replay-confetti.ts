/**
 * Confetti (usr_UhiI8dEtkGur) — 74 wallet transactions — fixed replay
 */

const debit = (bal: number, matched: number, absAmt: number, usesMatched: boolean): [number, number] => {
  if (!usesMatched) return [Math.max(0, bal - absAmt), matched];
  const fromMatched = Math.min(matched, absAmt);
  return [Math.max(0, bal - absAmt), Math.max(0, matched - fromMatched)];
};
const MATCHED = new Set(['pack_open','battle_entry','battle_join']);

// Confetti txns
const txns: [string, number][] = [
  ["pack_open",0],["sell",0.02],["pack_open",0],["sell",0.02],["deposit",5],
  ["first_deposit_bonus",5],["referral_signup_bonus",10],["pack_open",-3],
  ["pack_open",-3],["pack_open",-3],["pack_open",-0.5],["sell",0.35],
  ["battle_entry",-6],["pack_open",-3],["pack_open",-3],["pack_open",-3],
  ["pack_open",-0.5],["sell",0.4],["sell",1.53],["sell",1.09],["sell",1.53],
  ["sell",1.53],["sell",0.71],["sell",0.31],["sell",0.13],["sell",0.31],
  ["pack_open",-3],["pack_open",-3],["sell",4.1],["sell",6.59],
  ["pack_open",-3],["pack_open",-3],["pack_open",-3],["pack_open",-3],
  ["sell",0.11],["sell",0.21],["sell",0.83],["sell",4.1],["pack_open",-3],
  ["sell",0.21],["sell",5.87],["pack_open",-3],["pack_open",-3],
  ["sell",0.83],["pack_open",-3],["sell",1.53],["sell",5.53],
  ["pack_open",0],["sell",0.02],["pack_open",-3],["pack_open",-3],
  ["sell",2.36],["pack_open",-3],["sell",0.21],["sell",4.99],["sell",6.59],
  ["pack_open",-4],["pack_open",-4],["pack_open",-4],["sell",7.23],
  ["pack_open",-4],["pack_open",-4],["sell",1.85],["sell",1.94],
  ["pack_open",-3],["sell",0.21],["pack_open",0],["sell",0.02],
  ["pack_open",-1],["sell",0.5],["pack_open",-0.5],["sell",0.75],
  ["pack_open",-1],["sell",0.4],
];

let bal = 0, matched = 0;
for (const [type, amt] of txns) {
  if (amt >= 0) {
    bal += amt;
    if (type === 'first_deposit_bonus' && amt > 0) matched += amt;
  } else {
    [bal, matched] = debit(bal, matched, Math.abs(amt), MATCHED.has(type));
  }
}
console.log(JSON.stringify({correct: Math.round(bal * 100) / 100, matched, count: txns.length}));
