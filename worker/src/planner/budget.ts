// App-side spend guard for the Claude API. The Console workspace spend limit is the hard cap;
// this ledger keeps Premiere under its own monthly budget so it falls back to the free
// planner before the API starts refusing. Single-process file ledger for now; it moves to
// the job database when the worker runs on the VPS.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config";

interface LedgerFile {
  months: Record<string, { usd: number; calls: number }>;
}

export interface BudgetCheck {
  ok: boolean;
  spentUsd: number;
  limitUsd: number;
}

function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7); // UTC year-month, e.g. 2026-11
}

export class SpendLedger {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    readonly file: string,
    readonly limitUsd: number,
  ) {}

  private static shared: SpendLedger | null = null;

  /** The process's one ledger. Writes are serialized per instance, so jobs planning at the same
   *  time must share it or one could overwrite another's cost. */
  static default(): SpendLedger {
    SpendLedger.shared ??= new SpendLedger(path.join(config.dataDir, "spend.json"), config.monthlyBudgetUsd);
    return SpendLedger.shared;
  }

  private async read(): Promise<LedgerFile> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as LedgerFile;
    } catch {
      return { months: {} };
    }
  }

  async thisMonth(): Promise<{ usd: number; calls: number }> {
    const ledger = await this.read();
    return ledger.months[monthKey()] ?? { usd: 0, calls: 0 };
  }

  /** Whether a call that could cost up to `estimateUsd` still fits in this month's budget. */
  async allows(estimateUsd: number): Promise<BudgetCheck> {
    const { usd } = await this.thisMonth();
    return { ok: usd + estimateUsd <= this.limitUsd, spentUsd: usd, limitUsd: this.limitUsd };
  }

  /** Adds the actual cost of one call. Writes are serialized and atomic. */
  record(usd: number): Promise<void> {
    const task = this.queue.then(async () => {
      const ledger = await this.read();
      const key = monthKey();
      const current = ledger.months[key] ?? { usd: 0, calls: 0 };
      ledger.months[key] = { usd: Math.round((current.usd + usd) * 1e6) / 1e6, calls: current.calls + 1 };
      await mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify(ledger, null, 2));
      await rename(tmp, this.file);
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
