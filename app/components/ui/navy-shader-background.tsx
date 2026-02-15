"use client";

import { createPortal } from "react-dom";
import { MeshGradient } from "@paper-design/shaders-react";

export function NavyShaderBackground({
  position = "fixed",
}: {
  /** "absolute" = fill only parent (e.g. home page); "fixed" = full viewport */
  position?: "fixed" | "absolute";
}) {
  const content = (
    <div
      className={`${position === "absolute" ? "absolute" : "fixed"} inset-0 z-0 overflow-hidden bg-[#020308]`}
      style={{
        width: "100vw",
        minWidth: "100vw",
        height: "100dvh",
        minHeight: "100dvh",
      }}
    >
      <MeshGradient
        style={{ width: "100%", height: "100%", display: "block" }}
        colors={["#020308", "#050518", "#0a0825", "#030510"]}
        distortion={0.8}
        swirl={0.1}
        grainMixer={0}
        grainOverlay={0}
        speed={1}
      />
      {/* Darken center so globe stands out */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 48%, rgba(2,3,8,0.85) 0%, rgba(2,3,8,0.4) 45%, transparent 70%)",
        }}
      />
      {/* Subtle starfield */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `radial-gradient(1.5px 1.5px at 20% 30%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1.5px 1.5px at 60% 20%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 80% 50%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 40% 70%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 15% 60%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1.5px 1.5px at 70% 35%, rgba(255,255,255,0.4), transparent)`,
          backgroundSize: "200% 200%",
        }}
      />
    </div>
  );

  if (position === "fixed" && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
