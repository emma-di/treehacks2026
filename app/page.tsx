'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { X, Info, ChevronRight } from 'lucide-react';
import { useHospitalLoading } from './context/HospitalLoadingContext';
import type { GlobeConfig } from './components/ui/globe';
import { NavyShaderBackground } from './components/ui/navy-shader-background';

const World = dynamic(
  () => import('./components/ui/globe').then((m) => m.World),
  { ssr: false }
);

const BAY_AREA_LAT = 37.8;
const BAY_AREA_LNG = -122.4;
const CLICK_TOLERANCE_DEG = 5;

// Match globe.tsx aspect (1.2) so the sphere doesn't squish
const GLOBE_WIDTH = 560;
const GLOBE_HEIGHT = Math.round(560 / 1.2); // 467

const BAY_AREA_HUB = { lat: 37.8, lng: -122.4 };
const GLOBE_POINTS = [
  { lat: 35.7, lng: 139.7 },   // Tokyo
  { lat: 40.7, lng: -74.0 },   // NYC
  { lat: 51.5, lng: -0.1 },    // London
  { lat: -33.9, lng: 151.2 },  // Sydney
  { lat: -23.5, lng: -46.6 },  // São Paulo
  { lat: 1.3, lng: 103.8 },   // Singapore
  { lat: 19.1, lng: 72.9 },   // Mumbai
  { lat: 48.9, lng: 2.4 },    // Paris
  { lat: 43.7, lng: -79.4 },  // Toronto
  { lat: 19.4, lng: -99.1 },  // Mexico City
];
const BLUE_SHADES = ['#2563eb', '#3b82f6', '#1d4ed8', '#60a5fa', '#1e40af'];

const GLOBE_DATA = GLOBE_POINTS.map((p, i) => ({
  order: i + 1,
  startLat: p.lat,
  startLng: p.lng,
  endLat: BAY_AREA_HUB.lat,
  endLng: BAY_AREA_HUB.lng,
  arcAlt: 0.25,
  color: BLUE_SHADES[i % BLUE_SHADES.length],
}));

const GLOBE_CONFIG: GlobeConfig = {
  pointSize: 2.5,
  globeColor: '#ffffff',
  globeOpacity: 0,
  pointColor: '#fbbf24',
  ambientLight: '#ffffff',
  directionalLeftLight: '#ffffff',
  directionalTopLight: '#ffffff',
  pointLight: '#ffffff',
  showAtmosphere: false,
  atmosphereColor: '#ffffff',
  atmosphereAltitude: 0.18,
  polygonColor: 'rgba(251, 191, 36, 0.85)',
  emissive: '#000000',
  emissiveIntensity: 0,
  shininess: 0.5,
  arcTime: 450,
  arcLength: 0.85,
  arcDashGap: 3,
  autoRotate: true,
  autoRotateSpeed: 0.8,
};

const OutlineTriangle = ({ className = 'text-amber-600' }: { className?: string }) => (
  <svg width="6" height="5" viewBox="0 0 6 5" fill="none" stroke="currentColor" strokeWidth="1.1" className={`inline-block mt-0.5 flex-shrink-0 ${className}`} aria-hidden>
    <path d="M0.5 0.5 L3 4.5 L5.5 0.5 Z" />
  </svg>
);

