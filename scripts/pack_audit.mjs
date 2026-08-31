// Pack odds simulation & EV audit
const SIMULATIONS = 100_000;

const packs = {
  "Grass 50/50 ($35)": {
    price: 35, cards: [
      { name: "Mega Venusaur ex", rarity: "god", chance: 0.65, value: 164.64 },
      { name: "Bulbasaur - 166/165", rarity: "god", chance: 7.3, value: 90 },
      { name: "Ivysaur - 167/165", rarity: "secret", chance: 3.8, value: 55 },
      { name: "Venusaur", rarity: "ultra", chance: 18.251, value: 50 },
      { name: "Bulbasaur - 037", rarity: "ultra", chance: 20, value: 40 },
      { name: "Grass Energy", rarity: "common", chance: 50, value: 0.02 },
    ]
  },
  "Water 50/50 ($35)": {
    price: 35, cards: [
      { name: "Kingdra ex - 131", rarity: "god", chance: 0.592, value: 110 },
      { name: "Gyarados - 21/98", rarity: "secret", chance: 9.694, value: 55 },
      { name: "Palafin ex 151/131", rarity: "ultra", chance: 39.714, value: 45 },
      { name: "Water Energy", rarity: "common", chance: 50, value: 0.02 },
    ]
  },
  "Electric 50/50 ($40)": {
    price: 40, cards: [
      { name: "Pikachu & Zekrom GX", rarity: "god", chance: 5, value: 150 },
      { name: "Plusle", rarity: "secret", chance: 10, value: 60 },
      { name: "Minun - 194/182", rarity: "secret", chance: 15, value: 55 },
      { name: "Iono's Bellibolt ex - 183/159", rarity: "ultra", chance: 20, value: 50 },
      { name: "Electric Energy", rarity: "common", chance: 50, value: 0.02 },
    ]
  },
  "Fire 50/50 ($45)": {
    price: 45, cards: [
      { name: "Reshiram EX (95 Full Art)", rarity: "god", chance: 2.5, value: 200 },
      { name: "Mega Emboar ex", rarity: "god", chance: 5, value: 78 },
      { name: "Charmander", rarity: "secret", chance: 7.5, value: 72 },
      { name: "Chandelure", rarity: "ultra", chance: 15, value: 66.34 },
      { name: "Mega Charizard X ex", rarity: "ultra", chance: 20, value: 45 },
      { name: "Fire Energy", rarity: "common", chance: 50, value: 0.02 },
    ]
  },
  "Ultra Pack ($1)": {
    price: 1, cards: [
      { name: "Persian - 078/064", rarity: "god", chance: 0.001, value: 103.2 },
      { name: "Hisuian Growlithe - 181/167", rarity: "god", chance: 0.004, value: 40.62 },
      { name: "Articuno - 161/159", rarity: "god", chance: 0.004, value: 29.31 },
      { name: "Marshadow - 146/132", rarity: "god", chance: 0.003, value: 19.81 },
      { name: "Darumaka - 097/086", rarity: "secret", chance: 0.001, value: 11.97 },
      { name: "Palpitoad - 104/086", rarity: "secret", chance: 0.005, value: 11.99 },
      { name: "Swoobat - 120/086", rarity: "secret", chance: 0.005, value: 10.54 },
      { name: "Pignite - 097/086", rarity: "secret", chance: 0.004, value: 9.25 },
      { name: "Sawk - 130/086", rarity: "ultra", chance: 0.014, value: 8 },
      { name: "Vullaby - 144/086", rarity: "ultra", chance: 0.053, value: 6.31 },
      { name: "Stunfisk - 118/086", rarity: "ultra", chance: 0.119, value: 5.29 },
      { name: "Reshiram ex - 158/086", rarity: "ultra", chance: 0.03, value: 4.21 },
      { name: "Klang - 140/086", rarity: "ultra", chance: 0.025, value: 4.99 },
      { name: "Zekrom ex - 158/086", rarity: "ultra", chance: 0.181, value: 4.88 },
      { name: "Boldore - 128/086", rarity: "ultra", chance: 3.864, value: 4.3 },
      { name: "Harlequin - 163/086", rarity: "rare", chance: 5.285, value: 1.25 },
      { name: "Hydreigon ex - 161/086", rarity: "rare", chance: 4.084, value: 1 },
      { name: "Bouffalant ex - 162/086", rarity: "rare", chance: 9.043, value: 0.85 },
      { name: "Jellicent ex", rarity: "uncommon", chance: 12.909, value: 0.5 },
      { name: "Keldeo ex", rarity: "uncommon", chance: 11.617, value: 0.45 },
      { name: "Bouffalant ex", rarity: "uncommon", chance: 12.357, value: 0.4 },
      { name: "Dewott", rarity: "common", chance: 12.999, value: 0.13 },
      { name: "Scraggy", rarity: "common", chance: 14.391, value: 0.12 },
      { name: "Haban Berry", rarity: "common", chance: 13.002, value: 0.02 },
    ]
  },
  "Master Trainer ($400)": {
    price: 400, cards: [
      { name: "Latias & Latios GX", rarity: "god", chance: 0.025, value: 3000 },
      { name: "Gengar & Mimikyu GX", rarity: "god", chance: 0.023, value: 2200 },
      { name: "Umbreon VMAX", rarity: "god", chance: 0.024, value: 2500 },
      { name: "Umbreon ex - 161/131", rarity: "god", chance: 0.225, value: 1600 },
      { name: "Mega Gengar ex - 284/217", rarity: "god", chance: 0.1, value: 1500 },
      { name: "Pikachu ex (1)", rarity: "god", chance: 0.1, value: 1337.74 },
      { name: "Mew ex", rarity: "secret", chance: 0.1, value: 921.34 },
      { name: "M Charizard EX (1)", rarity: "secret", chance: 0.5, value: 874.58 },
      { name: "Mega Charizard X ex", rarity: "secret", chance: 0.5, value: 874.43 },
      { name: "Charizard GX", rarity: "secret", chance: 3.405, value: 507.23 },
      { name: "Lugia V", rarity: "god", chance: 1.723, value: 486.27 },
      { name: "Pikachu ex (2)", rarity: "secret", chance: 1.712, value: 469.36 },
      { name: "Charizard ex (1)", rarity: "secret", chance: 1.712, value: 443.51 },
      { name: "Charizard V (1)", rarity: "god", chance: 1.712, value: 351.89 },
      { name: "Pikachu ex (3)", rarity: "secret", chance: 8.424, value: 336.45 },
      { name: "Charizard ex (2)", rarity: "secret", chance: 3.5, value: 333.99 },
      { name: "M Charizard EX (2)", rarity: "secret", chance: 9.212, value: 297.92 },
      { name: "M Charizard EX (3)", rarity: "secret", chance: 6.5, value: 295.57 },
      { name: "Charizard EX", rarity: "secret", chance: 12, value: 238.95 },
      { name: "Pikachu & Zekrom GX", rarity: "secret", chance: 7.5, value: 216.69 },
      { name: "Pikachu VMAX", rarity: "secret", chance: 10, value: 203.94 },
      { name: "Charizard VMAX", rarity: "secret", chance: 15.5, value: 149.19 },
      { name: "Charizard ex (3)", rarity: "secret", chance: 15.5, value: 139.59 },
    ]
  },
  "Crown Pack ($9)": {
    price: 9, cards: [
      { name: "Bulbasaur", rarity: "god", chance: 0.023, value: 133.42 },
      { name: "Squirtle", rarity: "god", chance: 0.002, value: 120.6 },
      { name: "Dachsbun ex (god)", rarity: "secret", chance: 0.005, value: 81.31 },
      { name: "Terapagos ex (god)", rarity: "secret", chance: 0.004, value: 64.35 },
      { name: "Hydrapple ex (god)", rarity: "secret", chance: 0.009, value: 37.14 },
      { name: "Galvantula ex", rarity: "secret", chance: 0.027, value: 19.26 },
      { name: "Lacey (god)", rarity: "secret", chance: 0.018, value: 18.98 },
      { name: "Milcery", rarity: "rare", chance: 0.11, value: 18.99 },
      { name: "Zeraora", rarity: "rare", chance: 0.093, value: 14.27 },
      { name: "Crispin", rarity: "ultra", chance: 1.278, value: 14.25 },
      { name: "Area Zero Underdepths", rarity: "ultra", chance: 0.122, value: 11.05 },
      { name: "Briar", rarity: "ultra", chance: 0.791, value: 12.93 },
      { name: "Gulpin", rarity: "rare", chance: 1.24, value: 12.84 },
      { name: "Terapagos ex", rarity: "rare", chance: 2.372, value: 11.38 },
      { name: "Raboot", rarity: "rare", chance: 2.615, value: 8.42 },
      { name: "Lileep", rarity: "rare", chance: 4.078, value: 8.34 },
      { name: "Joltik", rarity: "rare", chance: 1.484, value: 7.85 },
      { name: "Meditite", rarity: "rare", chance: 5.126, value: 7.81 },
      { name: "Ledian", rarity: "rare", chance: 4.72, value: 6.26 },
      { name: "Lapras ex", rarity: "rare", chance: 8.147, value: 5.99 },
      { name: "Bravery Charm", rarity: "rare", chance: 5.703, value: 5.35 },
      { name: "Turtonator", rarity: "rare", chance: 8.243, value: 4.4 },
      { name: "Blastoise ex", rarity: "rare", chance: 7.086, value: 4.25 },
      { name: "Dachsbun ex", rarity: "rare", chance: 7.33, value: 4.18 },
      { name: "Archaludon", rarity: "rare", chance: 11.972, value: 3.77 },
      { name: "Hydrapple ex", rarity: "rare", chance: 9.374, value: 3.22 },
      { name: "Cinderace ex", rarity: "rare", chance: 9.29, value: 3.68 },
      { name: "Lacey", rarity: "rare", chance: 8.975, value: 2.89 },
    ]
  },
  "Rivals Pack ($9)": {
    price: 9, cards: [
      { name: "Team Rocket's Mewtwo ex (1)", rarity: "secret", chance: 0.032, value: 565.86 },
      { name: "Cynthia's Garchomp ex", rarity: "secret", chance: 0.003, value: 290.89 },
      { name: "Ethan's Ho-Oh ex (1)", rarity: "secret", chance: 0.037, value: 174.19 },
      { name: "Team Rocket's Nidoking ex", rarity: "secret", chance: 0.003, value: 125.27 },
      { name: "Team Rocket's Moltres ex", rarity: "secret", chance: 0.0029, value: 125.13 },
      { name: "Misty's Psyduck", rarity: "secret", chance: 0.042, value: 82.52 },
      { name: "Team Rocket's Crobat ex", rarity: "secret", chance: 0.09, value: 76.12 },
      { name: "Team Rocket's Mewtwo ex (2)", rarity: "secret", chance: 0.163, value: 72.58 },
      { name: "Team Rocket's Meowth", rarity: "secret", chance: 1.002, value: 31.37 },
      { name: "Misty's Lapras", rarity: "secret", chance: 0.048, value: 42.71 },
      { name: "Team Rocket's Giovanni", rarity: "ultra", chance: 0.966, value: 36.61 },
      { name: "Hydrapple", rarity: "ultra", chance: 4.093, value: 4.42 },
      { name: "Rapidash", rarity: "ultra", chance: 1.326, value: 10.14 },
      { name: "Cynthia's Roserade", rarity: "rare", chance: 2.561, value: 17.18 },
      { name: "Shaymin", rarity: "rare", chance: 2.289, value: 13.66 },
      { name: "Team Rocket's Spidops", rarity: "rare", chance: 3.933, value: 7.18 },
      { name: "Team Rocket's Moltres ex", rarity: "rare", chance: 4.881, value: 5.85 },
      { name: "Ethan's Ho-Oh ex (2)", rarity: "rare", chance: 5.274, value: 5.73 },
      { name: "Team Rocket's Ariana", rarity: "rare", chance: 4.184, value: 6.31 },
      { name: "Clamperl", rarity: "rare", chance: 6.639, value: 5.38 },
      { name: "Zamazenta", rarity: "rare", chance: 7.582, value: 5.27 },
      { name: "Yanma", rarity: "rare", chance: 7.582, value: 5.23 },
      { name: "Rotom", rarity: "rare", chance: 6.148, value: 5.07 },
      { name: "Emcee's Hype", rarity: "rare", chance: 6.506, value: 2.21 },
      { name: "Cetitan ex", rarity: "rare", chance: 10.032, value: 1.43 },
      { name: "Arven's Mabosstiff ex", rarity: "rare", chance: 9.084, value: 2 },
      { name: "Dondozo ex", rarity: "rare", chance: 7.776, value: 1.12 },
      { name: "Regirock ex", rarity: "rare", chance: 7.776, value: 1.16 },
    ]
  },
  "Mythic Trainer ($100)": {
    price: 100, cards: [
      { name: "Mega Gengar ex - 284/217", rarity: "god", chance: 0.017, value: 1500 },
      { name: "Pikachu with Grey Felt Hat", rarity: "god", chance: 0.036, value: 990.25 },
      { name: "Gengar VMAX", rarity: "god", chance: 0.018, value: 891.81 },
      { name: "Giratina V", rarity: "god", chance: 0.015, value: 827.7 },
      { name: "Mega Dragonite ex", rarity: "god", chance: 0.03, value: 830.31 },
      { name: "Gengar EX", rarity: "god", chance: 0.14, value: 719.55 },
      { name: "Mewtwo GX", rarity: "god", chance: 0.025, value: 635.8 },
      { name: "Palkia EX", rarity: "god", chance: 0.025, value: 545.13 },
      { name: "Dragonite V", rarity: "god", chance: 0.157, value: 492.73 },
      { name: "Blastoise & Piplup GX", rarity: "god", chance: 0.167, value: 432.48 },
      { name: "Kyogre EX", rarity: "secret", chance: 2.079, value: 112.39 },
      { name: "Team Aqua's Kyogre EX", rarity: "god", chance: 0.1, value: 390 },
      { name: "Galarian Moltres V", rarity: "secret", chance: 1.579, value: 214.18 },
      { name: "Charizard VSTAR", rarity: "secret", chance: 3.745, value: 92.3 },
      { name: "Galarian Rapidash V", rarity: "secret", chance: 6.216, value: 85.47 },
      { name: "Garchomp V", rarity: "secret", chance: 7.318, value: 85.35 },
      { name: "Marnie's Grimmsnarl ex", rarity: "secret", chance: 7.092, value: 85.03 },
      { name: "Mimikyu", rarity: "ultra", chance: 8.421, value: 79.5 },
      { name: "Morty's Conviction", rarity: "ultra", chance: 6.435, value: 78.99 },
      { name: "Mimikyu VMAX", rarity: "ultra", chance: 3.92, value: 77.32 },
      { name: "Zoroark", rarity: "ultra", chance: 3.92, value: 63.3 },
      { name: "Lucario & Melmetal GX", rarity: "ultra", chance: 6.951, value: 59.94 },
      { name: "Gholdengo ex", rarity: "ultra", chance: 7.96, value: 49.62 },
      { name: "Steelix", rarity: "rare", chance: 6.166, value: 41.09 },
      { name: "Tinkatuff", rarity: "rare", chance: 2.578, value: 38.81 },
      { name: "Ethan's Typhlosion", rarity: "rare", chance: 7.96, value: 33.86 },
      { name: "Tepig", rarity: "rare", chance: 8.97, value: 32.36 },
      { name: "Tirtouga", rarity: "rare", chance: 7.96, value: 29.85 },
    ]
  },
  "Water Trainer ($3)": {
    price: 3, cards: [
      { name: "Blastoise & Piplup GX", rarity: "god", chance: 0.021, value: 429.5 },
      { name: "Squirtle", rarity: "god", chance: 0.081, value: 119.85 },
      { name: "Gyarados GX (1)", rarity: "secret", chance: 0.085, value: 68.98 },
      { name: "Gyarados GX (2)", rarity: "secret", chance: 0.136, value: 26.05 },
      { name: "Gyarados V", rarity: "ultra", chance: 0.7176, value: 18.41 },
      { name: "Veluza", rarity: "ultra", chance: 0.245, value: 10.55 },
      { name: "Tympole", rarity: "ultra", chance: 0.206, value: 9.8 },
      { name: "Simipour", rarity: "ultra", chance: 2.66, value: 6.59 },
      { name: "Manaphy", rarity: "rare", chance: 3.01, value: 6.54 },
      { name: "Gyarados GX (3)", rarity: "rare", chance: 3.8525, value: 5.91 },
      { name: "Empoleon V", rarity: "rare", chance: 2.758, value: 5.87 },
      { name: "Lapras V", rarity: "rare", chance: 2.473, value: 5.53 },
      { name: "Palkia GX", rarity: "rare", chance: 1.989, value: 5.2 },
      { name: "Dewgong", rarity: "uncommon", chance: 4.057, value: 4.99 },
      { name: "Wishiwashi GX", rarity: "uncommon", chance: 15.989, value: 2.36 },
      { name: "Inteleon VMAX", rarity: "uncommon", chance: 17.065, value: 1.53 },
      { name: "Lumineon V", rarity: "uncommon", chance: 13.067, value: 0.83 },
      { name: "Lapras", rarity: "common", chance: 15.065, value: 0.21 },
      { name: "Magikarp", rarity: "common", chance: 17.066, value: 0.11 },
    ]
  },
  "Small Pack ($0.50)": {
    price: 0.50, cards: [
      { name: "Eevee - 188/167", rarity: "god", chance: 0.001, value: 104.99 },
      { name: "Mega Latias ex - 181/132", rarity: "god", chance: 0.002, value: 96.81 },
      { name: "Mega Absol ex - 180/132", rarity: "god", chance: 0.014, value: 74 },
      { name: "Acerola's Mischief - 183/132", rarity: "god", chance: 0.002, value: 38.28 },
      { name: "Team Rocket's Ariana - 224/182", rarity: "secret", chance: 0.008, value: 7 },
      { name: "Zamazenta - 201/182", rarity: "secret", chance: 0.008, value: 5 },
      { name: "Hop's Wooloo - 170/159", rarity: "rare", chance: 0.045, value: 4 },
      { name: "Lycanroc - 166/159", rarity: "rare", chance: 0.144, value: 3 },
      { name: "Iono's Bellibolt ex - 172/159", rarity: "rare", chance: 0.136, value: 3 },
      { name: "Salamence ex - 177/159", rarity: "rare", chance: 0.058, value: 2.5 },
      { name: "Emcee's Hype - 220/182", rarity: "ultra", chance: 0.087, value: 2 },
      { name: "Empoleon ex - 114/094", rarity: "ultra", chance: 0.121, value: 2 },
      { name: "Arven's Mabosstiff ex - 218/182", rarity: "ultra", chance: 0.168, value: 1.75 },
      { name: "Nymble - 096/094", rarity: "ultra", chance: 0.128, value: 1.5 },
      { name: "Oricorio ex - 110/094", rarity: "ultra", chance: 0.282, value: 1.25 },
      { name: "Firebreather - 119/094", rarity: "ultra", chance: 0.138, value: 1 },
      { name: "Mega Lopunny ex - 084/094", rarity: "uncommon", chance: 6.55, value: 0.75 },
      { name: "Mega Heracross ex - 004/094", rarity: "uncommon", chance: 8.818, value: 0.5 },
      { name: "Mandibuzz ex", rarity: "uncommon", chance: 17.562, value: 0.4 },
      { name: "Charmander - ME02", rarity: "uncommon", chance: 21.906, value: 0.35 },
      { name: "Larry's Braviary - ME", rarity: "common", chance: 17.562, value: 0.05 },
      { name: "Drampa - ME", rarity: "common", chance: 26.25, value: 0.02 },
    ]
  },
};

