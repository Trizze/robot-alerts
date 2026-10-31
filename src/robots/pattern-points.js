import { randomInt } from 'node:crypto';

// Use integer bit-equivalents: 500 units = 1 point, avoiding fractional rounding.
export const UNITS_PER_POINT = 500;
export const PATTERN_TIER_POINTS = Object.freeze([10, 100, 250, 500, 1000]);
export const HIGHEST_TIER_INTERVAL_UNITS = 100 * UNITS_PER_POINT;
const SUB_UNITS = Object.freeze({ '1000': 500, '2000': 1000, '3000': 2500 });

export function contributionUnits(event, { creditGifts = false } = {}) {
  if (!event?.viewer?.id) return 0;
  if (event.type === 'cheer') return Number.isSafeInteger(event.bits) && event.bits > 0 ? Math.min(event.bits, 100000000) : 0;
  const tier = SUB_UNITS[event.tier];
  if (!tier) return 0;
  if (event.type === 'sub' || event.type === 'resub') return tier;
  if (creditGifts && event.type === 'gift' && Number.isSafeInteger(event.gifts) && event.gifts > 0) return Math.min(event.gifts, 100000000) * tier;
  return 0;
}
export function unlockedPatternTier(units) {
  if (!Number.isSafeInteger(units) || units < 0) throw new RangeError('Invalid point balance');
  return PATTERN_TIER_POINTS.reduce((tier, threshold) => tier + (units >= threshold * UNITS_PER_POINT ? 1 : 0), 0);
}

// Each tier grants its first slot on entry; later slots follow the existing
// interval and stop when that tier's fixed catalog is exhausted.
export function earnedPatternSlots(units, tierCounts, { highestTierIntervalUnits = HIGHEST_TIER_INTERVAL_UNITS } = {}) {
  if (!Number.isSafeInteger(units) || units < 0) throw new RangeError('Invalid point balance');
  if (!Array.isArray(tierCounts) || tierCounts.length !== 5 || tierCounts.some(n => !Number.isSafeInteger(n) || n < 0)) throw new RangeError('Invalid tier counts');
  if (!Number.isSafeInteger(highestTierIntervalUnits) || highestTierIntervalUnits <= 0) throw new RangeError('Invalid highest-tier interval');
  const total = BigInt(units);
  return tierCounts.map((count, index) => {
    const start = BigInt(PATTERN_TIER_POINTS[index] * UNITS_PER_POINT);
    if (total < start || count === 0) return 0;
    if (index === 4) {
      const earned = 1n + (total - start) / BigInt(highestTierIntervalUnits);
      return Number(earned > BigInt(count) ? BigInt(count) : earned);
    }
    const span = BigInt((PATTERN_TIER_POINTS[index + 1] - PATTERN_TIER_POINTS[index]) * UNITS_PER_POINT);
    const earned = 1n + ((total - start) * BigInt(count)) / span;
    return Number(earned > BigInt(count) ? BigInt(count) : earned);
  });
}

// Select from patterns the viewer has not earned. Persist the results atomically
// with the event/point ledger before announcing them; this helper does not save.
export function drawPendingPatterns(catalog, owned, slots, choose = randomInt) {
  if (!Array.isArray(catalog) || !Array.isArray(owned) || !Array.isArray(slots) || slots.length !== 5 || slots.some(n => !Number.isSafeInteger(n) || n < 0)) throw new TypeError('Invalid pattern draw');
  if (catalog.some(x => !x || typeof x.id !== 'string' || !x.id || !Number.isInteger(x.tier) || x.tier < 1 || x.tier > 5) || new Set(catalog.map(x => x.id)).size !== catalog.length) throw new TypeError('Invalid pattern catalog');
  const known = new Set(owned), awards = [];
  for (let tier = 1; tier <= 5; tier++) {
    const choices = catalog.filter(x => x.tier === tier && !known.has(x.id));
    const alreadyOwned = catalog.filter(x => x.tier === tier && known.has(x.id)).length;
    const needed = Math.min(choices.length, Math.max(0, slots[tier - 1] - alreadyOwned));
    for (let i = 0; i < needed; i++) {
      const index = choose(choices.length);
      if (!Number.isSafeInteger(index) || index < 0 || index >= choices.length) throw new RangeError('Invalid random selection');
      const [selected] = choices.splice(index, 1); known.add(selected.id); awards.push(selected);
    }
  }
  return awards;
}