export default function Home() {
  const router = useRouter();
  const { setShowHospitalLoading } = useHospitalLoading();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleGlobePointClick = (lat: number, lng: number) => {
    if (
      Math.abs(lat - BAY_AREA_LAT) <= CLICK_TOLERANCE_DEG &&
      Math.abs(lng - BAY_AREA_LNG) <= CLICK_TOLERANCE_DEG
    ) {
      setShowHospitalLoading(true);
      router.push('/hospital/local');
    }
  };

  const modalContent = detailsOpen ? (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(15, 23, 42, 0.2)',
        backdropFilter: 'blur(8px)',
        animation: 'modalFadeIn 0.2s ease-out forwards',
      }}
      onClick={() => setDetailsOpen(false)}
      aria-modal="true"
      role="dialog"
      aria-label="How it works"
    >
      <style>
        {`
          @keyframes modalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes modalSlideIn {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
      <div
        className="bg-white rounded-xl shadow-2xl border border-blue-200/80 p-6 flex flex-col max-h-[85vh] w-full max-w-xl animate-[modalSlideIn_0.25s_cubic-bezier(0.4,0,0.2,1)_forwards]"
        onClick={(e) => e.stopPropagation()}
        style={{ flexShrink: 0 }}
      >
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900">How it works</h2>
          <button
            type="button"
            onClick={() => setDetailsOpen(false)}
            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-blue-600"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto text-sm text-slate-700 space-y-5 pr-2">
          <section>
            <h3 className="text-blue-700 font-semibold mb-2">Local level models</h3>
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50/80 p-3 shadow-sm">
                <div className="font-semibold text-blue-800">Inpatient Transition Model (ITM)</div>
                <ul className="text-slate-600 text-xs mt-1.5 space-y-0.5 list-none pl-0">
                  <li>Trained on local EHR data</li>
                  <li>Predicts odds of ED → inpatient admission</li>
                </ul>
              </div>
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50/80 p-3 shadow-sm">
                <div className="font-semibold text-blue-800">Time in Care Model (TIC)</div>
                <ul className="text-slate-600 text-xs mt-1.5 space-y-0.5 list-none pl-0">
                  <li>Trained on local length-of-stay and flow data</li>
                  <li>Predicts time in care given IP from ED</li>
                </ul>
              </div>
            </div>
          </section>
          <section>
            <h3 className="text-blue-700 font-semibold mb-2">Agents / process</h3>
            <ul className="space-y-1 text-sm list-none pl-0">
              <li className="text-slate-700">Gather patient data</li>
              <li className="text-slate-700">Resource agent (hospital context)</li>
              <li className="text-slate-700">
                Orchestrator agent
                <ul className="mt-1 ml-4 space-y-0.5 list-none pl-0 border-l-2 border-blue-100 pl-2">
                  <li className="flex items-start gap-2 text-slate-600 text-xs">
                    <OutlineTriangle className="text-blue-500 text-[10px]" />
                    Calls the risk agent, which uses the 2 models
                  </li>
                  <li className="flex items-start gap-2 text-slate-600 text-xs">
                    <OutlineTriangle className="text-blue-500 text-[10px]" />
                    Allocates / makes schedule
                  </li>
                </ul>
              </li>
            </ul>
          </section>
          <section>
            <h3 className="text-blue-700 font-semibold mb-2">Global level: federated learning</h3>
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50/80 p-3 shadow-sm">
              <ul className="text-slate-700 text-xs space-y-1 list-none pl-0">
                <li>Federated learning: train global model</li>
                <li>Hospitals without a local model can use the global model (e.g. underresourced areas)</li>
              </ul>
            </div>
          </section>
          <p className="text-slate-500 italic text-xs pt-1">
            The ties on the globe indicate when a site participates in training the global model.
          </p>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative min-h-full flex flex-col">
      <NavyShaderBackground position="absolute" />
      <div className="relative z-10 flex flex-1 p-8 items-center justify-center">
        {/* Globe — fixed size, aspect 1.2 to match Canvas so it never squishes */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div
            className="rounded-[2rem] overflow-hidden flex-shrink-0 transition-transform duration-300 ease-out hover:scale-[1.02]"
            style={{
              width: GLOBE_WIDTH,
              height: GLOBE_HEIGHT,
              minWidth: GLOBE_WIDTH,
              minHeight: GLOBE_HEIGHT,
              maxWidth: GLOBE_WIDTH,
              maxHeight: GLOBE_HEIGHT,
            }}
          >
            <World
              globeConfig={GLOBE_CONFIG}
              data={GLOBE_DATA}
              onPointClick={handleGlobePointClick}
            />
          </div>
          <p className="text-slate-400 text-sm text-center max-w-md mt-6">
            Click a node to view the hospital floor plan and local system.
          </p>
        </div>
      </div>

      {mounted && detailsOpen && createPortal(modalContent, document.body)}

      {!detailsOpen && (
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0f172a] hover:bg-[#1e3a5f] text-white font-medium text-sm shadow-md transition-colors z-10"
        >
          <Info className="size-4" />
          How it works
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
