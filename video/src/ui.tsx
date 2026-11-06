import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, deva, display, mono, s } from "./theme";

export const Bg: React.FC = () => {
  const f = useCurrentFrame();
  const a = Math.sin((f / 90) * Math.PI) * 8;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${135 + a}deg, ${C.bg} 0%, ${C.bg2} 55%, ${C.bg} 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(900px 500px at 85% 10%, rgba(255,122,26,0.10), transparent 70%)` }} />
    </AbsoluteFill>
  );
};

/** Spring value 0..1 starting at `at` seconds. */
export const useIn = (at = 0, damping = 16) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - s(at), fps, config: { damping, stiffness: 140, mass: 0.7 } });
};

/** Fade-out in the last 8 frames of the scene. */
export const useOut = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(f, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

export const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const out = useOut();
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Bg />
      {children}
    </AbsoluteFill>
  );
};

export const Kicker: React.FC<{ children: React.ReactNode; color?: string; at?: number }> = ({ children, color = C.orange, at = 0 }) => {
  const p = useIn(at);
  return (
    <div style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase", color, fontWeight: 700, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [14, 0])}px)` }}>
      {children}
    </div>
  );
};

/** Kinetic headline: scales in from large with a blur. */
export const Slam: React.FC<{ children: React.ReactNode; size?: number; at?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 120, at = 0, color = C.text, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - s(at), fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  return (
    <div
      style={{
        fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 0.98, letterSpacing: "-0.03em", color,
        opacity: p > 0.01 ? 1 : 0, transform: `scale(${interpolate(p, [0, 1], [2.2, 1])})`,
        filter: `blur(${interpolate(p, [0, 0.6, 1], [14, 2, 0])}px)`, ...style,
      }}
    >
      {children}
    </div>
  );
};

export const H: React.FC<{ children: React.ReactNode; size?: number; at?: number; style?: React.CSSProperties }> = ({ children, size = 64, at = 0, style }) => {
  const p = useIn(at);
  return (
    <div style={{ fontFamily: display, fontWeight: 800, fontSize: size, lineHeight: 1.02, letterSpacing: "-0.025em", color: C.text, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)`, ...style }}>
      {children}
    </div>
  );
};

export const P: React.FC<{ children: React.ReactNode; size?: number; at?: number; style?: React.CSSProperties }> = ({ children, size = 30, at = 0, style }) => {
  const p = useIn(at);
  return (
    <div style={{ fontFamily: display, fontWeight: 400, fontSize: size, lineHeight: 1.3, color: C.muted, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)`, ...style }}>
      {children}
    </div>
  );
};

export const Hi: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ children, size = 34, color = C.text, style }) => (
  <span style={{ fontFamily: `${deva}, ${display}`, fontSize: size, color, ...style }}>{children}</span>
);

export const Chip: React.FC<{ children: React.ReactNode; color?: string; bg?: string; size?: number; at?: number; style?: React.CSSProperties }> = ({ children, color = C.text, bg = C.panel, size = 26, at = 0, style }) => {
  const p = useIn(at);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 20px", borderRadius: 16, background: bg, border: `1.5px solid ${C.line}`, fontFamily: display, fontWeight: 600, fontSize: size, color, opacity: p, transform: `scale(${interpolate(p, [0, 1], [0.8, 1])})`, ...style }}>
      {children}
    </div>
  );
};

export const Label: React.FC<{ children: React.ReactNode; at?: number; tone?: "sim" | "real" | "anim" }> = ({ children, at = 0, tone = "anim" }) => {
  const p = useIn(at);
  const col = tone === "sim" ? C.orange : tone === "real" ? C.green : C.muted;
  return (
    <div style={{ display: "inline-block", fontFamily: mono, fontSize: 19, fontWeight: 700, letterSpacing: "0.1em", color: col, border: `1.5px solid ${col}`, borderRadius: 999, padding: "5px 14px", opacity: p }}>
      {children}
    </div>
  );
};

export const Code: React.FC<{ lines: { t: string; c?: string }[]; at: number; step?: number; size?: number }> = ({ lines, at, step = 0.4, size = 24 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ fontFamily: mono, fontSize: size, lineHeight: 1.55, background: "#0f0e14", border: `1.5px solid ${C.line}`, borderRadius: 18, padding: "20px 26px", color: C.text, whiteSpace: "pre" }}>
      {lines.map((l, i) => {
        const start = s(at + i * step);
        const n = Math.max(0, Math.min(l.t.length, Math.floor((f - start) * 2.4)));
        return (
          <div key={i} style={{ color: l.c ?? C.text, minHeight: size * 1.55 }}>
            {l.t.slice(0, n)}
            {n > 0 && n < l.t.length ? <span style={{ color: C.orange }}>▍</span> : null}
          </div>
        );
      })}
    </div>
  );
};

/** Browser window frame around a recording (or a real still when the recording is not cut yet). */
export const Browser: React.FC<{ clip?: string; still: string; width?: number; url?: string; hasClip: boolean }> = ({ clip, still, width = 1000, url = "localhost:3000", hasClip }) => {
  const height = (width * 9) / 16;
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const zoom = interpolate(f, [0, durationInFrames], [1, 1.07], { extrapolateRight: "clamp" });
  return (
    <div style={{ transform: `scale(${zoom})`, transformOrigin: "30% 60%", width, borderRadius: 18, overflow: "hidden", background: "#0a0a0d", boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 2px #2b2833" }}>
      <div style={{ height: 44, background: "#1b1a22", display: "flex", alignItems: "center", gap: 10, padding: "0 16px" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />)}
        <div style={{ marginLeft: 14, flex: 1, height: 26, borderRadius: 8, background: "#0f0e14", fontFamily: mono, fontSize: 15, color: C.muted, display: "flex", alignItems: "center", padding: "0 12px" }}>{url}</div>
      </div>
      <div style={{ width, height, background: "#faf7f2", position: "relative", overflow: "hidden" }}>
        {hasClip && clip ? (
          <OffthreadVideo src={staticFile(`clips/${clip}.mp4`)} muted style={{ width, height, objectFit: "cover" }} />
        ) : (
          <Img src={staticFile(`stills/${still}.png`)} style={{ width, height: "auto", objectFit: "cover", objectPosition: "top" }} />
        )}
      </div>
    </div>
  );
};

/** Bottom progress tabs, like the original video. */
export const Tabs: React.FC<{ active: number }> = ({ active }) => {
  const names = ["DEMO", "HOW", "TEST", "RESULTS", "VOICE", "FAILS", "LIMITS"];
  return (
    <div style={{ position: "absolute", left: 150, right: 150, bottom: 40, display: "flex", gap: 22, fontFamily: mono, fontSize: 18, letterSpacing: "0.12em" }}>
      {names.map((n, i) => (
        <div key={n} style={{ color: i === active ? "#0c0b10" : C.muted, background: i === active ? C.orange : "transparent", padding: "4px 12px", borderRadius: 6, fontWeight: 700 }}>
          {i + 1} {n}
        </div>
      ))}
    </div>
  );
};

/** Count up with a spring. */
export const Num: React.FC<{ to: number; at?: number; digits?: number; prefix?: string; suffix?: string; style?: React.CSSProperties }> = ({ to, at = 0, digits = 0, prefix = "", suffix = "", style }) => {
  const f = useCurrentFrame();
  const t = interpolate(f - s(at), [0, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const e = 1 - Math.pow(1 - t, 3);
  return <span style={style}>{prefix}{(to * e).toFixed(digits)}{suffix}</span>;
};
