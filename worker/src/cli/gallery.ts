// npm run gallery                    finished trailers, newest first, with gallery status
// npm run gallery -- approve <id>    feature a trailer in the gallery (its maker must have opted in)
// npm run gallery -- remove <id>     take it down
// Restart the worker or wait a minute for the site to pick up a change.

import { readGallery, savedJobs, setApproved, showable } from "../server/gallery";
import { findJob } from "../server/jobs";
import { fail } from "./shared";

const [command, id] = process.argv.slice(2);

if (!command || command === "list") {
  const { approved } = await readGallery();
  const jobs = await savedJobs();
  if (jobs.length === 0) console.log("No finished jobs yet. Trailers made on the website show up here.");
  for (const job of jobs.slice(0, 60)) {
    const name = job.result?.plan.appName ?? "(no plan)";
    const state = approved.includes(job.id) ? "IN GALLERY" : showable(job) ? "can approve" : job.status !== "done" ? job.status : "opted out";
    console.log(`${job.id}  ${job.createdAt.slice(0, 16).replace("T", " ")}  ${state.padEnd(11)}  ${name}  ${job.url}`);
  }
} else if (command === "approve" || command === "remove") {
  if (!id) fail(`Usage: npm run gallery -- ${command} <job id>`);
  const job = await findJob(id);
  if (!job) fail(`No saved job ${id}.`);
  if (command === "approve" && !showable(job)) {
    fail(job.gallery ? "That job has no finished trailer." : "Its maker did not opt in to the gallery.");
  }
  await setApproved(id, command === "approve");
  console.log(command === "approve" ? `In the gallery: ${job.result?.plan.appName} (${job.url})` : `Removed ${id} from the gallery.`);
} else {
  fail("Usage: npm run gallery [-- approve <id> | remove <id>]");
}
