import React from "react";
import { AbsoluteFill, Composition, Series } from "remotion";
import { ColdOpen, DemoLive, DemoUpload, End, Gallery, HumanVoice, How, Logo, Problem, ResultsTTS, Stats, TheTest } from "./scenes";
import { FPS, s } from "./theme";
import { Thumbnail } from "./thumbnail";

// Scene durations. Footage scenes (DemoLive, DemoUpload) last exactly as long as their cut clip:
// video/cut_clips.sh time-stretches each cut to these lengths, so keep them in sync.
export const SCENES: { C: React.FC; d: number }[] = [
  { C: ColdOpen, d: s(6) },
  { C: Logo, d: s(4.5) },
  { C: Problem, d: s(8) },
  { C: DemoLive, d: s(14) },
  { C: DemoUpload, d: s(14) },
  { C: How, d: s(14) },
  { C: TheTest, d: s(11) },
  { C: ResultsTTS, d: s(14) },
  { C: HumanVoice, d: s(14) },
  { C: Gallery, d: s(11) },
  { C: Stats, d: s(10) },
  { C: End, d: s(9) },
];

export const TOTAL = SCENES.reduce((a, b) => a + b.d, 0);

const Main: React.FC = () => (
  <AbsoluteFill style={{ background: "#0c0b10" }}>
    <Series>
      {SCENES.map(({ C, d }, i) => (
        <Series.Sequence key={i} durationInFrames={d}>
          <C />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="Main" component={Main} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={FPS} width={1280} height={720} />
  </>
);
