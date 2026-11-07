import { Composition, Still } from "remotion";
import { Thumbnail } from "./Thumbnail";
import { Trailer } from "./Trailer";
import type { ThumbnailProps, TrailerProps } from "./types";

const app = { name: "Nightjar", tagline: "a journal for night owls", cta: "Try it free", host: "nightjar.app" };

const trailerDefaults: TrailerProps = {
  fps: 30,
  durationInFrames: 150,
  base: "http://127.0.0.1:1",
  app,
  segments: [{ kind: "title", from: 0, frames: 150, words: [] }],
  frames: [],
  soundtrack: "soundtrack.wav",
};

const thumbnailDefaults: ThumbnailProps = { base: "http://127.0.0.1:1", app, frame: "" };

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="Trailer"
        component={Trailer}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={150}
        defaultProps={trailerDefaults}
        // A vertical cut swaps the frame's sides; everything else follows the props.
        calculateMetadata={({ props }) => ({
          durationInFrames: props.durationInFrames,
          fps: props.fps,
          ...(props.format === "vertical" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }),
        })}
      />
      <Still id="Thumbnail" component={Thumbnail} width={1920} height={1080} defaultProps={thumbnailDefaults} />
    </>
  );
}