function serverPickCard(cards) {
  const rand = Math.random() * 100;
  let cumulative = 0;
  let selected = cards[cards.length - 1];
  for (const card of cards) {
    cumulative += card.chance;
    if (rand <= cumulative) {
      selected = card;
      break;
    }
  }
  return selected;
}

console.log("=".repeat(120));
console.log("POCKETPULL PACK ODDS & EV AUDIT REPORT");
console.log("Simulations per pack: " + SIMULATIONS.toLocaleString());
console.log("=".repeat(120));

const results = [];

for (const [packName, pack] of Object.entries(packs)) {
  const totalChance = pack.cards.reduce((s, c) => s + c.chance, 0);

  // Analytical EV
  let analyticalEV = 0;
  for (const card of pack.cards) {
    analyticalEV += (card.chance / 100) * card.value;
  }

  // Simulation
  const simCounts = {};
  for (const card of pack.cards) {
    simCounts[card.name] = 0;
  }

  let totalSimValue = 0;

  for (let i = 0; i < SIMULATIONS; i++) {
    const card = serverPickCard(pack.cards);
    simCounts[card.name]++;
    totalSimValue += card.value;
  }

  const simulatedEV = totalSimValue / SIMULATIONS;
  const roi = ((simulatedEV - pack.price) / pack.price * 100);
  const evDiffPct = analyticalEV > 0 ? (Math.abs(simulatedEV - analyticalEV) / analyticalEV * 100) : 0;

  const result = {
    packName,
    price: pack.price,
    totalChance,
    analyticalEV: analyticalEV.toFixed(4),
    simulatedEV: simulatedEV.toFixed(4),
    evDiffPct: evDiffPct.toFixed(2),
    roi: roi.toFixed(2),
  };
  results.push(result);

  // Print details
  console.log(`\n${"─".repeat(120)}`);
  console.log(`PACK: ${packName} | Price: $${pack.price} | Total pull_chance: ${totalChance.toFixed(4)}% | Cards: ${pack.cards.length}`);
  console.log(`${"─".repeat(120)}`);

  if (Math.abs(totalChance - 100) > 0.01) {
    console.log(`  *** WEIGHT SUM ERROR: ${totalChance.toFixed(4)}% (expected 100%) ***`);
  }

  console.log(`  Analytical EV: $${analyticalEV.toFixed(4)}`);
  console.log(`  Simulated  EV: $${simulatedEV.toFixed(4)} (diff: ${evDiffPct.toFixed(2)}%)`);
  console.log(`  ROI: ${roi >= 0 ? "+" : ""}${roi.toFixed(2)}% (EV - Price = $${(simulatedEV - pack.price).toFixed(2)})`);

  // Per-card breakdown
  console.log(`\n  ${"Card Name".padEnd(45)} ${"Rarity".padEnd(9)} ${"Config%".padEnd(10)} ${"Sim%".padEnd(10)} ${"Value".padEnd(10)} ${"Status"}`);
  for (const card of pack.cards) {
    const simPct = (simCounts[card.name] / SIMULATIONS * 100);
    const configPct = card.chance;
    const diff = Math.abs(simPct - configPct);
    const threshold = Math.max(0.05, configPct * 0.15);
    const status = diff > threshold ? "DRIFT" : "OK";
    console.log(`  ${card.name.slice(0, 44).padEnd(45)} ${card.rarity.padEnd(9)} ${configPct.toFixed(4).padEnd(10)} ${simPct.toFixed(4).padEnd(10)} $${String(card.value).padEnd(9)} ${status}`);
  }
}

