'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { X, Info, ChevronRight } from 'lucide-react';
import type { HospitalNode } from './components/Globe3D';
import { EtherealShadow } from './components/ui/ethereal-shadow';

const OutlineTriangle = ({ className = 'text-amber-600' }: { className?: string }) => (
  <svg width="6" height="5" viewBox="0 0 6 5" fill="none" stroke="currentColor" strokeWidth="1.1" className={`inline-block mt-0.5 flex-shrink-0 ${className}`} aria-hidden>
    <path d="M0.5 0.5 L3 4.5 L5.5 0.5 Z" />
  </svg>
);

const Globe3D = dynamic(
  () => import('./components/Globe3D').then((m) => m.Globe3D),
  { ssr: false }
);

const HOSPITALS: HospitalNode[] = [
  { name: 'Stanford Health Care', href: '/hospital/local', lat: 37.4, lon: -122.2 },
  { name: 'XX Hospital', href: '/hospital/local', lat: 35.7, lon: 139.7 },
  { name: 'XY Hospital', href: '/hospital/local', lat: -23.5, lon: -46.6 },
  { name: 'Local Hospital', href: '/hospital/local', lat: 40.7, lon: -74.0 },
];

export default function Home() {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-slate-50 to-white">
      <div className="flex-1 flex gap-6 p-8 items-stretch justify-center overflow-visible">
        {/* Globe + CTA */}
        <div
          className="flex flex-col items-center justify-center transition-all duration-500 ease-in-out relative"
          style={{ flex: detailsOpen ? '0 0 50%' : '1 1 100%' }}
        >
          {/* Ethereal gold background outside the oval */}
          <div className="absolute inset-0 -z-10 rounded-2xl overflow-hidden">
            <EtherealShadow
              color="rgba(251,191,36,0.5)"
              animation={{ scale: 100, speed: 90 }}
              noise={{ opacity: 1, scale: 1.2 }}
              sizing="fill"
            />
          </div>
          <div
            className="rounded-full bg-slate-100 shadow-inner overflow-visible flex-shrink-0 transition-transform duration-300 ease-out hover:scale-105 relative"
            style={{ width: 420, height: 500 }}
          >
            <Globe3D
              width={420}
              height={500}
              hospitals={HOSPITALS}
              onHospitalClick={(href) => router.push(href)}
              showTies
              still={false}
            />
          </div>
          {!detailsOpen && (
            <p className="text-gray-500 text-sm text-center max-w-md mt-6">
              Click a hospital to view its floor plan and local system.
            </p>
          )}
        </div>

        {/* Slide-in explanation panel (like schedule modal) */}
        {detailsOpen && (
          <div
            key="details-panel"
            className="flex-1 min-w-0 bg-white rounded-xl shadow-xl border border-slate-200/80 p-6 flex flex-col overflow-hidden"
            style={{
              animation: 'slideInFade 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
              opacity: 0,
            }}
          >
            <style>
              {`
                @keyframes slideInFade {
                  from { opacity: 0; transform: translateX(24px); }
                  to { opacity: 1; transform: translateX(0); }
                }
              `}
            </style>
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">How it works</h2>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto text-sm text-slate-700 space-y-5 pr-2">
              {/* Model boxes (like diagram) */}
              <section>
                <h3 className="text-amber-700 font-semibold mb-2">Local level models</h3>
                <div className="space-y-3">
                  <div className="rounded-lg border-2 border-pink-200 bg-pink-50/80 p-3 shadow-sm">
                    <div className="font-semibold text-pink-800">Inpatient Transition Model (ITM)</div>
                    <ul className="text-slate-600 text-xs mt-1.5 space-y-0.5 list-none pl-0">
                      <li>Trained on local EHR data</li>
                      <li>Predicts odds of ED → inpatient admission</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border-2 border-pink-200 bg-pink-50/80 p-3 shadow-sm">
                    <div className="font-semibold text-pink-800">Time in Care Model (TIC)</div>
                    <ul className="text-slate-600 text-xs mt-1.5 space-y-0.5 list-none pl-0">
                      <li>Trained on local length-of-stay and flow data</li>
                      <li>Predicts time in care given IP from ED</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Agents / process — triangles only on calls / allocates */}
              <section>
                <h3 className="text-amber-700 font-semibold mb-2">Agents / process</h3>
                <ul className="space-y-1 text-sm list-none pl-0">
                  <li className="text-slate-700">Gather patient data</li>
                  <li className="text-slate-700">Resource agent (hospital context)</li>
                  <li className="text-slate-700">
                    Orchestrator agent
                    <ul className="mt-1 ml-4 space-y-0.5 list-none pl-0 border-l-2 border-amber-100 pl-2">
                      <li className="flex items-start gap-2 text-slate-600 text-xs">
                        <OutlineTriangle className="text-amber-500 text-[10px]" />
                        Calls the risk agent, which uses the 2 models
                      </li>
                      <li className="flex items-start gap-2 text-slate-600 text-xs">
                        <OutlineTriangle className="text-amber-500 text-[10px]" />
                        Allocates / makes schedule
                      </li>
                    </ul>
                  </li>
                </ul>
              </section>

              {/* Global level box */}
              <section>
                <h3 className="text-amber-700 font-semibold mb-2">Global level: federated learning</h3>
                <div className="rounded-lg border-2 border-amber-200 bg-amber-50/80 p-3 shadow-sm">
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
        )}

        {/* Button on the right to expand details (like opening schedule when clicking a room) */}
        {!detailsOpen && (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-white font-medium text-sm shadow-sm transition-colors"
            >
              <Info className="size-4" />
              How it works
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
