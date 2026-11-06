import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { CLIPS } from "./clips";
import { FAILS, HUMAN, REPO, TTS } from "./data";
import { C, display, mono, s } from "./theme";
import { Browser, Chip, Code, H, Hi, Kicker, Label, Num, P, Scene, Slam, Tabs, useIn } from "./ui";

/* ---------- shared: animated waveform with a noise amount 0..1 ---------- */
const Wave: React.FC<{ width: number; height: number; noise: number; bars?: number; color?: string; seed?: string }> = ({ width, height, noise, bars = 64, color = C.orange, seed = "w" }) => {
  const f = useCurrentFrame();
  const bw = width / bars;
  return (
    <div style={{ width, height, display: "flex", alignItems: "center", gap: 0 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const speech = (0.5 + 0.5 * Math.sin(i * 0.55 + f * 0.12)) * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.21)));
        const n = random(`${seed}-${i}-${Math.floor(f / 2)}`);
        const v = Math.min(1, speech * (1 - noise * 0.6) + n * noise);
        const isNoise = n * noise > speech * (1 - noise * 0.6) * 0.6;
        return <div key={i} style={{ width: bw - 2, margin: "0 1px", height: Math.max(4, v * height), borderRadius: 3, background: isNoise ? C.muted : color, opacity: isNoise ? 0.7 : 1 }} />;
      })}
    </div>
  );
};

/* ---------- 0 cold open (6 s) ---------- */
export const ColdOpen: React.FC = () => {
  const f = useCurrentFrame();
  const noise = interpolate(f, [s(0.8), s(4.6)], [0.02, 0.95], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const snr = interpolate(f, [s(0.8), s(4.6)], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const orig = "एक किलो चावल और दो पैकेट मैगी";
  const garbled = "एक मीटर दूर और एक दर्जन अंदर";
  const showGarbled = f > s(4.7);
  const typed = Math.min(orig.length, Math.floor(f / 2.2));
  return (
    <Scene>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, flexDirection: "column" }}>
        <Kicker>a real order, getting buried</Kicker>
        <Wave width={1200} height={220} noise={noise} bars={80} seed="cold" />
        <div style={{ fontFamily: mono, fontSize: 30, color: C.muted }}>
          SNR <span style={{ color: C.orange, fontWeight: 700 }}><Num to={Math.max(0, snr)} digits={0} /> dB</span> <span style={{ opacity: 0.6 }}>(simulated)</span>
        </div>
        <div style={{ height: 90, display: "flex", alignItems: "center" }}>
          {!showGarbled ? (
            <Hi size={62}>{orig.slice(0, typed)}<span style={{ color: C.orange }}>▍</span></Hi>
          ) : (
            <Hi size={62} color={C.red}>{garbled}</Hi>
          )}
        </div>
        {showGarbled ? <Label tone="real">REAL PRISMA OUTPUT · 0 dB SIMULATED</Label> : <div style={{ height: 34 }} />}
      </AbsoluteFill>
    </Scene>
  );
};

/* ---------- 1 logo (4.5 s) ---------- */
export const Logo: React.FC = () => {
  const p = useIn(0.1);
  return (
    <Scene>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26 }}>
        <Slam size={190} at={0.1}>Kirana <span style={{ color: C.orange }}>Bol</span></Slam>
        <div style={{ opacity: p }}>
          <P size={36} at={0.7}>Hinglish orders. Phone-line noise. <span style={{ color: C.orange }}>Measured.</span></P>
        </div>
        <Chip at={1.4} size={24} color={C.orangeSoft}>Built on Gnani AI · Prisma + Timbre</Chip>
      </AbsoluteFill>
    </Scene>
  );
};

/* ---------- 2 problem (8 s) ---------- */
export const Problem: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{ padding: "0 150px", justifyContent: "center", gap: 36 }}>
      <Kicker>the gap</Kicker>
      <div style={{ display: "flex", gap: 70 }}>
        <div style={{ flex: 1 }}>
          <H size={54} at={0.2}>Speech AI demos:<br />clean audio.</H>
          <div style={{ marginTop: 26 }}><Wave width={760} height={130} noise={0.02} bars={44} color={C.green} seed="clean" /></div>
          <P size={26} at={1} style={{ marginTop: 14 }}>studio mic · quiet room · 16 kHz</P>
        </div>
        <div style={{ flex: 1 }}>
          <H size={54} at={1.8}>A shop order:<br /><span style={{ color: C.orange }}>a bad phone line.</span></H>
          <div style={{ marginTop: 26 }}><Wave width={760} height={130} noise={0.6} bars={44} seed="noisy" /></div>
          <P size={26} at={2.6} style={{ marginTop: 14 }}>street noise · 8 kHz telephone codec · Hinglish</P>
        </div>
      </div>
      <Chip at={4} size={30} color={C.orange}>So: how badly does the model actually degrade?</Chip>
    </AbsoluteFill>
  </Scene>
);

