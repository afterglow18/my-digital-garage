/**
 * WelcomePage — Three-phase splash screen.
 *
 * Phase flow:
 *   "hero"    — full-screen hero image + "Welcome to / MY DIGITAL GARAGE" (2.5 s, auto-advance)
 *   "door"    — hero panel fades out revealing closed garage door + branding + "Open Garage" button
 *   "opening" — door slides up (0.5 s)
 *   "exiting" — whole screen fades to black → onEnter()
 *
 * Session behaviour: shown once per browser session (sessionStorage key set by App.tsx).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

type Phase = "hero" | "door" | "opening" | "exiting";

// Number of horizontal panels drawn on the door
const PANEL_COUNT = 7;

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase]   = useState<Phase>("hero");
  const calledRef           = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  // Phase 1 → Phase 2: auto-advance after 2.5 s
  useEffect(() => {
    const t = setTimeout(() => setPhase("door"), 2500);
    return () => clearTimeout(t);
  }, []);

  // Phase 3: button tap → door slides up → fade to black → navigate (~750 ms total)
  const handleOpen = () => {
    if (phase !== "door") return;
    setPhase("opening");
    setTimeout(() => setPhase("exiting"), 500);   // door fully up → begin fade
    setTimeout(finish, 500 + 250);               // fade done → enter app
  };

  // Pre-load hero image while Phase 1 is displaying
  useEffect(() => {
    const img = new Image();
    img.src = "/garage-hero-bg.jpg";
  }, []);

  const pastHero = phase !== "hero";

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: 0.25, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        overflow: "hidden",
        background: "#0d0d0d",
      }}
    >

      {/* ── z:0  Dark base ── */}
      <div style={{ position: "absolute", inset: 0, background: "#0d0d0d", zIndex: 0 }} />

      {/* ── z:1  Hero image behind door (revealed as door rises in Phase 3) ── */}
      <img
        src="/garage-hero-bg.jpg"
        alt="My Digital Garage"
        draggable={false}
        style={{
          position: "absolute",
          top: 0, left: "50%",
          transform: "translateX(-50%)",
          width: "100%", height: "70%",
          objectFit: "contain", objectPosition: "center top",
          zIndex: 1,
          userSelect: "none", pointerEvents: "none",
        }}
      />

      {/* ── z:2  Gradient overlay (behind door) ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.50) 55%, rgba(0,0,0,0.85) 100%)",
        zIndex: 2,
      }} />

      {/* ── z:10  Garage door — slides up when opening ── */}
      <motion.div
        initial={{ y: "0%" }}
        animate={{ y: phase === "opening" || phase === "exiting" ? "-100%" : "0%" }}
        transition={{ duration: 0.5, ease: [0, 0, 0.35, 1] }}
        style={{
          position: "absolute", inset: 0,
          zIndex: 10,
          background: `repeating-linear-gradient(
            to bottom,
            #282828 0px,
            #2e2e2e 2px,
            #323232 ${Math.round(100 / PANEL_COUNT * 0.82)}%,
            #222222 ${Math.round(100 / PANEL_COUNT * 0.88)}%,
            #181818 ${Math.round(100 / PANEL_COUNT * 0.93)}%,
            #282828 ${Math.round(100 / PANEL_COUNT)}%
          )`,
        }}
      >
        {/* Left track */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: 0, width: 14,
          background: "linear-gradient(to right, #080808, #181818)",
        }} />
        {/* Right track */}
        <div style={{
          position: "absolute", top: 0, bottom: 0, right: 0, width: 14,
          background: "linear-gradient(to left, #080808, #181818)",
        }} />

        {/* Top edge shadow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: "rgba(0,0,0,0.95)",
        }} />
        {/* Bottom edge */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 5,
          background: "rgba(0,0,0,0.9)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.8)",
        }} />

        {/* Window row — frosted panes in the top panel */}
        <div style={{
          position: "absolute",
          top: `calc(${100 / PANEL_COUNT * 0.15}% + 12px)`,
          left: 36, right: 36,
          display: "flex", gap: 10,
        }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 26,
              background: "rgba(255,255,255,0.035)",
              border: "1.5px solid rgba(255,255,255,0.07)",
              borderRadius: 3,
              boxShadow: "inset 0 1px 3px rgba(255,255,255,0.04)",
            }} />
          ))}
        </div>

        {/* Handle — two grip bars */}
        <div style={{
          position: "absolute",
          bottom: "clamp(58px, 13vh, 110px)",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex", gap: 28,
        }}>
          {[0, 1].map((i) => (
            <div key={i} style={{
              width: 52, height: 10, borderRadius: 6,
              background: "linear-gradient(to bottom, #aaa 0%, #666 40%, #444 100%)",
              boxShadow: "0 3px 10px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.4)",
            }} />
          ))}
        </div>

        {/* "Open Garage" button — travels upward with the door */}
        <div style={{
          position: "absolute",
          bottom: "clamp(120px, 25vh, 190px)",
          left: 0, right: 0,
          display: "flex", justifyContent: "center",
          zIndex: 11,
        }}>
          <motion.button
            onClick={handleOpen}
            whileTap={{ scale: 0.96 }}
            style={{
              fontFamily: "var(--font-display, sans-serif)",
              fontWeight: 800, fontSize: 16,
              letterSpacing: "0.03em",
              color: "#1A1A1A",
              background: "linear-gradient(to bottom, #C8C8C8, #888888)",
              border: "1.5px solid #888888",
              borderRadius: 100,
              padding: "14px 44px",
              cursor: "pointer",
              boxShadow: "0 4px 24px rgba(80,80,80,0.45), 2px 2px 0 rgba(0,0,0,0.7)",
              whiteSpace: "nowrap" as const,
              userSelect: "none" as const,
            }}
          >
            Open Garage ✨
          </motion.button>
        </div>
      </motion.div>

      {/* ── z:12  Branding — floats above the closed door in Phase 2 ── */}
      <motion.div
        animate={{ opacity: pastHero ? 1 : 0 }}
        transition={{ duration: 0.7, ease: "easeIn" }}
        style={{
          position: "absolute", zIndex: 12,
          bottom: "clamp(72px, 17vh, 130px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "0 32px",
          pointerEvents: "none",
        }}
      >
        <div style={{
          fontSize: 11, fontWeight: 500,
          letterSpacing: "0.22em", textTransform: "uppercase" as const,
          color: "rgba(200,200,200,0.50)",
          textAlign: "center",
          marginBottom: 10,
        }}>
          Welcome to
        </div>
        <div style={{
          fontFamily: "var(--font-display, serif)",
          fontWeight: 900,
          fontSize: "clamp(40px, 12vw, 68px)",
          letterSpacing: "-0.02em",
          lineHeight: 0.95,
          color: "#C8C8C8",
          textAlign: "center",
          textShadow: "0 2px 24px rgba(0,0,0,0.7)",
        }}>
          MY DIGITAL<br />GARAGE
        </div>
      </motion.div>

      {/* ── z:12  Footer links — appear with the branding in Phase 2 ── */}
      <motion.div
        animate={{ opacity: pastHero ? 1 : 0 }}
        transition={{ duration: 0.7, ease: "easeIn" }}
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom) + 10px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          zIndex: 12,
          pointerEvents: phase === "door" ? "auto" : "none",
        }}
      >
        <a
          href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{
            fontSize: 11, fontWeight: 500,
            color: "rgba(255,255,255,0.25)",
            textDecoration: "none", letterSpacing: "0.02em",
          }}
        >Privacy Policy</a>
        <a
          href="https://app.notion.com/p/My-Digital-Garage-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{
            fontSize: 11, fontWeight: 500,
            color: "rgba(255,255,255,0.25)",
            textDecoration: "none", letterSpacing: "0.02em",
          }}
        >Support</a>
      </motion.div>

      {/* ── z:20  Hero panel — full-screen overlay shown in Phase 1, fades out at 2.5 s ── */}
      <motion.div
        animate={{ opacity: phase === "hero" ? 1 : 0 }}
        transition={{ duration: 0.7, ease: "easeIn" }}
        style={{
          position: "absolute", inset: 0,
          zIndex: 20,
          pointerEvents: "none",   // never interactive; button is on the door
          overflow: "hidden",
        }}
      >
        {/* Full-screen hero image */}
        <img
          src="/garage-hero-bg.jpg"
          alt="My Digital Garage"
          draggable={false}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center",
            userSelect: "none", pointerEvents: "none",
          }}
        />

        {/* Bottom gradient — improves text readability */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.88) 100%)",
        }} />

        {/* "Welcome to" + "MY DIGITAL GARAGE" */}
        <div style={{
          position: "absolute",
          bottom: "clamp(72px, 17vh, 130px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "0 32px",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 500,
            letterSpacing: "0.22em", textTransform: "uppercase" as const,
            color: "rgba(200,200,200,0.50)",
            textAlign: "center",
            marginBottom: 10,
          }}>
            Welcome to
          </div>
          <div style={{
            fontFamily: "var(--font-display, serif)",
            fontWeight: 900,
            fontSize: "clamp(40px, 12vw, 68px)",
            letterSpacing: "-0.02em",
            lineHeight: 0.95,
            color: "#C8C8C8",
            textAlign: "center",
            textShadow: "0 2px 24px rgba(0,0,0,0.7)",
          }}>
            MY DIGITAL<br />GARAGE
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
}
