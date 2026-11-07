// Real footage for the opening trailer's montage: one frame from trailers Premiere made on 6 Nov,
// picked the way the thumbnails pick theirs (the first filmed shot's best frame).

import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { JOBS, OUT } from "./paths";

export const APPS = [
  { name: "Fundable", job: "2f64e7e4-89e8-459e-9a84-c3bd4bd45599" },
  { name: "Vibestarter", job: "c65e344d-6762-48ef-b77b-a070281e90f0" },
  { name: "Excalidraw", job: "a9a68267-3f1a-4d15-8d3f-1f31450fce4d" },
  { name: "Squoosh", job: "11a7ea7d-f2f7-4921-bc8b-ce73de3a22e5" },
  { name: "Monkeytype", job: "a5515c6d-c0f3-48b2-addb-5dca3529c1b8" },
  { name: "Corvo Edge", job: "d3378ea2-5f9f-421b-8a4f-ae126bd0021e" },
  { name: "tldraw", job: "f3af6ad6-5e60-41d5-b465-26248fea6f32" },
  { name: "Desmos", job: "ecc1030f-ad9b-4017-93aa-d7907915c1b0" },
  { name: "OneToken", job: "2b959d2d-d45a-43f9-b79f-8ab49aa2d8a1" },
  { name: "Poolsuite", job: "7dca5897-68b0-4212-a203-845e050bf491" },
  { name: "Linear", job: "820eac89-811c-408b-9f66-890b3109fe83" },
  { name: "Uniswap", job: "9194c6e9-5989-4a3b-a91a-bf52e1a3617c" },
  { name: "Exdiv", job: "e25be4e1-2054-4ff2-a220-d541198b1266" },
  { name: "neal.fun", job: "77dcc66b-a4f1-4e68-95d6-56686191cd0e" },
] as const;

export interface AppFrame {
  name: string;
  file: string;
  accent: string;
}

/** Copies each app's frame into demo/.out/apps and returns where it went, with the app's color. */
export async function copyApps(): Promise<AppFrame[]> {
  await mkdir(path.join(OUT, "apps"), { recursive: true });
  return Promise.all(
    APPS.map(async (app) => {
      const edit = JSON.parse(await readFile(path.join(JOBS, app.job, "edit.json"), "utf8")) as { thumbnail: { frame: string; accent?: string } };
      const file = `apps/${app.job.slice(0, 8)}.jpg`;
      await copyFile(path.join(JOBS, app.job, "frames", edit.thumbnail.frame), path.join(OUT, file));
      return { name: app.name, file, accent: edit.thumbnail.accent ?? "#ffb547" };
    }),
  );
}