// Summary
console.log(`\n${"=".repeat(120)}`);
console.log("SUMMARY - PACKS RANKED BY ROI (descending)");
console.log("=".repeat(120));
console.log(`${"Pack".padEnd(30)} ${"Price".padEnd(8)} ${"Total%".padEnd(12)} ${"EV".padEnd(12)} ${"ROI".padEnd(10)} ${"Status"}`);
console.log("-".repeat(120));

results.sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));

for (const r of results) {
  const weightOk = Math.abs(r.totalChance - 100) <= 0.01;
  const evOk = parseFloat(r.evDiffPct) < 5;
  const flags = [];
  if (!weightOk) flags.push("WEIGHT=" + r.totalChance.toFixed(2) + "%");
  if (!evOk) flags.push("EV_DRIFT=" + r.evDiffPct + "%");
  if (parseFloat(r.roi) > 5) flags.push("HIGH_ROI");
  const status = flags.length > 0 ? "FLAG: " + flags.join(", ") : "OK";
  console.log(`${r.packName.padEnd(30)} $${String(r.price).padEnd(7)} ${r.totalChance.toFixed(2).padEnd(4)}%      $${r.analyticalEV.padEnd(11)} ${r.roi.padEnd(4)}%      ${status}`);
}

console.log("\n" + "=".repeat(120));
console.log("WEIGHT SUM ERROR PACKS (>0.01% from 100%):");
console.log("=".repeat(120));
for (const r of results) {
  if (Math.abs(r.totalChance - 100) > 0.01) {
    console.log(`  ${r.packName}: total=${r.totalChance.toFixed(4)}% (${r.totalChance > 100 ? "OVER" : "UNDER"} by ${Math.abs(r.totalChance - 100).toFixed(4)}%)`);
  }
}
