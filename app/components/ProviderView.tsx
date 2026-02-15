'use client';

import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getNurseAssignments, formatTime, getPatientInRoom, getShortPatientId, getUniqueNurseIds } from '../lib/scheduleData';

// Mock data for doctors (not in the crew data)
const doctors = [
    { id: 'D001', name: 'Dr. Sarah Chen', field: 'MD/Cardiology' },
    { id: 'D002', name: 'Dr. Michael Rodriguez', field: 'MD/Surgery' },
    { id: 'D003', name: 'Dr. Emily Thompson', field: 'MD/Pediatrics' },
    { id: 'D004', name: 'Dr. James Wilson', field: 'MD/Neurology' },
    { id: 'D005', name: 'Dr. Lisa Anderson', field: 'MD/Oncology' },
    { id: 'D006', name: 'Dr. Robert Kumar', field: 'MD/Orthopedics' },
    { id: 'D007', name: 'Dr. Jennifer Martinez', field: 'MD/Radiology' },
    { id: 'D008', name: 'Dr. David Lee', field: 'MD/Emergency Medicine' },
];

// Get real nurse data from crew output (will be 30 nurses after backend regeneration)
const nurseIds = getUniqueNurseIds();
const nurses = nurseIds.map(id => ({
    id,
    name: id.replace('_', ' ') // Convert Nurse_1 to Nurse 1 for display
}));

// Export function to find provider by name (used by FloorPlanGrid)
export const findProviderByName = (name: string): string | null => {
    // Format: "M. Garcia" or "S. Chen"
    // For doctors: first letter of FIRST name + last name (without "Dr." prefix)
    const doctor = doctors.find(d => {
        // Remove "Dr." prefix and split the rest
        const nameParts = d.name.replace('Dr. ', '').split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts[1];
        const initial = firstName.charAt(0);
        return `${initial}. ${lastName}` === name || d.name === name;
    });

    if (doctor) return doctor.id;

    // For nurses: first letter of FIRST name + last name
    const nurse = nurses.find(n => {
        const firstName = n.name.split(' ')[0];
        const lastName = n.name.split(' ')[1] || '';
        const initial = firstName.charAt(0);
        return `${initial}. ${lastName}` === name || n.name === name;
    });

    return nurse ? nurse.id : null;
};

// Export function to get all providers (used by FloorPlanGrid for data)
export const getAllProviders = () => ({ doctors, nurses });

// Generate provider schedule from real data
const generateProviderSchedule = (providerId: string) => {
    // Check if it's a nurse
    const isNurse = nurses.some(n => n.id === providerId);

    if (isNurse) {
        const assignments = getNurseAssignments(providerId);

        return assignments.map(assignment => {
            const patient = getPatientInRoom(assignment.room);

            return {
                time: formatTime(assignment.start),
                timeValue: assignment.start,
                room: assignment.room,
                patient: patient ? getShortPatientId(patient.id) : 'N/A',
                notes: `Visit from ${formatTime(assignment.start)} to ${formatTime(assignment.stop)}`,
                duration: `${((assignment.stop - assignment.start) * 60).toFixed(0)} minutes`,
                todos: [
                    'Check vital signs',
                    'Administer medications',
                    'Update patient records'
                ]
            };
        });
    }

    // For doctors, return empty schedule (no doctor data in crew output)
    return [];
};

interface Provider {
    id: string;
    name: string;
    field?: string;
    type: 'doctor' | 'nurse';
}

interface ProviderViewProps {
    initialProviderId?: string | null;
}

