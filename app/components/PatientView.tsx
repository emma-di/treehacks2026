'use client';

import { useState, useEffect } from 'react';
import { Search, X, Clock, BedDouble, Calendar, ChevronDown, ChevronUp, ArrowUpDown, Activity, FileText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { findProviderByName } from './ProviderView';
import {
    getScheduledPatients,
    getUnscheduledPatients,
    formatTime,
    getRoomNurseAssignments,
    getShortPatientId
} from '../lib/scheduleData';

// Define patient type
type Patient = {
    id: string;
    name: string;
    provider: string;
    lengthOfStay?: string;
    room?: string;
    admitDate?: string;
    condition: string;
    status: 'admitted' | 'discharging' | 'er' | 'scheduled';
    acuity: 'High' | 'Medium' | 'Low';
    briefing: string;
    vitals: {
        bp: string;
        hr: string;
        temp: string;
        o2: string;
        rr: string;
    };
    startTime: number;
    stopTime: number;
    waitTime?: string;
    arrivalTime?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    expectedDischarge?: string;
};

// Get real patient data
const allScheduledPatients = getScheduledPatients();
const allUnscheduledPatients = getUnscheduledPatients();

// Transform real patient data to match the component structure
const patients: Patient[] = [
    ...allScheduledPatients.map(p => {
        const shortId = getShortPatientId(p.id);
        return {
            id: shortId,
            name: shortId,
            provider: 'Provider Assigned',
            lengthOfStay: p.stop !== -1 ? `${(p.stop - p.start).toFixed(1)} hours` : 'N/A',
            room: typeof p.room === 'string' ? p.room : 'N/A',
            admitDate: '2026-02-15', // Tomorrow's date
            condition: 'In treatment',
            status: 'admitted' as const,
            acuity: 'Medium' as const,
            briefing: `Patient scheduled from ${formatTime(p.start)} to ${formatTime(p.stop)} in room ${p.room}`,
            vitals: {
                bp: '120/80',
                hr: '72',
                temp: '98.6°F',
                o2: '98%',
                rr: '16'
            },
            startTime: p.start,
            stopTime: p.stop,
        };
    }),
    ...allUnscheduledPatients.map(p => {
        const shortId = getShortPatientId(p.id);
        return {
            id: shortId,
            name: shortId,
            provider: 'TBD',
            lengthOfStay: 'N/A',
            room: 'N/A',
            admitDate: '2026-02-15',
            condition: 'Awaiting room assignment',
            status: 'er' as const,
            acuity: 'Low' as const,
            briefing: 'Patient awaiting room assignment and schedule',
            vitals: {
                bp: '120/80',
                hr: '72',
                temp: '98.6°F',
                o2: '98%',
                rr: '16'
            },
            startTime: -1,
            stopTime: -1,
            waitTime: 'N/A',
        };
    }),
];

// Export function to find patient by ID (used by FloorPlanGrid)
export const findPatientById = (patientId: string): Patient | null => {
    return patients.find(p => p.id === patientId) || null;
};

// Generate patient schedule based on real data
const generatePatientSchedule = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);

    if (!patient || patient.startTime === -1) {
        return [];
    }

    // Get nurse assignments for the patient's room
    const roomId = typeof patient.room === 'string' ? patient.room : '';
    const nurseAssignments = roomId !== 'N/A' ? getRoomNurseAssignments(roomId) : [];

    const schedule: Array<{
        time: string;
        activity: string;
        provider: string;
        notes: string;
        status: string;
    }> = [];

    // Add room admission entry
    schedule.push({
        time: formatTime(patient.startTime),
        activity: 'Room Admission',
        provider: 'Hospital Staff',
        notes: `Admitted to ${patient.room}`,
        status: 'completed'
    });

    // Add nurse visit entries
    nurseAssignments.forEach(assignment => {
        schedule.push({
            time: formatTime(assignment.start),
            activity: 'Nurse Visit',
            provider: assignment.id,
            notes: `Visit duration: ${((assignment.stop - assignment.start) * 60).toFixed(0)} minutes`,
            status: 'upcoming'
        });
    });

    // Add discharge entry if applicable
    if (patient.stopTime !== -1) {
        schedule.push({
            time: formatTime(patient.stopTime),
            activity: 'Expected Discharge',
            provider: 'Hospital Staff',
            notes: `Leaving ${patient.room}`,
            status: 'upcoming'
        });
    }

    // Sort by time
    return schedule.sort((a, b) => {
        const timeA = parseFloat(a.time.split(':')[0]) + parseFloat(a.time.split(':')[1]) / 60;
        const timeB = parseFloat(b.time.split(':')[0]) + parseFloat(b.time.split(':')[1]) / 60;
        return timeA - timeB;
    });
};

