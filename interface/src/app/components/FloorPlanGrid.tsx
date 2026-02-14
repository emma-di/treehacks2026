import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router';
import { findProviderByName } from './ProviderView';

// Mock data for room schedules - now with blocks spanning multiple hours
const generateRoomSchedule = (roomNumber: string) => {
  const patients = ['P027', 'P06', 'P143', 'P089'];
  const patientConditions = [
    'Post-operative observation required',
    'Respiratory monitoring needed',
    'Cardiac monitoring in progress',
    'Pre-surgical preparation'
  ];
  
  // Generate time slots from 00:00 to 12:00 in 30-minute increments
  const times = Array.from({ length: 25 }, (_, i) => {
    const hour = Math.floor(i / 2).toString().padStart(2, '0');
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour}:${minute}`;
  });
  
  // Patient blocks: longer stays (2.5 hours each) with 30-min gaps for room reset
  const patientBlocks = [
    { startIndex: 0, duration: 5, patient: patients[0], condition: patientConditions[0] },   // 00:00-02:30
    // Gap: 02:30-03:00 for room reset
    { startIndex: 6, duration: 5, patient: patients[1], condition: patientConditions[1] },   // 03:00-05:30
    // Gap: 05:30-06:00 for room reset
    { startIndex: 12, duration: 5, patient: patients[2], condition: patientConditions[2] },  // 06:00-08:30
    // Gap: 08:30-09:00 for room reset
    { startIndex: 18, duration: 5, patient: patients[3], condition: patientConditions[3] },  // 09:00-11:30
    // Gap: 11:30-12:00 for room reset
  ];
  
  // Provider visits: shorter, intermittent (30 min each) - varied timing
  const providerVisits = [
    { index: 1, provider: 'M. Garcia', role: 'RN - Night Shift', type: 'nurse' },   // 00:30
    { index: 3, provider: 'S. Chen', role: 'MD - Rounds', type: 'doctor' },   // 01:30
    { index: 7, provider: 'K. Nguyen', role: 'RN - Medication', type: 'nurse' },   // 03:30
    { index: 9, provider: 'J. Wilson', role: 'MD - Check-in', type: 'doctor' },  // 04:30
    { index: 13, provider: 'R. Kim', role: 'RN - Vitals', type: 'nurse' },  // 06:30
    { index: 15, provider: 'A. Brown', role: 'RN - Day Shift', type: 'nurse' },  // 07:30
    { index: 19, provider: 'E. Thompson', role: 'MD - Rounds', type: 'doctor' },  // 09:30
    { index: 21, provider: 'J. Patterson', role: 'RN - Medication', type: 'nurse' },  // 10:30
  ];
  
  // Create schedule
  const schedule = times.map((time, index) => {
    // Find if this slot is part of a patient block
    const patientBlock = patientBlocks.find(
      block => index >= block.startIndex && index < block.startIndex + block.duration
    );
    
    const isPatientBlockStart = patientBlocks.find(block => block.startIndex === index);
    
    // Find if this slot has a provider visit
    const providerVisit = providerVisits.find(visit => visit.index === index);
    
    let endTime = '';
    if (isPatientBlockStart) {
      const endIndex = isPatientBlockStart.startIndex + isPatientBlockStart.duration;
      if (endIndex < times.length) {
        endTime = times[endIndex];
      } else {
        endTime = '12:00';
      }
    }
    
    return {
      time,
      patient: patientBlock?.patient || '',
      patientCondition: patientBlock?.condition || '',
      provider: providerVisit?.provider || '',
      providerRole: providerVisit?.role || '',
      providerType: providerVisit?.type || '',
      isBlockStart: !!isPatientBlockStart,
      blockDuration: isPatientBlockStart?.duration || 0,
      startTime: time,
      endTime: endTime,
    };
  });
  
  return schedule;
};

interface FloorPlanGridProps {
  rows?: number;
  cols?: number;
}

export function FloorPlanGrid({ rows = 5, cols = 6 }: FloorPlanGridProps) {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [isFloorSelectorVisible, setIsFloorSelectorVisible] = useState(true);

  const floors = [1, 2, 3, 4, 5];

  const rooms = Array.from({ length: rows * cols }, (_, i) => {
    const roomNumber = selectedFloor * 100 + i;
    return {
      id: `R${roomNumber}`,
      number: roomNumber,
    };
  });

  const handleRoomClick = (roomId: string) => {
    setSelectedRoom(roomId);
  };

  const handleClose = () => {
    setSelectedRoom(null);
  };

  const selectedRoomSchedule = selectedRoom ? generateRoomSchedule(selectedRoom) : [];

  return (
    <div className="flex gap-6 h-full overflow-hidden">
      {/* Floor Plan Grid */}
      <div 
        className="bg-white rounded-lg shadow-lg p-8 flex items-center justify-center transition-all duration-700 ease-in-out"
        style={{
          flex: selectedRoom ? '0 0 60%' : '1 1 100%',
          transform: selectedRoom ? 'translateX(0)' : 'translateX(0)',
        }}
      >
        <div className="w-full max-w-3xl">
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleRoomClick(room.id)}
                className={`aspect-square border-2 rounded-lg transition-all duration-300 hover:shadow-md flex items-center justify-center ${
                  selectedRoom === room.id
                    ? 'bg-blue-100 border-blue-500 shadow-lg scale-105'
                    : 'bg-gray-50 border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <span className={`text-sm font-medium ${
                  selectedRoom === room.id ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  {room.id}
                </span>
              </button>
            ))}
          </div>
          
          {/* Floor selector and help text */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <p className="text-sm text-gray-500">
              Click on any room to view its schedule
            </p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-200">
              <span className="text-xs text-gray-600 font-medium">Floor</span>
              <div className="flex gap-1">
                {floors.map((floor) => (
                  <button
                    key={floor}
                    onClick={() => setSelectedFloor(floor)}
                    className={`w-7 h-7 rounded text-xs font-semibold transition-all duration-300 ${
                      selectedFloor === floor
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
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-white border-b-2 border-gray-200 z-10">
                <tr className="text-center">
                  <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 pr-3 w-20">Time</th>
                  <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 pr-3 w-1/2">Patient</th>
                  <th className="pb-3 pt-2 text-sm font-semibold text-gray-700 w-1/2">Provider</th>
                </tr>
              </thead>
              <tbody>
                {selectedRoomSchedule.map((slot, index) => {
                  return (
                    <tr
                      key={index}
                      className="border-b last:border-b-0"
                    >
                      <td className="text-sm text-gray-600 pr-3 text-center align-top w-20" style={{ height: '3.5rem', paddingTop: '0.875rem' }}>{slot.time}</td>
                      <td className="pr-3 align-top relative w-1/2" style={{ height: '3.5rem', padding: 0 }}>
                        {slot.patient && slot.isBlockStart && (() => {
                          return (
                            <div 
                              className="bg-blue-50 border-l-4 border-blue-500 rounded px-2.5 py-2 text-sm font-medium text-blue-700 absolute left-0 right-3"
                              style={{
                                top: 0,
                                height: `calc(${(slot.blockDuration + 1) * 3.5}rem)`,
                                zIndex: 1
                              }}
                            >
                              <Link 
                                to={`/patient?id=${slot.patient}`}
                                className="font-semibold text-sm hover:underline decoration-1 underline-offset-2 decoration-current/30"
                                style={{ color: 'inherit' }}
                              >
                                {slot.patient}
                              </Link>
                              <div className="text-xs text-blue-600 mt-0.5">
                                {slot.startTime} - {slot.endTime}
                              </div>
                              <div className="text-xs text-blue-500 mt-1 font-normal italic">
                                {slot.patientCondition}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="align-top w-1/2" style={{ height: '3.5rem', paddingTop: '0.875rem' }}>
                        {slot.provider && (() => {
                          const providerId = findProviderByName(slot.provider);
                          return (
                            <div 
                              className={`border-l-4 rounded px-3 py-2 text-sm font-medium ${
                                slot.providerType === 'doctor'
                                  ? 'bg-purple-50 border-purple-500 text-purple-700'
                                  : 'bg-green-50 border-green-500 text-green-700'
                              }`}
                              style={{ zIndex: 2, position: 'relative' }}
                            >
                              <Link 
                                to={providerId ? `/provider?provider=${providerId}` : '#'}
                                className="font-semibold hover:underline decoration-1 underline-offset-2 decoration-current/30"
                                style={{ 
                                  color: 'inherit',
                                  cursor: providerId ? 'pointer' : 'default'
                                }}
                              >
                                {slot.provider}
                              </Link>
                              <div className={`text-xs mt-0.5 ${
                                slot.providerType === 'doctor' ? 'text-purple-600' : 'text-green-600'
                              }`}>
                                {slot.providerRole}
                              </div>
                              <div className={`text-xs mt-1 font-normal ${
                                slot.providerType === 'doctor' ? 'text-purple-500' : 'text-green-500'
                              }`}>
                                30 min visit
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}