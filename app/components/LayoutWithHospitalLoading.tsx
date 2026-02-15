"use client";

import { HospitalLoadingProvider } from "../context/HospitalLoadingContext";
import { HospitalLoadingOverlay } from "./HospitalLoadingOverlay";
import { Header } from "./Header";

export function LayoutWithHospitalLoading({ children }: { children: React.ReactNode }) {
  return (
    <HospitalLoadingProvider>
      <HospitalLoadingOverlay />
      <div className="size-full flex flex-col h-screen">
        <Header />
        <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
      </div>
    </HospitalLoadingProvider>
  );
}
