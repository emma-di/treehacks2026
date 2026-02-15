'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, Info, ChevronRight } from 'lucide-react';
import { Globe3D } from './components/Globe3D';

const HOSPITALS = [
  { name: 'Stanford Health Care', href: '/hospital/local', lat: 37.44, lon: -122.14 },
  { name: 'XX Hospital', href: '/hospital/local', lat: 37.7, lon: -122.2 },
  { name: 'XY Hospital', href: '/hospital/local', lat: 37.6, lon: -122.0 },
  { name: 'Local Hospital', href: '/hospital/local', lat: 37.8, lon: -122.4 },
];

const OutlineTriangle = ({ className = 'text-amber-600' }: { className?: string }) => (
  <svg width="6" height="5" viewBox="0 0 6 5" fill="none" stroke="currentColor" strokeWidth="1.1" className={`inline-block mt-0.5 flex-shrink-0 ${className}`} aria-hidden>
    <path d="M0.5 0.5 L3 4.5 L5.5 0.5 Z" />
  </svg>
);

export default function Home() {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
    <div className="min-h-full flex flex-col bg-gradient-to-b from-slate-50 to-white">
      <div className="flex-1 flex p-8 items-center justify-center">
        {/* Globe — fixed size, never changes */}
        <div className="flex flex-col items-center flex-shrink-0">
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
            className="flex-1 min-w-0 bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/60 p-7 flex flex-col overflow-hidden"
          >
            <style>
              {`
                @keyframes slideInFade {
                  from { opacity: 0; transform: translateX(24px); }
                  to { opacity: 1; transform: translateX(0); }
                }
              `}
            </style>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200/80">
              <h2 className="text-xl font-semibold text-slate-800 tracking-tight">How it works</h2>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto text-sm text-slate-700 space-y-6 pr-2">
              {/* Local level models */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-700 mb-3 pl-3 border-l-4 border-blue-400">Local level models</h3>
                <div className="space-y-3">
                  <div className="rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/90 to-slate-50/80 p-4 shadow-sm">
                    <div className="font-semibold text-blue-900">Inpatient Transition Model (ITM)</div>
                    <ul className="text-slate-600 text-xs mt-2 space-y-1 list-none pl-0">
                      <li>· Trained on local EHR data</li>
                      <li>· Predicts odds of ED → inpatient admission</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/90 to-slate-50/80 p-4 shadow-sm">
                    <div className="font-semibold text-blue-900">Time in Care Model (TIC)</div>
                    <ul className="text-slate-600 text-xs mt-2 space-y-1 list-none pl-0">
                      <li>· Trained on local length-of-stay and flow data</li>
                      <li>· Predicts time in care given IP from ED</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Agents / process */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 mb-3 pl-3 border-l-4 border-slate-400">Agents / process</h3>
                <ul className="space-y-2 text-sm list-none pl-0">
                  <li className="text-slate-700 py-0.5">Gather patient data</li>
                  <li className="text-slate-700 py-0.5">Resource agent (hospital context)</li>
                  <li className="text-slate-700 pt-0.5">
                    Orchestrator agent
                    <ul className="mt-2 ml-4 space-y-1 list-none pl-0 border-l-2 border-slate-200 pl-3">
                      <li className="flex items-start gap-2 text-slate-600 text-xs">
                        <OutlineTriangle className="text-blue-500 text-[10px] flex-shrink-0 mt-0.5" />
                        Calls the risk agent, which uses the 2 models
                      </li>
                      <li className="flex items-start gap-2 text-slate-600 text-xs">
                        <OutlineTriangle className="text-blue-500 text-[10px] flex-shrink-0 mt-0.5" />
                        Allocates / makes schedule
                      </li>
                    </ul>
                  </li>
                </ul>
              </section>

              {/* Global level */}
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700 mb-3 pl-3 border-l-4 border-amber-400">Global level: federated learning</h3>
                <div className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-yellow-50/50 p-4 shadow-sm">
                  <ul className="text-slate-700 text-xs space-y-1.5 list-none pl-0">
                    <li><span className="font-medium text-slate-800">Federated learning:</span> train global model</li>
                    <li>Hospitals without a local model can use the global model (e.g. underresourced areas)</li>
                  </ul>
                </div>
              </section>

              <p className="text-slate-500 italic text-xs pt-2 pb-1">
                The ties on the globe indicate when a site participates in training the global model.
              </p>
            </div>
          </div>
        )}
      </div>

      {mounted && detailsOpen && createPortal(modalContent, document.body)}

      {!detailsOpen && (
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm shadow-md transition-colors z-10"
        >
          <Info className="size-4" />
          How it works
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
