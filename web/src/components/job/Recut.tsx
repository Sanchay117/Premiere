"use client";

// The cutting room: mark up a finished trailer's script on revised pages, tune the car radio to
// another narrator or pick another caption look, and Premiere cuts a new take over the same
// footage. Nothing is filmed again, so it is ready in about a minute.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CaptionPicker, FormLabel, NarratorDial } from "@/components/hero/pickers";
import { LINE_MAX, WORDS_MAX, WORDS_TARGETS } from "@/lib/options";
import type { CaptionStyle, JobView, VoiceChoice } from "@/lib/types";

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

type Script = { hook: string; close: string; shots: { narration: string; punch: string }[] };

function LineField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <textarea
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      maxLength={LINE_MAX}
      rows={2}
      disabled={disabled}
      className="block w-full resize-none border-2 border-paper-ink/40 bg-[#fbf6ea] px-3 py-2 font-mono text-[14px] leading-relaxed text-paper-ink outline-none [field-sizing:content] focus:border-ticket disabled:opacity-60"
    />
  );
}

export function Recut({ job }: { job: JobView }) {
  const router = useRouter();
  const result = job.result!;
  const { plan } = result;
  const style = job.options?.style ?? "hype";
  const length = job.options?.length ?? 45;
  const original: Script = { hook: plan.hook, close: plan.close, shots: plan.shots.map((s) => ({ narration: s.narration, punch: s.punch ?? "" })) };
  const firstVoice = job.options?.voice ?? "auto";
  const firstCaptions = job.options?.captions ?? "karaoke";

  const [open, setOpen] = useState(false);
  const [script, setScript] = useState<Script>(original);
  const [voice, setVoice] = useState<VoiceChoice>(firstVoice);
  const [captions, setCaptions] = useState<CaptionStyle>(firstCaptions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skipped = new Set(result.trailer?.shotsSkipped.map((s) => s.index) ?? []);
  const words = countWords([script.hook, ...script.shots.map((s) => s.narration), script.close].join(" "));
  const [low, high] = WORDS_TARGETS[style][length];
  const max = WORDS_MAX[length];
  const changed =
    JSON.stringify(script) !== JSON.stringify(original) || voice !== firstVoice || captions !== firstCaptions;
  const empty = [script.hook, script.close, ...script.shots.map((s) => s.narration)].some((t) => !t.trim());

  const setShot = (i: number, patch: Partial<Script["shots"][number]>) =>
    setScript((s) => ({ ...s, shots: s.shots.map((shot, j) => (j === i ? { ...shot, ...patch } : shot)) }));

  function reset() {
    setScript(original);
    setVoice(firstVoice);
    setCaptions(firstCaptions);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !changed) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${job.id}/recut`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...script, voice, captions }),
      });
      const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error ?? "Could not start the recut.");
      router.push(`/jobs/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the recut.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-16">
      <p className="eyebrow">The cutting room</p>
      <h3 className="mt-3 font-display text-[2.4rem] leading-none tracking-[0.03em]">RECUT THIS TRAILER</h3>
      <p className="mt-2 max-w-2xl text-sm text-cream-dim">
        Change any line, tune in another narrator or pick other captions. The new lines are recorded and cut over the same
        footage, so nothing is filmed again and it is ready in about a minute. A recut counts as one of today&apos;s free
        trailers and stays out of the gallery.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-6 rounded-full border border-line-strong px-4 py-2 text-sm transition hover:border-amber hover:text-amber"
        >
          Mark up the script
        </button>
      ) : (
        <form onSubmit={submit} noValidate className="paper relative mt-7 max-w-4xl shadow-[0_30px_70px_-30px_rgb(0_0_0/0.9)]">
          <div className="flex items-center justify-between border-b-2 border-dashed border-paper-ink/25 px-5 pb-2.5 pt-4 sm:px-6">
            <span className="font-display text-[1.7rem] leading-none tracking-[0.08em]">REVISED PAGES</span>
            <span className="font-mono text-[12px] font-bold text-ticket">No. {job.id.slice(0, 6).toUpperCase()}</span>
          </div>

          <ol className="divide-y-2 divide-dashed divide-paper-ink/15 px-5 sm:px-6">
            <li className="grid gap-2 py-4 sm:grid-cols-[5.5rem_1fr] sm:gap-4">
              <span className="pt-2">
                <FormLabel>Title</FormLabel>
              </span>
              <LineField label="Opening line" value={script.hook} onChange={(hook) => setScript((s) => ({ ...s, hook }))} />
            </li>
            {script.shots.map((shot, i) => {
              const cut = skipped.has(i);
              return (
                <li key={i} className="grid gap-2 py-4 sm:grid-cols-[5.5rem_1fr] sm:gap-4">
                  <span className="pt-2">
                    <FormLabel>Shot {String(i + 1).padStart(2, "0")}</FormLabel>
                  </span>
                  <div className="space-y-2">
                    {style === "hype" && (
                      <input
                        aria-label={`Shot ${i + 1} title card`}
                        value={shot.punch}
                        onChange={(e) => setShot(i, { punch: e.target.value })}
                        maxLength={32}
                        disabled={cut}
                        className="w-full border-b-2 border-paper-ink/30 bg-transparent py-0.5 font-display text-[1.5rem] uppercase leading-none tracking-[0.05em] text-paper-ink outline-none focus:border-ticket disabled:opacity-60 sm:w-72"
                      />
                    )}
                    <LineField label={`Shot ${i + 1} line`} value={shot.narration} onChange={(narration) => setShot(i, { narration })} disabled={cut} />
                    {cut && <p className="text-[12px] leading-snug text-paper-dim">This shot could not be filmed, so its line is not in the cut.</p>}
                  </div>
                </li>
              );
            })}
            <li className="grid gap-2 py-4 sm:grid-cols-[5.5rem_1fr] sm:gap-4">
              <span className="pt-2">
                <FormLabel>End</FormLabel>
              </span>
              <LineField label="Closing line" value={script.close} onChange={(close) => setScript((s) => ({ ...s, close }))} />
            </li>
          </ol>

          <div className="grid gap-6 border-t-2 border-dashed border-paper-ink/25 px-5 py-5 sm:px-6 md:grid-cols-2">
            <NarratorDial value={voice} onChange={setVoice} />
            <CaptionPicker value={captions} onChange={setCaptions} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-dashed border-paper-ink/25 px-5 py-4 sm:px-6">
            <p className={`font-mono text-[12px] font-bold ${words > max ? "text-ticket" : "text-paper-dim"}`}>
              {words} words
              {words > max ? `, ${words - max} over what a ${length} s trailer holds` : words > high ? ", runs a little long" : `, aim for ${low} to ${high}`}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={reset}
                disabled={busy || !changed}
                className="px-2 py-2 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-paper-dim underline-offset-4 hover:text-paper-ink hover:underline disabled:opacity-40 disabled:hover:no-underline"
              >
                Put it back
              </button>
              <button
                type="submit"
                disabled={busy || !changed || empty || words > max}
                className="flex items-center gap-2.5 bg-ticket px-6 py-2.5 font-display text-[1.6rem] leading-none tracking-[0.06em] text-paper transition hover:bg-ticket-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="rec-dot size-2 rounded-full bg-paper" />
                {busy ? "STARTING" : "RECUT IT"}
              </button>
            </div>
          </div>
          {(error || empty) && (
            <p role="alert" className="px-5 pb-4 text-[13px] font-bold text-ticket sm:px-6">
              {error ?? "Every line needs a few words."}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
