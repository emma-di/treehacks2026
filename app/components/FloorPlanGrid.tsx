'use client';

import { useState } from 'react';
import { flushSync } from 'react-dom';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import Link from 'next/link';
import { findProviderByName } from './ProviderView';
import {
    getRoomScheduleBlocks,
    getPatientInRoom,
    formatTime,
    getRoomById,
    getShortPatientId
} from '../lib/scheduleData';

const HospitalMap3D = dynamic(
    () => import('./HospitalMap3D').then((m) => m.HospitalMap3D),
    { ssr: false }
);

// Generate room schedule from real data
const generateRoomSchedule = (roomId: string) => {
    const room = getRoomById(roomId);

    // If room doesn't exist or has no schedule, return empty
    if (!room || room.start === -1) {
        return [];
    }

    const scheduleBlocks = getRoomScheduleBlocks(roomId);
    const patient = getPatientInRoom(roomId);

    // Always show full day(s) - from hour 0 to the end of schedule
    // Ensure we show at least 48 hours (2 days) or up to the latest activity
    const maxTime = Math.max(room.stop, patient?.stop || 0, 48);
    const timeSlots: Array<{
        time: string;
        timeValue: number;
        patient: string;
        patientStart: number;
        patientStop: number;
        nurses: Array<{ id: string; start: number; stop: number }>;
        isPatientBlockStart: boolean;
        patientBlockDuration: number;
    }> = [];

    // Generate ALL time slots without skipping - one slot per hour (not 0.5 hours)
    for (let t = 0; t < maxTime; t += 1) {
        const nurses = scheduleBlocks
            .filter(block => block.type === 'nurse' && t >= block.start && t < block.stop)
            .map(block => ({ id: block.id!, start: block.start, stop: block.stop }));

        const isInPatientRange = patient && patient.start !== -1 && t >= patient.start && t < patient.stop;
        const isPatientBlockStart = patient && patient.start !== -1 && t === patient.start;

        timeSlots.push({
            time: formatTime(t),
            timeValue: t,
            patient: isInPatientRange ? getShortPatientId(patient.id) : '',
            patientStart: patient && patient.start !== -1 ? patient.start : -1,
            patientStop: patient && patient.stop !== -1 ? patient.stop : -1,
            nurses,
            isPatientBlockStart: !!isPatientBlockStart,
            // Duration is the number of hour slots spanned
            patientBlockDuration: isPatientBlockStart ? Math.ceil(patient.stop - patient.start) : 0,
        });
    }

    return timeSlots;
};

interface FloorPlanGridProps {
    rows?: number;
    cols?: number;
}

