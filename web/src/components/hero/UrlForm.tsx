"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PlannerChoice } from "@/lib/types";
import { LetterboxClose } from "./Letterbox";
import { ModelPicker } from "./ModelPicker";

export function UrlForm({ url = "", onUrlChange: setUrl }: { url?: string; onUrlChange: (url: string) => void }) {
  const router = useRouter();
  const [planner, setPlanner] = useState<PlannerChoice>("sonnet");
  const [state, setState] = useState<"idle" | "sending" | "closing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!url.trim()) {
      setError("Paste a link to your app first.");
      return;
    }
    setState("sending");
    let data: { id?: string; error?: string } = {};
    let ok = false;
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, planner }),
      });
      data = await response.json().catch(() => ({}));
      ok = response.ok && Boolean(data.id);
    } catch {
      data = { error: "Could not reach the server. Is it running?" };
    }
    if (!ok || !data.id) {
      setError(data.error ?? "Could not start the job.");
      setState("idle");
      return;
    }
    setState("closing");
    const id = data.id;
    setTimeout(() => router.push(`/jobs/${id}`), 620);
  }

  const showScheme = !/^https?:\/\//i.test(url.trim());

  return (
    <form id="make" onSubmit={submit} className="mt-8 space-y-6 scroll-mt-32" noValidate>
      <div>
        <label htmlFor="url" className="eyebrow mb-3 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="size-3.5 text-amber" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z" />
            <path d="M14 6v12" strokeDasharray="2 2" />
          </svg>
          Box office: your app&apos;s link
        </label>
        <div className="flex items-center rounded-2xl border border-line-strong bg-ink-2/80 backdrop-blur transition focus-within:border-amber/70 focus-within:shadow-[0_0_0_4px_rgb(255_181_71/0.12)]">
          {showScheme && <span className="hidden pl-5 font-mono text-cream-faint sm:inline">https://</span>}
          <input
            id="url"
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourapp.xyz"
            autoComplete="url"
            inputMode="url"
            spellCheck={false}
            className={`w-full min-w-0 bg-transparent py-4 font-mono text-base outline-none placeholder:text-cream-faint sm:text-lg ${showScheme ? "pl-5 sm:pl-1" : "pl-5"} pr-2`}
          />
          <button
            type="submit"
            disabled={state !== "idle"}
            className="m-1.5 flex shrink-0 items-center gap-2.5 rounded-xl bg-amber px-4 py-3 font-medium text-ink transition hover:bg-[#ffc670] disabled:cursor-wait disabled:opacity-80 sm:px-5"
          >
            <span className="rec-dot size-2 rounded-full bg-rec" />
            {state === "idle" ? "Roll camera" : "Rolling"}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rec">
            {error}
          </p>
        )}
      </div>
      <ModelPicker value={planner} onChange={setPlanner} />
      <LetterboxClose active={state === "closing"} />
    </form>
  );
}
