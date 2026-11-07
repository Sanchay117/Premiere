import { Composition, Still } from "remotion";
import { Demo } from "./Demo";
import { Intro } from "./Intro";
import { Poster } from "./Graphics";
import type { DemoProps, IntroProps } from "./types";

const introDefaults: IntroProps = { base: "http://127.0.0.1:1", apps: [], script: { hook: "", lines: [] }, trailerLines: [] };

const demoDefaults: DemoProps = {
  ...introDefaults,
  fps: 30,
  durationInFrames: 1020,
  introSeconds: 34,
  guideLines: [],
  rec: { viewport: { width: 1440, height: 810 }, scale: 2, frames: [], moves: [], clicks: [] },
  parts: [],
  camera: [],
  chapters: [],
  timelapses: [],
  overlays: [],
  graphics: [],
  walkEnd: 34,
  vertical: null,
  wide: null,
  soundtrack: "",
};

export function RemotionRoot() {
  return (
    <>
      <Composition id="Intro" component={Intro} width={1920} height={1080} fps={30} durationInFrames={1020} defaultProps={introDefaults} />
      <Composition
        id="Demo"
        component={Demo}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={1020}
        defaultProps={demoDefaults}
        calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames, fps: props.fps })}
      />
      <Still id="Poster" component={Poster} width={1920} height={1080} defaultProps={introDefaults} />
    </>
  );
}
