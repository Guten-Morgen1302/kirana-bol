import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, display, mono } from "./theme";

// Two REAL screenshots of the app (10 dB works, 0 dB refuses to guess), tilted, with a big headline.
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(900px 600px at 85% 15%, rgba(255,122,26,0.22), transparent 70%), ${C.bg}` }}>
    <div style={{ position: "absolute", left: 56, top: 52, background: C.orange, color: "#0c0b10", fontFamily: mono, fontWeight: 700, fontSize: 30, letterSpacing: "0.08em", padding: "12px 22px", borderRadius: 8 }}>
      BUILT ON GNANI PRISMA
    </div>
    <div style={{ position: "absolute", left: 56, top: 150, fontFamily: display, fontWeight: 800, fontSize: 138, lineHeight: 0.92, letterSpacing: "-0.04em", color: C.text }}>
      Hear it<br /><span style={{ color: C.orange }}>break.</span>
    </div>
    <div style={{ position: "absolute", left: 60, top: 470, fontFamily: display, fontWeight: 600, fontSize: 38, color: C.muted, width: 560 }}>
      Hinglish orders on a bad phone line. Measured.
    </div>
    <div style={{ position: "absolute", left: 60, top: 600, fontFamily: mono, fontSize: 26, color: C.green, fontWeight: 700 }}>
      SIMULATED NOISE · REAL RESULTS
    </div>
    <div style={{ position: "absolute", right: 250, top: 130, width: 470, height: 300, borderRadius: 18, overflow: "hidden", transform: "rotate(-5deg)", boxShadow: "0 30px 70px rgba(0,0,0,0.6), 0 0 0 3px #2b2833", background: "#faf7f2" }}>
      <Img src={staticFile("stills/app-ok.png")} style={{ width: 780, marginLeft: -150, marginTop: -205 }} />
    </div>
    <div style={{ position: "absolute", right: 24, top: 300, width: 470, height: 300, borderRadius: 18, overflow: "hidden", transform: "rotate(4deg)", boxShadow: "0 30px 70px rgba(0,0,0,0.6), 0 0 0 3px #2b2833", background: "#faf7f2" }}>
      <Img src={staticFile("stills/app-fail.png")} style={{ width: 780, marginLeft: -150, marginTop: -205 }} />
    </div>
    <div style={{ position: "absolute", right: 480, top: 86, fontFamily: mono, fontWeight: 700, fontSize: 26, color: C.green, background: "rgba(12,11,16,0.85)", padding: "6px 14px", borderRadius: 8, transform: "rotate(-5deg)" }}>10 dB: bill is right</div>
    <div style={{ position: "absolute", right: 40, top: 250, fontFamily: mono, fontWeight: 700, fontSize: 26, color: C.orange, background: "rgba(12,11,16,0.85)", padding: "6px 14px", borderRadius: 8, transform: "rotate(4deg)" }}>0 dB: refuses to guess</div>
    <div style={{ position: "absolute", right: 56, bottom: 44, fontFamily: display, fontWeight: 800, fontSize: 40, color: C.text, border: `3px solid ${C.orange}`, borderRadius: 14, padding: "10px 22px" }}>
      <span style={{ color: C.orange }}>●</span> Kirana Bol
    </div>
  </AbsoluteFill>
);