export function ProviderView({ initialProviderId }: ProviderViewProps) {
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [doctorsExpanded, setDoctorsExpanded] = useState(true);
    const [nursesExpanded, setNursesExpanded] = useState(true);
    const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

    // Handle initial provider selection from URL
    useEffect(() => {
        const providerId = searchParams?.get('provider') || searchParams?.get('id') || initialProviderId;
        if (providerId) {
            const doctor = doctors.find(d => d.id === providerId);
            if (doctor) {
                setSelectedProvider({ ...doctor, type: 'doctor' });
                return;
            }

            const nurse = nurses.find(n => n.id === providerId);
            if (nurse) {
                setSelectedProvider({ ...nurse, type: 'nurse' });
            }
        }
    }, [searchParams, initialProviderId]);

    // Filter doctors based on search
    const filteredDoctors = doctors.filter(
        (doctor) =>
            doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doctor.field.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Filter nurses based on search
    const filteredNurses = nurses.filter((nurse) =>
        nurse.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex gap-6 h-full overflow-hidden">
            {/* Provider List */}
            <div
                className="bg-gray-50 flex flex-col transition-all duration-700 ease-in-out"
                style={{
                    flex: selectedProvider ? '0 0 25%' : '1 1 100%',
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
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 pr-12 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none text-gray-700 placeholder-gray-400 bg-white"
                        />
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
                    {/* Doctors Section */}
                    <div className="mb-8">
                        <div className="sticky top-0 bg-gray-50 pt-6 pb-4 z-10">
                            <button
                                onClick={() => setDoctorsExpanded(!doctorsExpanded)}
                                className="flex items-center gap-3 group w-full"
                            >
                                <h2 className="text-2xl font-bold text-blue-600">Doctors</h2>
                                <div className="h-0.5 flex-1 bg-blue-300" />
                                {doctorsExpanded ? (
                                    <ChevronUp className="size-6 text-blue-600 group-hover:scale-110 transition-transform" />
                                ) : (
                                    <ChevronDown className="size-6 text-blue-600 group-hover:scale-110 transition-transform" />
                                )}
                            </button>
                        </div>

                        <div
                            className="grid gap-4 transition-all duration-500 ease-in-out overflow-hidden"
                            style={{
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                maxHeight: doctorsExpanded ? '2000px' : '0',
                                opacity: doctorsExpanded ? 1 : 0,
                            }}
                        >
                            {filteredDoctors.map((doctor) => (
                                <div
                                    key={doctor.id}
                                    className={`rounded-lg border-2 p-4 hover:shadow-lg transition-all duration-300 cursor-pointer ${selectedProvider?.id === doctor.id
                                        ? 'bg-blue-100 border-blue-500 shadow-md'
                                        : 'bg-white border-gray-300 hover:border-blue-400'
                                        }`}
                                    onClick={() => setSelectedProvider({ ...doctor, type: 'doctor' })}
                                >
                                    <div className="font-bold text-gray-900 mb-1">{doctor.name}</div>
                                    <div className="text-xs text-gray-600">{doctor.field}</div>
                                </div>
                            ))}
                        </div>

                        {doctorsExpanded && filteredDoctors.length === 0 && (
                            <p className="text-gray-500 italic">No doctors found</p>
                        )}
                    </div>

                    {/* Nurses Section */}
                    <div>
                        <div className="sticky top-0 bg-gray-50 pb-4 z-10">
                            <button
                                onClick={() => setNursesExpanded(!nursesExpanded)}
                                className="flex items-center gap-3 group w-full"
                            >
                                <h2 className="text-2xl font-bold text-blue-600">Nurses</h2>
                                <div className="h-0.5 flex-1 bg-blue-300" />
                                {nursesExpanded ? (
                                    <ChevronUp className="size-6 text-blue-600 group-hover:scale-110 transition-transform" />
                                ) : (
                                    <ChevronDown className="size-6 text-blue-600 group-hover:scale-110 transition-transform" />
                                )}
                            </button>
                        </div>

                        <div
                            className="grid gap-4 transition-all duration-500 ease-in-out overflow-hidden"
                            style={{
                                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                                maxHeight: nursesExpanded ? '2000px' : '0',
                                opacity: nursesExpanded ? 1 : 0,
                            }}
                        >
                            {filteredNurses.map((nurse) => (
                                <div
                                    key={nurse.id}
                                    className={`rounded-lg border-2 p-4 hover:shadow-lg transition-all duration-300 cursor-pointer ${selectedProvider?.id === nurse.id
                                        ? 'bg-blue-100 border-blue-500 shadow-md'
                                        : 'bg-white border-gray-300 hover:border-blue-400'
                                        }`}
                                    onClick={() => setSelectedProvider({ ...nurse, type: 'nurse' })}
                                >
                                    <div className="font-bold text-gray-900">{nurse.name}</div>
                                </div>
                            ))}
                        </div>

                        {nursesExpanded && filteredNurses.length === 0 && (
                            <p className="text-gray-500 italic">No nurses found</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Provider Schedule Panel */}
            {selectedProvider && (
                <div
                    key={selectedProvider.id}
                    className="flex-1 bg-white rounded-lg shadow-xl p-6 flex flex-col mt-6 mr-6 mb-6"
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
              .custom-checkbox {
                appearance: none;
                -webkit-appearance: none;
                width: 1rem;
                height: 1rem;
                border: 2px solid #3b82f6;
                border-radius: 0.25rem;
                background-color: white;
                cursor: pointer;
                position: relative;
                flex-shrink: 0;
              }
              .custom-checkbox:checked {
                background-color: #3b82f6;
                border-color: #3b82f6;
              }
              .custom-checkbox:checked::after {
                content: '';
                position: absolute;
                left: 0.25rem;
                top: 0.05rem;
                width: 0.35rem;
                height: 0.6rem;
                border: solid white;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
              }
              .custom-checkbox:focus {
                outline: 2px solid #3b82f6;
                outline-offset: 2px;
              }
            `}
                    </style>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b">
                        <h3 className="text-2xl font-bold text-gray-900">
                            Selected Provider: <span className="text-blue-600">{selectedProvider.name}</span>
                        </h3>
                        <button
                            onClick={() => setSelectedProvider(null)}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="size-6 text-gray-500" />
                        </button>
                    </div>

                    {/* Schedule Table */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {generateProviderSchedule(selectedProvider.id).length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No schedule available for this provider
                            </div>
                        ) : (
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-white border-b-2 border-gray-200 z-10">
                                    <tr className="text-left">
                                        <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 pr-3 w-24">Time</th>
                                        <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 pr-3 w-20">Room</th>
                                        <th className="pb-3 pt-2 text-sm font-semibold text-gray-700">Patient & Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {generateProviderSchedule(selectedProvider.id).map((appointment, idx) => (
                                        <tr key={idx} className="border-b last:border-b-0">
                                            <td className="text-sm text-gray-600 pr-3 align-top py-4">
                                                {appointment.time}
                                            </td>
                                            <td className="pr-3 align-top py-4">
                                                <Link
                                                    href={`/?room=${appointment.room}`}
                                                    className="text-sm font-medium text-blue-600 hover:underline"
                                                >
                                                    {appointment.room}
                                                </Link>
                                            </td>
                                            <td className="align-top py-4">
                                                <div className="bg-blue-50 border-l-4 border-blue-500 rounded px-3 py-3">
                                                    <Link
                                                        href={`/patient?id=${appointment.patient}`}
                                                        className="font-semibold text-blue-700 hover:underline mb-1 inline-block"
                                                    >
                                                        {appointment.patient}
                                                    </Link>
                                                    <div className="text-xs text-blue-600 mb-1">{appointment.notes}</div>
                                                    <div className="text-xs text-blue-500 font-medium">Duration: {appointment.duration}</div>
                                                    {/* Embedded Todos */}
                                                    <div className="space-y-2 mt-3 pt-2 border-t border-blue-200">
                                                        {appointment.todos.map((todo, todoIdx) => (
                                                            <label key={todoIdx} className="flex items-start gap-2 cursor-pointer group">
                                                                <input
                                                                    type="checkbox"
                                                                    className="custom-checkbox mt-0.5"
                                                                />
                                                                <span className="text-xs text-gray-700 group-hover:text-gray-900">{todo}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
