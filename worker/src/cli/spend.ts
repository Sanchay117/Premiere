// npm run spend
// Shows this month's Claude API spend as recorded by the worker, against the app-side budget.

import { config } from "../config";
import { SpendLedger } from "../planner/budget";
import { usd } from "./shared";

const ledger = SpendLedger.default();
const month = await ledger.thisMonth();
console.log(`This month: ${usd(month.usd)} over ${month.calls} call(s), budget $${ledger.limitUsd}.`);
console.log(`API key: ${config.apiKey ? "set" : "missing (PREMIERE_ANTHROPIC_API_KEY in .env)"}; planner ${config.planner}, model ${config.model}, effort ${config.effort}.`);
console.log(`Deepgram key: ${config.deepgramKey ? "set" : "missing (DEEPGRAM_KEY in .env)"}.`);
console.log("The Console workspace spend limit is the hard cap; check the Console usage page for the billed total.");
