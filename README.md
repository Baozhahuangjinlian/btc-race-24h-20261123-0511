[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/Baozhahuangjinlian/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/Baozhahuangjinlian/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

# Dip-and-ride: a long-only cbBTC bot for a 24-hour race

Entry for the [make.fun](https://make.fun) bounty [`btc-race-24h-20261123-0511`](https://make.fun/bounty/btc-race-24h-20261123-0511): trade Coinbase Wrapped BTC on 1-minute on-chain prices with $1,000 of paper money. Simulation only — no real money is traded anywhere.

## Strategy

The pool is noisy on a 1-minute chart (a full round trip costs ~26 bps, a typical minute moves ~8 bps), so the bot trades rarely:

1. **Buy the first real dip** — when the close falls 0.5% under the last hour's high, buy with everything.
2. **Ride with a wide trailing stop** — sell only when the close falls 2% under the highest close since entry.
3. **After a stop-out, return only on a fresh four-hour high.** No second dip-buy, no revenge trading a falling market.

## Run

The bot speaks `agent-fun/bars-replay/v1` on stdin/stdout (Node 22, standard library only; `vendor/makefun-bars.ts` is a byte-for-byte copy of the kit's SDK shim):

```sh
node main.ts
```

## Result

- Dev window (24 h, 1,440 bars): net P&L **+$36.96**, 1 trade, max drawdown 1.98% — clears the dev gate (P&L > $0) and beats every baseline: momentum +$34.94, buy-and-hold +$32.17, hold-cash $0.00, RSI-Bollinger −$9.32, ADX-momentum −$11.20, EMA-cross −$114.83.
- Determinism verified: two local executions reproduce byte for byte.