/* ---------- 3 live demo (14 s): real mic recording, real bill, real readback ---------- */
export const DemoLive: React.FC = () => {
  const p = useIn(0.3);
  return (
    <Scene>
      <div style={{ position: "absolute", left: 100, top: 210, transform: `translateX(${interpolate(p, [0, 1], [-400, 0])}px) rotate(${interpolate(p, [0, 1], [-4, 0])}deg)` }}>
        <Browser clip="c1_live" still="app-ok" hasClip={CLIPS.c1_live} width={1080} />
      </div>
      <div style={{ position: "absolute", left: 1260, top: 215, width: 560, display: "flex", flexDirection: "column", gap: 22 }}>
        <Kicker>1 · speak an order</Kicker>
        <H size={62} at={0.6}>Say an order.<br /><span style={{ color: C.orange }}>Get a bill.</span></H>
        <P size={26} at={1.4}>Live mic. One Hinglish sentence becomes item, quantity, unit and price.</P>
        <Chip at={3.4} size={22}>heard: <Hi size={24}>एक किलो चावल और एक पैकेट मैगी</Hi></Chip>
        <Chip at={4.6} size={22}><span style={{ color: C.green }}>Rice 1 kg · Maggi 1 packet · ₹74</span></Chip>
        <Chip at={8.4} size={22}>“Read the bill back” <b style={{ color: C.orange }}>· Gnani Timbre</b></Chip>
        <Label at={10} tone="real">UNEDITED · SPED UP 1.6×</Label>
      </div>
      <Tabs active={0} />
    </Scene>
  );
};

/* ---------- 4 upload scene (14 s): two of my own recordings, real bills ---------- */
export const DemoUpload: React.FC = () => (
  <Scene>
    <div style={{ position: "absolute", left: 100, top: 210 }}>
      <Browser clip="c2_upload" still="app-ok" hasClip={CLIPS.c2_upload} width={1080} />
    </div>
    <div style={{ position: "absolute", left: 1260, top: 215, width: 560, display: "flex", flexDirection: "column", gap: 22 }}>
      <Kicker>2 · or upload a recording</Kicker>
      <H size={56} at={0.3}>My own voice,<br /><span style={{ color: C.orange }}>uploaded.</span></H>
      <Chip at={1.6} size={22}><span style={{ color: C.green }}>Sugar 1 kg · Rice 2 kg · Salt 1 packet · ₹189</span></Chip>
      <P size={25} at={2.4}>First recording: every item and quantity right.</P>
      <Chip at={9.6} size={22}><span style={{ color: C.green }}>Milk 1 litre · Eggs 1 dozen · ₹140</span></Chip>
      <Chip at={10.4} size={22} color={C.orange}>one word it could not place → “not understood”</Chip>
      <P size={25} at={11.2}>It flags what it cannot read. It does not guess.</P>
      <Label at={12.2} tone="real">UNEDITED · SPED UP 2.1× · NO ADDED NOISE</Label>
    </div>
    <Tabs active={0} />
  </Scene>
);

/* ---------- 5 how it works (14 s) ---------- */
export const How: React.FC = () => {
  const boxes = [
    { t: "Browser", d: "16 kHz mono WAV" },
    { t: "One server", d: "limit · cap · checks" },
    { t: "Gnani Prisma", d: "speech → text" },
    { t: "Parser", d: "pure code, no LLM" },
    { t: "Bill", d: "item · qty · unit · ₹" },
  ];
  return (
    <Scene>
      <AbsoluteFill style={{ padding: "190px 150px 0" }}>
        <Kicker>3 · how it works</Kicker>
        <H size={64} at={0.2} style={{ marginTop: 14 }}>Boring on purpose. <span style={{ color: C.orange }}>Traceable.</span></H>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 56 }}>
          {boxes.map((b, i) => (
            <React.Fragment key={b.t}>
              <Box {...b} at={1 + i * 0.7} hot={i === 3} />
              {i < boxes.length - 1 ? <Arrow at={1.4 + i * 0.7} /> : null}
            </React.Fragment>
          ))}
        </div>
        <div style={{ display: "flex", gap: 36, marginTop: 52 }}>
          <div style={{ flex: 1.2 }}>
            <Code at={5.2} step={0.9} size={25} lines={[
              { t: "heard: एक किलो चावल दो मैगी", c: C.muted },
              { t: "following quantity wins:", c: C.muted },
              { t: "  चावल → 1 kg", c: C.green },
              { t: "  मैगी → 2 packet", c: C.green },
              { t: "unknown word → not understood", c: C.orange },
            ]} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            <Chip at={7} size={25}>Exact match first, fuzzy only for 4+ letters</Chip>
            <Chip at={8.4} size={25}>Per-IP limit + daily cap protect credits</Chip>
            <Chip at={9.8} size={25}>API key never leaves the server</Chip>
          </div>
        </div>
        <div style={{ marginTop: 22 }}><Label at={11} tone="anim">ANIMATED DIAGRAM · CODE IN THE REPO</Label></div>
      </AbsoluteFill>
      <Tabs active={1} />
    </Scene>
  );
};

