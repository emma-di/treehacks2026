"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import { AtriaLogo } from "../../components/AtriaLogo";

export default function HospitalLoading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020308]">
      <div className="absolute inset-0 overflow-hidden">
        <MeshGradient
          width={1280}
          height={720}
          colors={["#020308", "#050518", "#0a0825", "#030510"]}
          distortion={0.8}
          swirl={0.1}
          grainMixer={0}
          grainOverlay={0}
          speed={1}
        />
      </div>
      {/* Center: logo with orbiting motion */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Orbiting ring */}
          <div
            className="absolute h-32 w-32 rounded-full border border-white/20"
            style={{ animation: "loading-orbit 8s linear infinite" }}
          />
          <div
            className="absolute h-40 w-40 rounded-full border border-white/10"
            style={{ animation: "loading-orbit 12s linear infinite reverse" }}
          />
          {/* Logo with slow orbit */}
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
