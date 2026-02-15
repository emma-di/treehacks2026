"use client";

import { createContext, useContext, useState, useCallback } from "react";

type HospitalLoadingContextType = {
  showHospitalLoading: boolean;
  setShowHospitalLoading: (show: boolean) => void;
};

const HospitalLoadingContext = createContext<HospitalLoadingContextType | null>(null);

export function HospitalLoadingProvider({ children }: { children: React.ReactNode }) {
  const [showHospitalLoading, setShowHospitalLoading] = useState(false);

  return (
    <HospitalLoadingContext.Provider value={{ showHospitalLoading, setShowHospitalLoading }}>
      {children}
    </HospitalLoadingContext.Provider>
  );
}

export function useHospitalLoading() {
  const ctx = useContext(HospitalLoadingContext);
  if (!ctx) throw new Error("useHospitalLoading must be used within HospitalLoadingProvider");
  return ctx;
}