const Box: React.FC<{ t: string; d: string; at: number; hot?: boolean }> = ({ t, d, at, hot }) => {
  const p = useIn(at);
  return (
    <div style={{ flex: 1, padding: "22px 20px", borderRadius: 18, background: hot ? "rgba(255,122,26,0.14)" : C.panel, border: `2px solid ${hot ? C.orange : C.line}`, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)` }}>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, color: hot ? C.orange : C.text }}>{t}</div>
      <div style={{ fontFamily: mono, fontSize: 18, color: C.muted, marginTop: 8 }}>{d}</div>
    </div>
  );
};
const Arrow: React.FC<{ at: number }> = ({ at }) => {
  const p = useIn(at);
  return <div style={{ fontFamily: mono, fontSize: 38, color: C.orange, opacity: p }}>→</div>;
};

/* ---------- 6 the test (11 s) ---------- */
export const TheTest: React.FC = () => {
  const f = useCurrentFrame();
  const n = Math.min(90, Math.floor(interpolate(f, [s(1.2), s(5.5)], [0, 90], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const levels = ["clean", "10 dB SNR", "0 dB SNR"];
  return (
    <Scene>
      <AbsoluteFill style={{ padding: "190px 150px 0" }}>
        <Kicker>4 · the test</Kicker>
        <H size={64} at={0.2} style={{ marginTop: 14 }}>30 orders × 3 levels = <span style={{ color: C.orange }}>90 clips</span></H>
        <div style={{ display: "flex", gap: 60, marginTop: 44 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {levels.map((lv, r) => (
              <div key={lv} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 170, fontFamily: mono, fontSize: 22, color: r === 2 ? C.orange : C.muted }}>{lv}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(30, 22px)", gap: 6 }}>
                  {Array.from({ length: 30 }).map((_, i) => {
                    const idx = r * 30 + i;
                    return <div key={i} style={{ width: 22, height: 40, borderRadius: 5, background: idx < n ? (r === 0 ? C.green : r === 1 ? C.orangeSoft : C.orange) : C.panel, border: `1px solid ${C.line}` }} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 46, alignItems: "center" }}>
          <Chip at={3} size={26}>speech</Chip><Arrow at={3} />
          <Chip at={3.6} size={26}>+ seeded noise at N dB</Chip><Arrow at={3} />
          <Chip at={4.2} size={26}>8 kHz G.711 phone codec</Chip><Arrow at={3} />
          <Chip at={4.8} size={26}>Prisma</Chip><Arrow at={3} />
          <Chip at={5.4} size={26} color={C.green}>item F1</Chip>
        </div>
        <P size={27} at={6.4} style={{ marginTop: 26 }}>An item counts only if <b style={{ color: C.text }}>item + quantity + unit</b> all match. “Not understood” = missed.</P>
        <div style={{ marginTop: 20 }}><Label at={7.2} tone="sim">NOISE IS SIMULATED · NOT REAL PHONE CALLS</Label></div>
      </AbsoluteFill>
      <Tabs active={2} />
    </Scene>
  );
};

/* ---------- bar chart used by two scenes ---------- */
const Bars: React.FC<{ levels: string[]; a: { f1: number[]; ci: number[][] }; b: { f1: number[]; ci: number[][] }; at: number; h?: number }> = ({ levels, a, b, at, h = 520 }) => (
  <div style={{ display: "flex", gap: 70, alignItems: "flex-end", height: h + 90 }}>
    {levels.map((lv, i) => (
      <div key={lv} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", height: h }}>
          {[{ d: a, col: C.orange, name: "v2.5" }, { d: b, col: C.orangeSoft, name: "v3.0" }].map((m, k) => (
            <Bar key={k} value={m.d.f1[i]} ci={m.d.ci[i]} col={m.col} name={m.name} at={at + i * 0.9 + k * 0.25} h={h} dim={k === 1} />
          ))}
        </div>
        <div style={{ fontFamily: mono, fontSize: 24, color: C.muted }}>{lv}</div>
      </div>
    ))}
  </div>
);
const Bar: React.FC<{ value: number; ci: number[]; col: string; name: string; at: number; h: number; dim?: boolean }> = ({ value, ci, col, name, at, h, dim }) => {
  const f = useCurrentFrame();
  const t = interpolate(f - s(at), [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const e = 1 - Math.pow(1 - t, 3);
  const bh = h * value * e;
  const wLo = h * ci[0] * e;
  const wHi = h * ci[1] * e;
  return (
    <div style={{ width: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: h, position: "relative" }}>
      <div style={{ width: 110, height: bh, borderRadius: "10px 10px 0 0", background: col, opacity: dim ? 0.8 : 1, position: "relative" }}>
        <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontFamily: mono, fontWeight: 700, fontSize: 26, color: "#0c0b10", opacity: t }}>{(value * e).toFixed(3)}</div>
      </div>
      {wHi - wLo > 2 ? (
        <div style={{ position: "absolute", bottom: wLo, left: 104, width: 3, height: wHi - wLo, background: "#fff", opacity: 0.9 * t }}>
          <div style={{ position: "absolute", top: 0, left: -9, width: 21, height: 3, background: "#fff" }} />
          <div style={{ position: "absolute", bottom: 0, left: -9, width: 21, height: 3, background: "#fff" }} />
        </div>
      ) : null}
      <div style={{ fontFamily: mono, fontSize: 17, color: C.muted, marginTop: 6 }}>{name}</div>
    </div>
  );
};

/* ---------- 7 results with TTS speech (14 s) ---------- */
export const ResultsTTS: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{ padding: "170px 150px 0" }}>
      <Kicker>5 · results · TTS speech, 30 orders, 61 items</Kicker>
      <div style={{ display: "flex", gap: 80, marginTop: 24 }}>
        <div>
          <H size={60} at={0.2}>Fine at 10 dB.<br /><span style={{ color: C.orange }}>Breaks at 0 dB.</span></H>
          <P size={26} at={1} style={{ marginTop: 20, width: 560 }}>Item F1 · Prisma v2.5 vs v3.0, same 90 clips.</P>
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <Chip at={7} size={25}>0 dB 95% CI: v2.5 0.74–0.90 · v3.0 0.86–0.96</Chip>
            <Chip at={8.5} size={25} color={C.orange}>Intervals overlap → suggestive, not proven</Chip>
            <Chip at={10} size={25}>Items never heard at 0 dB: <b style={{ color: C.orange }}>18</b> vs <b style={{ color: C.orangeSoft }}>8</b> of 61</Chip>
          </div>
          <div style={{ marginTop: 20 }}><Label at={11} tone="sim">SIMULATED NOISE · REAL API RESULTS</Label></div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Bars levels={TTS.levels} a={TTS.v25} b={TTS.v30} at={1.6} />
        </div>
      </div>
    </AbsoluteFill>
    <Tabs active={3} />
  </Scene>
);

/* ---------- 8 own voice (14 s) ---------- */
export const HumanVoice: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{ padding: "170px 150px 0" }}>
      <Kicker>6 · then my own voice · n = 10 orders · 21 items</Kicker>
      <div style={{ display: "flex", gap: 80, marginTop: 24 }}>
        <div>
          <H size={60} at={0.2}>Plot twist.</H>
          <H size={46} at={1} style={{ marginTop: 12 }}>v3.0 is <span style={{ color: C.orange }}>not</span> better<br />with a real voice.</H>
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
            <Chip at={6} size={25}>Real voice, real room: <b style={{ color: C.green }}>perfect</b> on both</Chip>
            <Chip at={7.4} size={25}>0 dB: v2.5 0.53 · v3.0 0.36</Chip>
            <Chip at={8.8} size={25} color={C.orange}>v3.0 sometimes answered with a different sentence</Chip>
            <Chip at={10.2} size={25}>n = 10 → wide intervals → no winner</Chip>
          </div>
          <div style={{ marginTop: 20 }}><Label at={11.4} tone="real">MY RECORDINGS · NOISE ON TOP SIMULATED</Label></div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Bars levels={HUMAN.levels} a={HUMAN.v25} b={HUMAN.v30} at={1.8} />
        </div>
      </div>
    </AbsoluteFill>
    <Tabs active={4} />
  </Scene>
);

/* ---------- 9 failure gallery (11 s) ---------- */
export const Gallery: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{ padding: "170px 150px 0" }}>
      <Kicker>7 · real failures, shown honestly</Kicker>
      <H size={60} at={0.2} style={{ marginTop: 14 }}>What the model <span style={{ color: C.red }}>actually heard</span></H>
      <div style={{ display: "flex", gap: 28, marginTop: 40 }}>
        {FAILS.map((x, i) => {
          const p = useIn(1 + i * 1.2);
          return (
            <div key={x.id} style={{ flex: 1, padding: 28, borderRadius: 20, background: C.panel, border: `1.5px solid ${C.line}`, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px)` }}>
              <div style={{ fontFamily: mono, fontSize: 18, color: C.muted }}>{x.id} · {x.level} · prisma {x.model}</div>
              <div style={{ fontFamily: mono, fontSize: 18, color: C.muted, marginTop: 18 }}>said</div>
              <div style={{ fontFamily: display, fontSize: 28, color: C.green, marginTop: 4 }}>“{x.said}”</div>
              <div style={{ fontFamily: mono, fontSize: 18, color: C.muted, marginTop: 18 }}>heard</div>
              <div style={{ marginTop: 4 }}><Hi size={32} color={C.red}>{x.heard}</Hi></div>
              <div style={{ fontFamily: mono, fontSize: 18, color: C.muted, marginTop: 18 }}>bill</div>
              <div style={{ fontFamily: display, fontWeight: 600, fontSize: 28, color: C.orange, marginTop: 4 }}>{x.got}</div>
            </div>
          );
        })}
      </div>
      <P size={30} at={5.6} style={{ marginTop: 34 }}>Wrong text, <b style={{ color: C.text }}>no wrong bill</b>. The parser refuses to guess.</P>
      <div style={{ marginTop: 18 }}><Label at={6.4} tone="real">VERBATIM FROM results.json · SIMULATED NOISE</Label></div>
    </AbsoluteFill>
    <Tabs active={5} />
  </Scene>
);