interface PatientViewProps {
    initialPatientId?: string | null;
}

export function PatientView({ initialPatientId }: PatientViewProps) {
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [inpatientsExpanded, setInpatientsExpanded] = useState(false); // Collapsed by default
    const [erPendingExpanded, setErPendingExpanded] = useState(false); // Collapsed by default
    const [sortBy, setSortBy] = useState<'acuity' | 'room' | 'length'>('acuity');

    // Handle initial patient selection from URL
    useEffect(() => {
        const patientId = searchParams?.get('id') || initialPatientId;
        if (patientId) {
            const patient = patients.find(p => p.id === patientId);
            if (patient) {
                setSelectedPatient(patient);
            }
        }
    }, [searchParams, initialPatientId]);

    // Sort functions
    const sortByAcuity = (a: Patient, b: Patient) => {
        const acuityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
        return acuityOrder[a.acuity] - acuityOrder[b.acuity];
    };

    const sortByRoom = (a: Patient, b: Patient) => {
        if (!a.room || !b.room) return 0;
        return a.room.localeCompare(b.room);
    };

    const sortByLength = (a: Patient, b: Patient) => {
        // For inpatients, sort by length of stay
        if (a.lengthOfStay && b.lengthOfStay) {
            const aVal = parseFloat(a.lengthOfStay);
            const bVal = parseFloat(b.lengthOfStay);
            if (!isNaN(aVal) && !isNaN(bVal)) {
                return bVal - aVal;
            }
        }
        // For ER patients, sort by wait time
        if (a.waitTime && b.waitTime) {
            const aVal = parseFloat(a.waitTime);
            const bVal = parseFloat(b.waitTime);
            if (!isNaN(aVal) && !isNaN(bVal)) {
                return bVal - aVal;
            }
        }
        return 0;
    };

    const getSortFunction = () => {
        switch (sortBy) {
            case 'room': return sortByRoom;
            case 'length': return sortByLength;
            default: return sortByAcuity;
        }
    };

    // Separate patients into two groups
    const inpatients = patients
        .filter(p => p.status === 'admitted' || p.status === 'discharging')
        .filter(p =>
            searchQuery === '' ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.room && p.room.toLowerCase().includes(searchQuery.toLowerCase())) ||
            p.condition.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort(getSortFunction());

    const erPending = patients
        .filter(p => p.status === 'er' || p.status === 'scheduled')
        .filter(p =>
            searchQuery === '' ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.room && p.room.toLowerCase().includes(searchQuery.toLowerCase())) ||
            p.condition.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort(getSortFunction());

    // Get status info for styling
    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'admitted':
                return { label: 'Admitted', color: 'bg-blue-100 text-blue-700 border-blue-300' };
            case 'er':
                return { label: 'ER', color: 'bg-red-100 text-red-700 border-red-300' };
            case 'scheduled':
                return { label: 'Scheduled', color: 'bg-purple-100 text-purple-700 border-purple-300' };
            case 'discharging':
                return { label: 'Discharging', color: 'bg-green-100 text-green-700 border-green-300' };
            default:
                return { label: '', color: '' };
        }
    };

    // Patient card component (without name)
    const PatientCard = ({ patient }: { patient: Patient }) => {
        const statusInfo = getStatusInfo(patient.status);
        return (
            <div
                className={`rounded-lg border-2 p-4 hover:shadow-lg transition-all duration-300 cursor-pointer ${selectedPatient?.id === patient.id
                    ? 'bg-blue-100 border-blue-500 shadow-md'
                    : 'bg-white border-gray-300 hover:border-blue-400'
                    }`}
                onClick={() => setSelectedPatient(patient)}
            >
                {/* Status Badge */}
                <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mb-3 border ${statusInfo.color}`}>
                    {statusInfo.label}
                </div>

                {/* Patient ID - LARGE and prominent */}
                <div className="text-2xl font-bold text-gray-900 mb-3">{patient.id}</div>

                <div className="space-y-1.5">
                    {/* Room info */}
                    {patient.room && (
                        <div className="text-xs text-gray-600 flex items-center gap-1">
                            <BedDouble className="size-3" />
                            {patient.room}
                        </div>
                    )}

                    {/* Status-specific info */}
                    {patient.status === 'admitted' && patient.lengthOfStay && (
                        <div className="text-xs text-gray-600">Stay: {patient.lengthOfStay}</div>
                    )}

                    {patient.status === 'er' && (
                        <div className="text-xs text-red-600 flex items-center gap-1 font-semibold">
                            <Clock className="size-3" />
                            Wait: {patient.waitTime}
                        </div>
                    )}

                    {patient.status === 'scheduled' && (
                        <div className="text-xs text-purple-600 flex items-center gap-1">
                            <Calendar className="size-3" />
                            {patient.scheduledDate} @ {patient.scheduledTime}
                        </div>
                    )}

                    {patient.status === 'discharging' && patient.expectedDischarge && (
                        <div className="text-xs text-green-600 font-semibold">
                            Discharge: {patient.expectedDischarge}
                        </div>
                    )}

                    <div className="text-xs text-gray-500 pt-1 border-t border-gray-200">{patient.condition}</div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            {/* Patient List */}
            <div
                className="bg-gray-50 flex flex-col transition-all duration-700 ease-in-out"
                style={{
                    flex: selectedPatient ? '0 0 25%' : '1 1 100%',
                }}
            >
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
                {/* Search Bar - Fixed at top, full width */}
                <div className="bg-gray-50 pt-8 pb-4 px-4 border-b border-gray-200">
                    <div className="relative mb-3">
                        <input
                            type="text"
                            placeholder="Search patients..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 pr-12 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                    </div>

                    {/* Sort Options */}
                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="size-4 text-gray-500" />
                        <span className="text-xs text-gray-600 font-medium">Sort by:</span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setSortBy('acuity')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${sortBy === 'acuity'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                Acuity
                            </button>
                            <button
                                onClick={() => setSortBy('room')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${sortBy === 'room'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                Room
                            </button>
                            <button
                                onClick={() => setSortBy('length')}
                                className={`px-2 py-1 text-xs rounded transition-colors ${sortBy === 'length'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                Length/Wait
                            </button>
                        </div>
                    </div>
                </div>

                {/* Scrollable Content with both sections */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
                    {/* Inpatients Section */}
                    <div className="mb-8">
                        <div className="sticky top-0 bg-gray-50 pt-6 pb-4 z-10">
                            <button
                                onClick={() => setInpatientsExpanded(!inpatientsExpanded)}
                                className="flex items-center gap-3 group w-full"
                            >
                                <h2 className="text-2xl font-bold text-blue-600">Current Inpatients</h2>
                                <div className="h-0.5 flex-1 bg-blue-300" />
                                {inpatientsExpanded ? (
                                    <ChevronUp className="size-6 text-blue-600 group-hover:scale-110 transition-transform" />
                                ) : (
                                    <ChevronDown className="size-6 text-blue-600 group-hover:scale-110 transition-transform" />
                                )}
                            </button>
                        </div>

                        <div
                            className="grid gap-4 transition-all duration-500 ease-in-out overflow-hidden"
                            style={{
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                maxHeight: inpatientsExpanded ? '2000px' : '0',
                                opacity: inpatientsExpanded ? 1 : 0,
                            }}
                        >
                            {inpatients.map((patient) => (
                                <PatientCard key={patient.id} patient={patient} />
                            ))}
                        </div>

                        {inpatientsExpanded && inpatients.length === 0 && (
                            <p className="text-gray-500 italic text-center mt-8">No inpatients found</p>
                        )}
                    </div>

                    {/* ER / Pending Admissions Section */}
                    <div className="mb-8">
                        <div className="sticky top-0 bg-gray-50 pt-6 pb-4 z-10">
                            <button
                                onClick={() => setErPendingExpanded(!erPendingExpanded)}
                                className="flex items-center gap-3 group w-full"
                            >
                                <h2 className="text-2xl font-bold text-blue-600">ER / Pending Admissions</h2>
                                <div className="h-0.5 flex-1 bg-blue-300" />
                                {erPendingExpanded ? (
                                    <ChevronUp className="size-6 text-blue-600 group-hover:scale-110 transition-transform" />
                                ) : (
                                    <ChevronDown className="size-6 text-blue-600 group-hover:scale-110 transition-transform" />
                                )}
                            </button>
                        </div>

                        <div
                            className="grid gap-4 transition-all duration-500 ease-in-out overflow-hidden"
                            style={{
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                maxHeight: erPendingExpanded ? '2000px' : '0',
                                opacity: erPendingExpanded ? 1 : 0,
                            }}
                        >
                            {erPending.map((patient) => (
                                <PatientCard key={patient.id} patient={patient} />
                            ))}
                        </div>

                        {erPendingExpanded && erPending.length === 0 && (
                            <p className="text-gray-500 italic text-center mt-8">No ER/pending patients found</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Patient Schedule Panel */}
            {selectedPatient && (
                <div
                    key={selectedPatient.id}
                    className="flex-1 bg-white rounded-lg shadow-xl p-6 flex flex-col mt-2 mr-6 mb-2"
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
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                <span className="text-blue-600">{selectedPatient.name}</span>
                                <span className="text-lg text-gray-500 ml-3">{selectedPatient.id}</span>
                            </h3>
                            <div className="flex gap-6 mt-2 text-sm text-gray-600">
                                {selectedPatient.room && selectedPatient.room.startsWith('R') && (
                                    <span>
                                        <strong>Room:</strong>{' '}
                                        <Link
                                            href={`/?room=${selectedPatient.room}`}
                                            className="text-blue-600 hover:underline cursor-pointer"
                                        >
                                            {selectedPatient.room}
                                        </Link>
                                    </span>
                                )}
                                {selectedPatient.room && !selectedPatient.room.startsWith('R') && (
                                    <span><strong>Room:</strong> {selectedPatient.room}</span>
                                )}
                                <span>
                                    <strong>Provider:</strong>{' '}
                                    {selectedPatient.provider !== 'TBD' ? (
                                        <Link
                                            href={`/provider?id=${findProviderByName(selectedPatient.provider)}`}
                                            className="text-blue-600 hover:underline cursor-pointer"
                                        >
                                            {selectedPatient.provider}
                                        </Link>
                                    ) : (
                                        'TBD'
                                    )}
                                </span>
                                <span><strong>Admitted:</strong> {selectedPatient.admitDate}</span>
                                {selectedPatient.lengthOfStay && (
                                    <span><strong>Length of Stay:</strong> {selectedPatient.lengthOfStay}</span>
                                )}
                            </div>
                            <div className="mt-2 text-sm">
                                <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                                    {selectedPatient.condition}
                                </span>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedPatient(null)}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="size-6 text-gray-500" />
                        </button>
                    </div>

                    {/* Clinical Summary Section */}
                    <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                        {/* Acuity */}
                        <div className="flex items-center gap-3 mb-4">
                            <Activity className="size-5 text-gray-500" />
                            <span className="font-semibold text-gray-700">Acuity:</span>
                            <span className={`px-3 py-1 rounded-full font-bold ${selectedPatient.acuity === 'High' ? 'bg-red-100 text-red-700' :
                                selectedPatient.acuity === 'Medium' ? 'bg-orange-100 text-orange-700' :
                                    'bg-green-100 text-green-700'
                                }`}>
                                {selectedPatient.acuity}
                            </span>
                        </div>

                        {/* Clinical Briefing */}
                        <div className="mb-4">
                            <div className="flex items-start gap-2 mb-2">
                                <FileText className="size-4 text-gray-500 mt-0.5" />
                                <span className="font-semibold text-gray-700">Clinical Summary:</span>
                            </div>
                            <p className="text-sm text-gray-800 leading-relaxed pl-6">
                                {selectedPatient.briefing}
                            </p>
                        </div>

                        {/* Quick Vitals */}
                        <div>
                            <div className="font-semibold text-gray-700 mb-2">Current Vitals:</div>
                            <div className="grid grid-cols-5 gap-3 pl-6">
                                <div className="bg-white rounded px-3 py-2 border border-gray-200">
                                    <div className="text-xs text-gray-500">BP</div>
                                    <div className="font-semibold text-gray-900">{selectedPatient.vitals.bp}</div>
                                </div>
                                <div className="bg-white rounded px-3 py-2 border border-gray-200">
                                    <div className="text-xs text-gray-500">HR</div>
                                    <div className="font-semibold text-gray-900">{selectedPatient.vitals.hr}</div>
                                </div>
                                <div className="bg-white rounded px-3 py-2 border border-gray-200">
                                    <div className="text-xs text-gray-500">Temp</div>
                                    <div className="font-semibold text-gray-900">{selectedPatient.vitals.temp}</div>
                                </div>
                                <div className="bg-white rounded px-3 py-2 border border-gray-200">
                                    <div className="text-xs text-gray-500">O₂</div>
                                    <div className="font-semibold text-gray-900">{selectedPatient.vitals.o2}</div>
                                </div>
                                <div className="bg-white rounded px-3 py-2 border border-gray-200">
                                    <div className="text-xs text-gray-500">RR</div>
                                    <div className="font-semibold text-gray-900">{selectedPatient.vitals.rr}</div>
                                </div>
                            </div>
                        </div>

                        {/* EHR Button */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <button
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                                onClick={() => alert('Full EHR integration coming soon...')}
                            >
                                <FileText className="size-4" />
                                View Full Electronic Health Record
                            </button>
                        </div>
                    </div>

                    {/* Daily Schedule */}
                    <div className="mb-4">
                        <h4 className="text-lg font-semibold text-gray-700">Today's Schedule</h4>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 bg-white border-b-2 border-gray-200 z-10">
                                <tr className="text-left">
                                    <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 pr-3 w-20">Time</th>
                                    <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 pr-3">Activity</th>
                                    <th className="pb-3 pt-2 text-sm font-semibold text-gray-700">Provider</th>
                                </tr>
                            </thead>
                            <tbody>
                                {generatePatientSchedule(selectedPatient.id).map((item, idx) => (
                                    <tr key={idx} className="border-b last:border-b-0">
                                        <td className="text-sm text-gray-600 pr-3 align-top py-4">
                                            {item.time}
                                        </td>
                                        <td className="pr-3 align-top py-4">
                                            <div className={`border-l-4 rounded px-3 py-3 ${item.status === 'completed'
                                                ? 'bg-green-50 border-green-500'
                                                : 'bg-blue-50 border-blue-500'
                                                }`}>
                                                <div className={`font-semibold mb-1 ${item.status === 'completed'
                                                    ? 'text-green-700'
                                                    : 'text-blue-700'
                                                    }`}>
                                                    {item.activity}
                                                </div>
                                                <div className={`text-xs ${item.status === 'completed'
                                                    ? 'text-green-600'
                                                    : 'text-blue-600'
                                                    }`}>
                                                    {item.notes}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="align-top py-4">
                                            <div className="text-sm font-medium text-gray-700">{item.provider}</div>
                                            <div className={`text-xs mt-1 ${item.status === 'completed'
                                                ? 'text-green-600'
                                                : 'text-orange-600'
                                                }`}>
                                                {item.status === 'completed' ? '✓ Completed' : 'Upcoming'}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
