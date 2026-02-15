"use client";

import { AtriaLogo } from "../components/AtriaLogo";
import { NavyShaderBackground } from "../components/ui/navy-shader-background";

export default function LoadingPage() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{
        width: "100vw",
        minWidth: "100vw",
        height: "100dvh",
        minHeight: "100dvh",
      }}
    >
      <NavyShaderBackground position="absolute" />
      <div className="relative z-10 flex flex-col items-center justify-center gap-8">
        <div className="relative flex items-center justify-center">
          {/* Outer ring */}
          <div
            className="absolute h-40 w-40 rounded-full border-2 border-dashed border-white/30"
            style={{ animation: "loading-orbit 12s linear infinite reverse" }}
          />
          {/* Inner ring */}
          <div
            className="absolute h-32 w-32 rounded-full border-2 border-dashed border-white/40"
            style={{ animation: "loading-orbit 8s linear infinite" }}
          />
          {/* Logo with slow rotation */}
          <div
            className="flex items-center justify-center"
            style={{ animation: "loading-orbit 20s linear infinite" }}
          >
            <AtriaLogo className="text-white" size={80} />
          </div>
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-white mt-5">
          Atria
        </h1>
      </div>
    </div>
  );
}
