"use client";

import { HospitalLoadingProvider } from "../context/HospitalLoadingContext";
import { HospitalLoadingOverlay } from "./HospitalLoadingOverlay";
import { Header } from "./Header";

export function LayoutWithHospitalLoading({ children }: { children: React.ReactNode }) {
  return (
    <HospitalLoadingProvider>
      <HospitalLoadingOverlay />
      <div className="relative z-[1] size-full flex flex-col h-screen">
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </HospitalLoadingProvider>
  );
}
