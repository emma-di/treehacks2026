'use client';

import { useState, useEffect } from 'react';
import { Search, X, Clock, BedDouble, Calendar, ChevronDown, ChevronUp, ArrowUpDown, Activity, FileText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { findProviderByName } from './ProviderView';

// Mock patient data
const patients = [
    {
        id: 'P027',
        name: 'Michael Anderson',
        provider: 'Dr. Sarah Chen',
        lengthOfStay: '3 days',
        room: 'R102',
        admitDate: '2026-02-11',
        condition: 'Post-surgical recovery',
        status: 'admitted' as const,
        acuity: 'Medium',
        briefing: '68M s/p appendectomy, recovering well. Ambulating independently. Pain controlled with PO meds.',
        vitals: {
            bp: '128/82',
            hr: '76',
            temp: '98.4°F',
            o2: '97%',
            rr: '16'
        }
    },
    {
        id: 'P143',
        name: 'Jennifer Williams',
        provider: 'Dr. Michael Rodriguez',
        lengthOfStay: '5 days',
        room: 'R305',
        admitDate: '2026-02-09',
        condition: 'Cardiac monitoring',
        status: 'admitted' as const,
        acuity: 'High',
        briefing: '72F admitted with NSTEMI. On telemetry, awaiting cath lab. Troponins trending down. Chest pain free x24h.',
        vitals: {
            bp: '142/88',
            hr: '82',
            temp: '98.1°F',
            o2: '95%',
            rr: '18'
        }
    },
    {
        id: 'P089',
        name: 'Robert Johnson',
        provider: 'Dr. Emily Thompson',
        lengthOfStay: '2 days',
        room: 'R208',
        admitDate: '2026-02-12',
        condition: 'Observation',
        status: 'admitted' as const,
        acuity: 'Low',
        briefing: '45M admitted for syncope workup. All tests negative. Ready for discharge pending cardiology clearance.',
        vitals: {
            bp: '118/76',
            hr: '68',
            temp: '98.6°F',
            o2: '99%',
            rr: '14'
        }
    },
    {
        id: 'P156',
        name: 'Sarah Martinez',
        provider: 'Dr. James Wilson',
        lengthOfStay: '7 days',
        room: 'R401',
        admitDate: '2026-02-07',
        condition: 'Neurological assessment',
        status: 'discharging' as const,
        expectedDischarge: '2026-02-15',
        acuity: 'Medium',
        briefing: '56F s/p ischemic CVA, right sided weakness improving. PT/OT cleared for home with services.',
        vitals: {
            bp: '136/84',
            hr: '74',
            temp: '98.3°F',
            o2: '98%',
            rr: '16'
        }
    },
    {
        id: 'P203',
        name: 'David Thompson',
        provider: 'Dr. Lisa Anderson',
        lengthOfStay: '4 days',
        room: 'R112',
        admitDate: '2026-02-10',
        condition: 'Treatment protocol',
        status: 'admitted' as const,
        acuity: 'Medium',
        briefing: '62M on chemotherapy cycle 3/6 for colon cancer. Nausea managed, counts stable. Tolerating PO intake.',
        vitals: {
            bp: '124/78',
            hr: '72',
            temp: '98.8°F',
            o2: '96%',
            rr: '15'
        }
    },
    {
        id: 'E091',
        name: 'Maria Garcia',
        provider: 'TBD',
        room: 'ER-3',
        condition: 'Chest pain evaluation',
        status: 'er' as const,
        arrivalTime: '11:45 AM',
        waitTime: '2h 15m',
        acuity: 'High',
        briefing: '58F c/o substernal chest pressure x2h. EKG shows ST changes. Awaiting troponins and cardiology consult.',
        vitals: {
            bp: '156/94',
            hr: '92',
            temp: '98.2°F',
            o2: '94%',
            rr: '20'
        }
    },
    {
        id: 'P178',
        name: 'James Brown',
        provider: 'Dr. Jennifer Martinez',
        lengthOfStay: '1 day',
        room: 'R503',
        admitDate: '2026-02-13',
        condition: 'Diagnostic imaging',
        status: 'discharging' as const,
        expectedDischarge: '2026-02-14',
        acuity: 'Low',
        briefing: '34M post CT-guided biopsy. No complications. Pain minimal. Discharge today with f/u in clinic.',
        vitals: {
            bp: '122/74',
            hr: '70',
            temp: '98.5°F',
            o2: '99%',
            rr: '14'
        }
    },
    {
        id: 'E104',
        name: 'Lisa Davis',
        provider: 'TBD',
        room: 'ER-7',
        condition: 'Abdominal pain',
        status: 'er' as const,
        arrivalTime: '01:20 PM',
        waitTime: '45m',
        acuity: 'Medium',
        briefing: '28F RLQ pain x6h, fever 100.8. Labs pending, US ordered to r/o appendicitis.',
        vitals: {
            bp: '118/72',
            hr: '88',
            temp: '100.8°F',
            o2: '98%',
            rr: '16'
        }
    },
    {
        id: 'S045',
        name: 'Christopher Wilson',
        provider: 'Dr. Sarah Chen',
        condition: 'Hip replacement surgery',
        status: 'scheduled' as const,
        scheduledDate: '2026-02-15',
        scheduledTime: '07:00 AM',
        acuity: 'Medium',
        briefing: '71M scheduled for elective R total hip arthroplasty. Pre-op clearance complete. NPO after midnight.',
        vitals: {
            bp: '130/80',
            hr: '68',
            temp: '98.4°F',
            o2: '98%',
            rr: '14'
        }
    },
    {
        id: 'P134',
        name: 'Amanda Rodriguez',
        provider: 'Dr. Emily Thompson',
        lengthOfStay: '2 days',
        room: 'R107',
        admitDate: '2026-02-12',
        condition: 'Pediatric care',
        status: 'admitted' as const,
        acuity: 'Low',
        briefing: '8F admitted for asthma exacerbation. Responding well to steroids and nebs. No distress, awaiting 24h observation.',
        vitals: {
            bp: '102/64',
            hr: '90',
            temp: '98.0°F',
            o2: '98%',
            rr: '18'
        }
    },
    {
        id: 'E087',
        name: 'Kevin Martinez',
        provider: 'TBD',
        room: 'ER-5',
        condition: 'Fracture assessment',
        status: 'er' as const,
        arrivalTime: '12:30 PM',
        waitTime: '1h 30m',
        acuity: 'Medium',
        briefing: '42M fell from ladder, suspected L radius fracture. X-ray confirms distal radius fx. Awaiting ortho for reduction.',
        vitals: {
            bp: '134/86',
            hr: '78',
            temp: '98.6°F',
            o2: '99%',
            rr: '15'
        }
    },
    {
        id: 'S062',
        name: 'Patricia Lee',
        provider: 'Dr. Michael Rodriguez',
        condition: 'Cardiac catheterization',
        status: 'scheduled' as const,
        scheduledDate: '2026-02-16',
        scheduledTime: '09:30 AM',
        acuity: 'High',
        briefing: '65F scheduled for diagnostic cath for abnormal stress test. Hx CAD, on dual antiplatelet therapy.',
        vitals: {
            bp: '138/82',
            hr: '76',
            temp: '98.3°F',
            o2: '97%',
            rr: '15'
        }
    },
];

// Export function to find patient by ID (used by FloorPlanGrid)
export const findPatientById = (patientId: string) => {
    return patients.find(p => p.id === patientId) || null;
};

// Mock daily schedule for a patient
const generatePatientSchedule = (patientId: string) => {
    return [
        {
            time: '06:00',
            activity: 'Vital Signs Check',
            provider: 'M. Garcia (Nurse)',
            notes: 'Morning assessment',
            status: 'completed'
        },
        {
            time: '07:00',
            activity: 'Morning Labs',
            provider: 'Lab - Phlebotomy',
            notes: 'CBC, BMP, troponin',
            status: 'completed'
        },
        {
            time: '08:00',
            activity: 'Medication Administration',
            provider: 'J. Patterson (Nurse)',
            notes: 'Pain management protocol',
            status: 'completed'
        },
        {
            time: '08:30',
            activity: 'Breakfast & Dietary Assessment',
            provider: 'Dietary Services',
            notes: 'Nutritional evaluation',
            status: 'completed'
        },
        {
            time: '09:30',
            activity: 'Doctor Rounds',
            provider: 'Dr. Sarah Chen',
            notes: 'Daily evaluation',
            status: 'completed'
        },
        {
            time: '10:00',
            activity: 'Wound Care',
            provider: 'K. Nguyen (Nurse)',
            notes: 'Dressing change and assessment',
            status: 'completed'
        },
        {
            time: '11:00',
            activity: 'Physical Therapy',
            provider: 'PT - K. Stevens',
            notes: 'Mobility exercises',
            status: 'upcoming'
        },
        {
            time: '12:00',
            activity: 'Lunch',
            provider: 'Dietary Services',
            notes: 'Regular diet',
            status: 'upcoming'
        },
        {
            time: '13:00',
            activity: 'Family Meeting',
            provider: 'Dr. Sarah Chen',
            notes: 'Discharge planning discussion',
            status: 'upcoming'
        },
        {
            time: '14:00',
            activity: 'Diagnostic Test',
            provider: 'Lab - Radiology',
            notes: 'Chest X-ray',
            status: 'upcoming'
        },
        {
            time: '15:00',
            activity: 'Respiratory Therapy',
            provider: 'RT - D. Foster',
            notes: 'Breathing treatments',
            status: 'upcoming'
        },
        {
            time: '16:00',
            activity: 'Medication Administration',
            provider: 'A. Brown (Nurse)',
            notes: 'Afternoon medications',
            status: 'upcoming'
        },
        {
            time: '16:30',
            activity: 'Specialist Consultation',
            provider: 'Dr. Michael Rodriguez',
            notes: 'Cardiology review',
            status: 'upcoming'
        },
        {
            time: '17:30',
            activity: 'Dinner',
            provider: 'Dietary Services',
            notes: 'Regular diet',
            status: 'upcoming'
        },
        {
            time: '18:00',
            activity: 'Vital Signs Check',
            provider: 'R. Kim (Nurse)',
            notes: 'Evening assessment',
            status: 'upcoming'
        },
        {
            time: '19:00',
            activity: 'Evening Medication',
            provider: 'A. Brown (Nurse)',
            notes: 'Scheduled medications',
            status: 'upcoming'
        },
        {
            time: '20:00',
            activity: 'Social Work Consult',
            provider: 'SW - J. Martinez',
            notes: 'Home care arrangements',
            status: 'upcoming'
        },
        {
            time: '21:00',
            activity: 'Night Shift Assessment',
            provider: 'M. Johnson (Nurse)',
            notes: 'Handoff and evaluation',
            status: 'upcoming'
        },
    ];
};

interface PatientViewProps {
    initialPatientId?: string | null;
}

export function PatientView({ initialPatientId }: PatientViewProps) {
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<typeof patients[0] | null>(null);
    const [inpatientsExpanded, setInpatientsExpanded] = useState(true);
    const [erPendingExpanded, setErPendingExpanded] = useState(true);
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
    const sortByAcuity = (a: typeof patients[0], b: typeof patients[0]) => {
        const acuityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
        return acuityOrder[a.acuity as keyof typeof acuityOrder] - acuityOrder[b.acuity as keyof typeof acuityOrder];
    };

    const sortByRoom = (a: typeof patients[0], b: typeof patients[0]) => {
        if (!a.room || !b.room) return 0;
        return a.room.localeCompare(b.room);
    };

    const sortByLength = (a: typeof patients[0], b: typeof patients[0]) => {
        // For inpatients, sort by length of stay
        if (a.lengthOfStay && b.lengthOfStay) {
            return parseInt(b.lengthOfStay) - parseInt(a.lengthOfStay);
        }
        // For ER patients, sort by wait time
        if (a.waitTime && b.waitTime) {
            return parseInt(b.waitTime) - parseInt(a.waitTime);
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
    const PatientCard = ({ patient }: { patient: typeof patients[0] }) => {
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
