"use client";

import { AtriaLogo } from "./AtriaLogo";
import { NavyShaderBackground } from "./ui/navy-shader-background";
import { useHospitalLoading } from "../context/HospitalLoadingContext";

export function HospitalLoadingOverlay() {
  const { showHospitalLoading } = useHospitalLoading();

  if (!showHospitalLoading) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        width: "100vw",
        minWidth: "100vw",
        height: "100dvh",
        minHeight: "100dvh",
      }}
    >
      <NavyShaderBackground position="absolute" />
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Outer ring: dashed so rotation is visible */}
          <div
            className="absolute h-40 w-40 rounded-full border-2 border-dashed border-white/30"
            style={{ animation: "loading-orbit 12s linear infinite reverse" }}
          />
          {/* Inner ring: dashed so rotation is visible */}
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
      </div>
    </div>
  );
}