export function FloorPlanGrid({ rows = 5, cols = 6 }: FloorPlanGridProps) {
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [selectedFloor, setSelectedFloor] = useState(1);

    const floors = [1, 2, 3, 4];

    const handleRoomClick = (roomId: string) => {
        flushSync(() => {
            setSelectedRoom(roomId);
        });
    };

    const handleClose = () => {
        setSelectedRoom(null);
    };

    const selectedRoomSchedule = selectedRoom ? generateRoomSchedule(selectedRoom) : [];

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            {/* 3D Hospital Map */}
            <div
                className="bg-white rounded-lg shadow-lg p-4 flex flex-col items-stretch transition-all duration-700 ease-in-out"
                style={{
                    flex: selectedRoom ? '0 0 60%' : '1 1 100%',
                }}
            >
                <div className="flex-1 min-h-[420px] flex flex-col">
                    <HospitalMap3D
                        rows={rows}
                        cols={cols}
                        selectedFloor={selectedFloor}
                        selectedRoom={selectedRoom}
                        onRoomSelect={handleRoomClick}
                    />
                </div>
                <div className="flex items-center justify-center gap-4 mt-4">
                    <p className="text-sm text-gray-500">
                        Click a room to view schedule · Right-drag to pan · Left-drag to rotate · Scroll to zoom
                    </p>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
                        <span className="text-xs text-gray-600 font-medium">Floor</span>
                        <div className="flex gap-1">
                            {floors.map((floor) => (
                                <button
                                    key={floor}
                                    onClick={() => setSelectedFloor(floor)}
                                    className={`w-7 h-7 rounded text-xs font-semibold transition-all duration-300 ${selectedFloor === floor
                                        ? 'bg-cyan-400 text-white shadow-sm'
                                        : 'bg-white text-gray-600 hover:bg-gray-100'
                                        }`}
                                >
                                    {floor}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Room Schedule Panel */}
            {selectedRoom && (
                <div
                    key={selectedRoom}
                    className="flex-1 bg-white rounded-lg shadow-xl p-6 flex flex-col"
                    style={{
                        animation: 'slideInFade 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                        opacity: 0,
                    }}
                >
                    <style>
                        {`
              @keyframes slideInFade {
                from {
                  opacity: 0;
                  transform: translateX(30px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
            `}
                    </style>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Selected Room: <span className="text-blue-600">{selectedRoom}</span>
                        </h3>
                        <button
                            onClick={handleClose}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="size-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Schedule Table */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <style>
                            {`
                .custom-scrollbar::-webkit-scrollbar {
                  width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                  background: #f1f5f9;
                  border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                  background: #cbd5e1;
                  border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background: #94a3b8;
                }
              `}
                        </style>
                        {selectedRoomSchedule.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No schedule available for this room
                            </div>
                        ) : (
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-white border-b-2 border-gray-200 z-10">
                                    <tr className="text-center">
                                        <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 pr-3 w-24">Time</th>
                                        <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 pr-3 w-1/2">Patient</th>
                                        <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 w-1/2">Nurses</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRoomSchedule.map((slot, index) => {
                                        const ROW_HEIGHT = '4rem'; // Height for each 1-hour slot

                                        return (
                                            <tr
                                                key={index}
                                                className="border-b last:border-b-0"
                                            >
                                                <td className="text-sm text-gray-600 pr-3 text-center align-top w-24" style={{ height: ROW_HEIGHT, paddingTop: '1rem' }}>
                                                    {slot.time}
                                                </td>
                                                <td className="pr-3 align-top relative w-1/2" style={{ height: ROW_HEIGHT, padding: 0 }}>
                                                    {slot.patient && slot.isPatientBlockStart && (
                                                        <div
                                                            className="bg-blue-50 border-l-4 border-blue-500 rounded px-2.5 py-2 text-sm font-medium text-blue-700 absolute left-0 right-3"
                                                            style={{
                                                                top: 0,
                                                                // Height = number of hours * row height
                                                                height: `calc(${slot.patientBlockDuration} * ${ROW_HEIGHT})`,
                                                                zIndex: 1
                                                            }}
                                                        >
                                                            <Link
                                                                href={`/patient?id=${slot.patient}`}
                                                                className="font-semibold text-sm hover:underline decoration-1 underline-offset-2 decoration-current/30"
                                                                style={{ color: 'inherit' }}
                                                            >
                                                                {slot.patient}
                                                            </Link>
                                                            <div className="text-xs text-blue-600 mt-0.5">
                                                                {formatTime(slot.patientStart)} - {formatTime(slot.patientStop)}
                                                            </div>
                                                            <div className="text-xs text-blue-500 mt-1 font-normal italic">
                                                                In room for {(slot.patientStop - slot.patientStart).toFixed(1)} hours
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="align-top w-1/2" style={{ height: ROW_HEIGHT, paddingTop: '1rem' }}>
                                                    <div className="space-y-1">
                                                        {slot.nurses.map((nurse, nurseIdx) => {
                                                            // Show nurse if their assignment overlaps with this hour slot
                                                            const nurseStartsInThisSlot = Math.floor(nurse.start) === slot.timeValue;
                                                            if (!nurseStartsInThisSlot) return null;

                                                            return (
                                                                <div
                                                                    key={nurseIdx}
                                                                    className="bg-green-50 border-l-4 border-green-500 rounded px-3 py-2 text-sm font-medium text-green-700"
                                                                    style={{ zIndex: 2, position: 'relative' }}
                                                                >
                                                                    <Link
                                                                        href={`/provider?id=${nurse.id}`}
                                                                        className="font-semibold hover:underline decoration-1 underline-offset-2 decoration-current/30"
                                                                        style={{ color: 'inherit' }}
                                                                    >
                                                                        {nurse.id}
                                                                    </Link>
                                                                    <div className="text-xs text-green-600 mt-0.5">
                                                                        {formatTime(nurse.start)} - {formatTime(nurse.stop)}
                                                                    </div>
                                                                    <div className="text-xs text-green-500 mt-1 font-normal">
                                                                        Duration: {((nurse.stop - nurse.start) * 60).toFixed(0)} min
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
