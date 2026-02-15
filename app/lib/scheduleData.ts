import finalAllocations from '../../my_crew/output/final_allocations.json';
import hospitalSpace from '../../my_crew/output/hospital_space.json';
import nurseView from '../../my_crew/output/nurse_view.json';
import patientView from '../../my_crew/output/patient_view.json';

export interface PatientAllocation {
  id: string;
  room: string | number;
  start: number;
  stop: number;
}

export interface RoomSchedule {
  id: string;
  start: number;
  stop: number;
}

export interface NurseAssignment {
  id: string;
  room: string;
  start: number;
  stop: number;
}

// Load all data
export const patients: PatientAllocation[] = patientView.patients;
export const rooms: RoomSchedule[] = hospitalSpace.hospital_space;
export const nurses: NurseAssignment[] = nurseView.nurse_assignments;

// Create a mapping of UUID to short patient ID (P001, P002, etc.)
const patientIdMap = new Map<string, string>();
patients.forEach((patient, index) => {
  const shortId = `P${(index + 1).toString().padStart(3, '0')}`;
  patientIdMap.set(patient.id, shortId);
});

// Convert UUID to short patient ID
export function getShortPatientId(uuid: string): string {
  return patientIdMap.get(uuid) || uuid.substring(0, 8);
}

// Get full UUID from short patient ID
export function getFullPatientId(shortId: string): string | undefined {
  for (const [uuid, short] of patientIdMap.entries()) {
    if (short === shortId) return uuid;
  }
  return undefined;
}

// Helper function to convert time number to date/time string
// Assumes tomorrow's date as base
// 0 = start of tomorrow (12:00 AM), 24 = end of tomorrow (11:59 PM), 25 = 1 AM next day, etc.
export function convertTimeToDateTime(timeValue: number): Date {
  if (timeValue === -1) return new Date(); // Return current time for -1

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0); // Set to start of tomorrow

  // Add the hours from timeValue
  const result = new Date(tomorrow);
  result.setHours(Math.floor(timeValue));
  result.setMinutes((timeValue % 1) * 60);

  return result;
}

// Format time as HH:MM
export function formatTime(timeValue: number): string {
  if (timeValue === -1) return 'N/A';

  const hours = Math.floor(timeValue);
  const minutes = Math.round((timeValue % 1) * 60);

  // Handle day overflow (25 = 1 AM next day, etc.)
  const displayHours = hours % 24;
  const dayOffset = Math.floor(hours / 24);

  const timeStr = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  if (dayOffset > 0) {
    return `${timeStr} (+${dayOffset}d)`;
  }

  return timeStr;
}

// Get patient by ID
export function getPatientById(patientId: string): PatientAllocation | null {
  return patients.find(p => p.id === patientId) || null;
}

// Get room by ID
export function getRoomById(roomId: string): RoomSchedule | null {
  return rooms.find(r => r.id === roomId) || null;
}

// Get all nurse assignments for a specific nurse
export function getNurseAssignments(nurseId: string): NurseAssignment[] {
  return nurses.filter(n => n.id === nurseId).sort((a, b) => a.start - b.start);
}

// Get all nurse assignments for a specific room
export function getRoomNurseAssignments(roomId: string): NurseAssignment[] {
  return nurses.filter(n => n.room === roomId).sort((a, b) => a.start - b.start);
}

// Get patient in a room
export function getPatientInRoom(roomId: string): PatientAllocation | null {
  return patients.find(p => p.room === roomId) || null;
}

// Get all scheduled rooms (rooms with start !== -1)
export function getScheduledRooms(): RoomSchedule[] {
  return rooms.filter(r => r.start !== -1);
}

// Get all scheduled patients (patients with start !== -1)
export function getScheduledPatients(): PatientAllocation[] {
  return patients.filter(p => p.start !== -1);
}

// Get all unscheduled patients (patients with start === -1)
export function getUnscheduledPatients(): PatientAllocation[] {
  return patients.filter(p => p.start === -1);
}

// Get unique nurse IDs
export function getUniqueNurseIds(): string[] {
  const nurseIds = new Set(nurses.map(n => n.id));
  return Array.from(nurseIds).sort();
}

// Check if time is in range
export function isTimeInRange(time: number, start: number, stop: number): boolean {
  if (start === -1 || stop === -1) return false;
  return time >= start && time < stop;
}

// Get room schedule as time blocks
export function getRoomScheduleBlocks(roomId: string): Array<{
  type: 'patient' | 'nurse' | 'idle';
  start: number;
  stop: number;
  id?: string;
  room?: string;
}> {
  const blocks: Array<{
    type: 'patient' | 'nurse' | 'idle';
    start: number;
    stop: number;
    id?: string;
    room?: string;
  }> = [];

  // Add patient block if exists
  const patient = getPatientInRoom(roomId);
  if (patient && patient.start !== -1) {
    blocks.push({
      type: 'patient',
      start: patient.start,
      stop: patient.stop,
      id: patient.id,
    });
  }

  // Add nurse blocks
  const nurseAssignments = getRoomNurseAssignments(roomId);
  nurseAssignments.forEach(assignment => {
    blocks.push({
      type: 'nurse',
      start: assignment.start,
      stop: assignment.stop,
      id: assignment.id,
      room: assignment.room,
    });
  });

  return blocks.sort((a, b) => a.start - b.start);
}
