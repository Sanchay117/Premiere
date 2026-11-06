// Link previews for a screening room. Shared on X, Discord, Slack or iMessage, a finished trailer's
// link unfurls with its thumbnail, and where the site plays video cards, with the trailer itself.

import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import type { JobView } from "@/lib/types";
import { workerJson } from "@/lib/worker";

/** The site's public origin: SITE_URL when set, otherwise the host this request came in on.
 *  Crawlers need absolute URLs, and Next only resolves image URLs by itself, not videos. */
async function origin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return {};
  const job = await workerJson<JobView>(`/jobs/${id}`);
  const plan = job?.result?.plan;
  if (!plan) return { title: "Screening room · Premiere" };

  const title = `${plan.appName}: the launch trailer`;
  const tagline = plan.tagline.trim().replace(/[.!?]+$/, "");
  const description = `${tagline ? `${tagline}. ` : ""}A trailer Premiere made from nothing but a link.`;
  const trailer = job.result?.trailer;
  if (!trailer) return { title, description };

  const base = await origin();
  const file = (name: string) => `${base}/api/jobs/${id}/files/${name}`;
  const poster = { url: file(trailer.thumbnails[1] ?? "thumbnail-1280.png"), width: 1280, height: 720, alt: `${plan.appName} trailer poster` };
  return {
    title,
    description,
    openGraph: {
      type: "video.other",
      siteName: "Premiere",
      title,
      description,
      images: [poster],
      videos: [{ url: file(trailer.video), type: "video/mp4", width: 1920, height: 1080 }],
    },
    twitter: { card: "summary_large_image", title, description, images: [poster.url] },
  };
}

export default function ScreeningRoomLayout({ children }: { children: ReactNode }) {
  return children;
}
