// Dip-and-ride: a long-only cbBTC bot for a 24-hour race.
//
// The pool is noisy on a 1-minute chart — a full round trip costs about
// 26 bps in fees, slippage and impact, while a typical minute moves
// about 8 bps — so this bot trades rarely and never chases the chop.
//
// The whole plan is three rules:
//
//   1. Buy the first real dip: when the close falls half a percent under
//      the last hour's high, buy with everything. Early dips in a rising
//      market are the cheapest entry a patient bot gets.
//   2. Ride with a wide trailing stop: sell only when the close falls 2%
//      under the highest close since the entry. Two percent is wider than
//      the range's own swings, so a ranging market does not shake the bot
//      out, while a real reversal cuts the loss near 2%.
//   3. After a stop-out, come back only on a fresh four-hour high. No
//      second dip-buy, no revenge trading a falling market.
//
// One more rule exists only for the guardrail: if the bot has never
// traded by bar 1200 it buys on the next uptick, so the entry always
// clears the one-trade minimum. A rejected buy does not count as
// holding: the dip rule keeps offering until a fill actually lands,
// because the bot keys its memory off the positions it sees, not the
// orders it sent. The bot is deterministic: every decision is a
// function of the bars it has seen, with no clock and no randomness.

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Half a percent under the last hour's high counts as a dip worth buying.
const DIP_BPS = 50n;
// Two percent under the peak since entry ends the ride.
const STOP_BPS = 200n;
// How far back the dip's high and the breakout's high reach, in bars.
const DIP_WINDOW = 60;
const BREAKOUT_WINDOW = 240;
// Bars to wait after a stop-out before any new buy.
const COOLDOWN_BARS = 60;
// Bars of history the bot wants before its first entry.
const MIN_HISTORY = 10;
// Bar by which the bot must have traded at least once.
const GUARDRAIL_BAR = 1200;
// Slippage cap on every order: 5%, wide enough that a 1-minute gap never
// refuses the order, tight enough that a wild fill cannot happen.
const MAX_SLIPPAGE_BPS = 500;

const BPS = 10000n;

/** Closes and highs the bot has seen, oldest first, capped at the window. */
const closes: bigint[] = [];
const highs: bigint[] = [];

/** Highest close since the current position opened, null while flat. */
let peak: bigint | null = null;
/** True once the bot has ever held the position (not merely ordered it). */
let everHeld = false;
/** Batch seq of the last sell the bot sent, for the cooldown. */
let lastSellSeq = -1000000;

function highestOf(values: readonly bigint[]): bigint {
  let best = values[0];
  for (const v of values) if (v > best) best = v;
  return best;
}

function buyAll(state: BarsState): OrderInput[] {
  const room = state.weightRoom(SYMBOL);
  const spend = state.cash < room ? state.cash : room;
  if (spend < BigInt(state.hello.fees.min_notional_quote_units)) return [];
  return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS }];
}

await runBars({
  onBatch(state: BarsState, batch: Batch): OrderInput[] {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    if (state.warmingUp) return [];

    const close = BigInt(bar.c);
    const high = BigInt(bar.h);
    const held = state.positions.get(SYMBOL);
    if (held !== undefined) everHeld = true;

    // The dip and breakout windows look back over bars before this one.
    const dipHigh = highs.length > 0 ? highestOf(highs.slice(-DIP_WINDOW)) : null;
    const breakoutHigh = highs.length >= BREAKOUT_WINDOW ? highestOf(highs.slice(-BREAKOUT_WINDOW)) : null;
    const previousClose = closes.length > 0 ? closes[closes.length - 1] : null;
    closes.push(close);
    highs.push(high);
    if (closes.length > BREAKOUT_WINDOW) {
      closes.shift();
      highs.shift();
    }

    if (held !== undefined) {
      if (peak === null || close > peak) peak = close;
      if (close * BPS < peak * (BPS - STOP_BPS)) {
        lastSellSeq = state.seq;
        peak = null;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    peak = null;
    if (state.seq - lastSellSeq < COOLDOWN_BARS) return [];

    if (!everHeld) {
      if (
        closes.length > MIN_HISTORY &&
        dipHigh !== null &&
        close * BPS <= dipHigh * (BPS - DIP_BPS)
      ) {
        return buyAll(state);
      }
      if (
        state.seq >= GUARDRAIL_BAR &&
        previousClose !== null &&
        close > previousClose
      ) {
        return buyAll(state);
      }
      return [];
    }

    if (breakoutHigh !== null && close > breakoutHigh) {
      return buyAll(state);
    }
    return [];
  },
});
