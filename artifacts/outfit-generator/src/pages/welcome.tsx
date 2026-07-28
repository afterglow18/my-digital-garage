/**
 * WelcomePage — Garage door animation splash screen.
 *
 * Phase flow:
 *   "door"    — closed garage door covers screen, "Open Garage" button visible
 *   "opening" — door slides up (0.85 s easeOut), revealing hero interior behind it
 *   "exiting" — door is gone, hero visible; whole screen fades to black → onEnter()
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

type Phase = "door" | "opening" | "exiting";

// Number of horizontal panels drawn on the door
const PANEL_COUNT = 7;

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("door");
  const calledRef         = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (phase !== "door") return;
    setPhase("opening");
    setTimeout(() => setPhase("exiting"), 900);  // door fully up → start fade-out
    setTimeout(finish, 900 + 600);               // fade-out completes → navigate
  };

  // Pre-load hero image while the door is still covering it
  useEffect(() => {
    const img = new Image();
    img.src = "/garage-hero-bg.jpg";
  }, []);

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: 0.6, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        overflow: "hidden",
        background: "#0d0d0d",
      }}
    >

      {/* ── z:0  Dark base ── */}
      <div style={{ position: "absolute", inset: 0, background: "#0d0d0d", zIndex: 0 }} />

      {/* ── z:1  Hero image (revealed as door rises) ── */}
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

      {/* ── z:2  Gradient overlay ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.50) 55%, rgba(0,0,0,0.85) 100%)",
        zIndex: 2,
      }} />

      {/* ── z:3  Title + subtitle (revealed last as door clears the bottom) ── */}
      <div style={{
        position: "absolute", zIndex: 3,
        bottom: "clamp(72px, 17vh, 130px)",
        left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "0 32px",
        pointerEvents: "none",
      }}>
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
        <div style={{
          marginTop: 14, fontSize: 11, fontWeight: 500,
          letterSpacing: "0.25em", textTransform: "uppercase" as const,
          color: "rgba(200,200,200,0.45)", textAlign: "center",
        }}>
          your digital garage
        </div>
      </div>

      {/* ── z:5  Footer links (appear after door opens) ── */}
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        zIndex: 5,
        pointerEvents: phase === "door" ? "none" : "auto",
        opacity: phase === "door" ? 0 : 1,
      }}>
        <a
          href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
        >Privacy Policy</a>
        <a
          href="https://app.notion.com/p/My-Digital-Garage-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em" }}
        >Support</a>
      </div>

      {/* ── z:10  Garage door — slides up on open ── */}
      <motion.div
        initial={{ y: "0%" }}
        animate={{ y: phase !== "door" ? "-100%" : "0%" }}
        transition={{ duration: 0.85, ease: [0, 0, 0.35, 1] }}
        style={{
          position: "absolute", inset: 0,
          zIndex: 10,
          /* Horizontal panel texture */
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

        {/* Top edge shadow (door hanging from tracks) */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: "rgba(0,0,0,0.95)",
        }} />
        {/* Bottom edge (thickness) */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 5,
          background: "rgba(0,0,0,0.9)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.8)",
        }} />

        {/* Window row — small frosted panes in the top panel */}
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

        {/* Handle — two grip bars side by side */}
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

        {/* "Open Garage" button — travels upward with the door.
            Centred via flex wrapper so whileTap's scale doesn't fight translateX. */}
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

    </motion.div>
  );
}
