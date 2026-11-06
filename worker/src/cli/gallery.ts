// npm run gallery                    finished trailers, newest first, with where each stands
// npm run gallery -- approve <id>    put a held trailer up (its maker must have opted in)
// npm run gallery -- remove <id>     take any trailer down, for good
// A trailer goes up by itself when its maker opted in and Claude found the page fit for a public
// wall; the rest are held for a person to look at. The site picks up a change within a minute.

import { listing, readGallery, savedJobs, setListing, showable } from "../server/gallery";
import { findJob } from "../server/jobs";
import { fail } from "./shared";

const [command, id] = process.argv.slice(2);

const LABELS = {
  listed: "IN GALLERY",
  held: "held",
  removed: "removed",
  "opted out": "opted out",
  unfinished: "unfinished",
} as const;

if (!command || command === "list") {
  const state = await readGallery();
  const jobs = await savedJobs();
  if (jobs.length === 0) console.log("No finished jobs yet. Trailers made on the website show up here.");
  for (const job of jobs.slice(0, 60)) {
    const name = job.result?.plan.appName ?? "(no plan)";
    const where = job.status === "done" ? LABELS[listing(job, state)] : job.status;
    console.log(`${job.id}  ${job.createdAt.slice(0, 16).replace("T", " ")}  ${where.padEnd(11)}  ${name}  ${job.url}`);
  }
  console.log("\nOnly the newest listed trailer of each app hangs in the gallery.");
} else if (command === "approve" || command === "remove") {
  if (!id) fail(`Usage: npm run gallery -- ${command} <job id>`);
  const job = await findJob(id);
  if (!job) fail(`No saved job ${id}.`);
  if (command === "approve" && !showable(job)) {
    fail(job.gallery ? "That job has no finished trailer." : "Its maker did not opt in to the gallery.");
  }
  await setListing(id, command);
  console.log(command === "approve" ? `In the gallery: ${job.result?.plan.appName} (${job.url})` : `Taken down: ${id}`);
} else {
  fail("Usage: npm run gallery [-- approve <id> | remove <id>]");
}
