"use client";

import { useEffect, useState } from "react";
import type { JobView } from "@/lib/types";

/** Polls a job until it finishes. Keeps retrying while the worker is unreachable. */
export function useJob(id: string | undefined) {
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      let retry = true;
      try {
        const response = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as Partial<JobView> & { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Could not load this job.");
          retry = response.status === 503;
        } else {
          setJob(data as JobView);
          setError(null);
          retry = data.status !== "done" && data.status !== "failed";
        }
      } catch {
        setError("Lost the connection to the server. Retrying.");
      }
      if (retry && !stopped) timer = setTimeout(tick, 900);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [id]);

  return { job, error };
}