/* ---------- 10 limits + stats (10 s) ---------- */
export const Stats: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{ padding: "170px 150px 0" }}>
      <Kicker>8 · what this proves, and what it does not</Kicker>
      <div style={{ display: "flex", gap: 60, marginTop: 34 }}>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {[
            { n: 57, l: "tests passing", at: 0.6 },
            { n: 90, l: "clips × 2 models", at: 1.0 },
            { n: 61, l: "items scored", at: 1.4 },
            { n: 2, l: "parser bugs the real run found, fixed", at: 1.8 },
          ].map((x) => (
            <div key={x.l} style={{ padding: 26, borderRadius: 20, background: C.panel, border: `1.5px solid ${C.line}` }}>
              <div style={{ fontFamily: display, fontWeight: 800, fontSize: 84, color: C.orange }}><Num to={x.n} at={x.at} /></div>
              <div style={{ fontFamily: mono, fontSize: 20, color: C.muted }}>{x.l}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <H size={46} at={2.4}>Honest limits</H>
          <Chip at={3.2} size={26}>Noise is simulated, not a real call</Chip>
          <Chip at={4} size={26}>30 orders / 10 voice orders: small sample</Chip>
          <Chip at={4.8} size={26}>No “best model” claim</Chip>
          <Chip at={5.6} size={26} color={C.green}>Code, data, results: all in the repo</Chip>
        </div>
      </div>
    </AbsoluteFill>
    <Tabs active={6} />
  </Scene>
);

/* ---------- 11 end card (9 s) ---------- */
export const End: React.FC = () => (
  <Scene>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 24 }}>
      <Slam size={150} at={0.1}>Hear it <span style={{ color: C.orange }}>break.</span></Slam>
      <H size={54} at={1} style={{ color: C.muted }}>Then measure it.</H>
      <div style={{ marginTop: 20 }}>
        <Chip at={2.2} size={36} color={C.orange} bg="rgba(255,122,26,0.12)" style={{ fontFamily: mono, fontWeight: 700, border: `2px solid ${C.orange}` }}>{REPO}</Chip>
      </div>
      <P size={28} at={3.2}>Kirana Bol · built on Gnani AI Prisma + Timbre · Great Indian AI Internship Challenge</P>
      <div style={{ marginTop: 8 }}><Label at={4} tone="anim">#GnaniAI #GreatIndianAIInternshipChallenge</Label></div>
    </AbsoluteFill>
  </Scene>
);
