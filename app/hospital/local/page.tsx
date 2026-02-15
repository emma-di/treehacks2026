"use client";

import { useEffect } from "react";
import { FloorPlanGrid } from "../../components/FloorPlanGrid";
import { useHospitalLoading } from "../../context/HospitalLoadingContext";

export default function LocalHospitalPage() {
  const { setShowHospitalLoading } = useHospitalLoading();

  useEffect(() => {
    const t = setTimeout(() => setShowHospitalLoading(false), 2000);
    return () => clearTimeout(t);
  }, [setShowHospitalLoading]);

  return (
    <div className="h-full p-6">
      <FloorPlanGrid rows={5} cols={6} />
    </div>
  );
}
