/**
 * WelcomePage — Garage hero splash screen.
 *
 * IDLE   : garage-hero-bg.jpg fills the screen with dark overlay, title + button.
 * EXITING: fades out → onEnter().
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<"idle" | "exiting">("idle");
  const calledRef         = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (phase !== "idle") return;
    setPhase("exiting");
    setTimeout(finish, 650);
  };

  // Pre-load the hero image
  useEffect(() => {
    const img = new Image();
    img.src = "/garage-hero-bg.jpg";
  }, []);

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: 0.65, ease: "easeIn" }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* ── Hero background image ── */}
      <img
        src="/garage-hero-bg.jpg"
        alt="My Digital Garage"
        draggable={false}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          zIndex: 0,
          userSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* ── Dark gradient overlay for text legibility ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.82) 100%)",
        zIndex: 1,
      }} />

      {/* ── Main content ── */}
      <div style={{
        position: "relative", zIndex: 4,
        display: "flex", flexDirection: "column",
        alignItems: "center",
        width: "100%",
        padding: "0 32px",
        marginTop: "auto",
        paddingBottom: "clamp(80px, 18vh, 140px)",
      }}>
        {/* Title */}
        <div style={{
          fontFamily: "var(--font-display, serif)",
          fontWeight: 900,
          fontSize: "clamp(40px, 12vw, 68px)",
          letterSpacing: "-0.02em",
          lineHeight: 0.95,
          color: "#C8C8C8",
          textAlign: "center",
          textShadow: "0 2px 24px rgba(0,0,0,0.6)",
        }}>
          MY DIGITAL<br />GARAGE
        </div>

        {/* Subtitle */}
        <div style={{
          marginTop: 14,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.25em",
          textTransform: "uppercase" as const,
          color: "rgba(200,200,200,0.50)",
          textAlign: "center",
        }}>
          your digital garage
        </div>

        {/* Button */}
        <motion.button
          onClick={handleOpen}
          whileTap={{ scale: 0.96 }}
          style={{
            marginTop: 36,
            fontFamily: "var(--font-display, sans-serif)",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: "0.03em",
            color: "#1A1A1A",
            background: "linear-gradient(to bottom, #C8C8C8, #888888)",
            border: "1.5px solid #888888",
            borderRadius: 100,
            padding: "14px 44px",
            cursor: "pointer",
            boxShadow: "0 4px 24px rgba(80,80,80,0.50), 2px 2px 0 rgba(0,0,0,0.7)",
            whiteSpace: "nowrap" as const,
          }}
        >
          Open Garage ✨
        </motion.button>
      </div>

      {/* ── Footer links ── */}
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        zIndex: 210,
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
    </motion.div>
  );
}
