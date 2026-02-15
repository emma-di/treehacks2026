import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import path from 'path';
import fs from 'fs';
import { ScheduleEmailTemplate } from '@/app/components/schedule-email-template';

const resend = new Resend(process.env.RESEND_API_KEY);

// Nurse 1 = emma.tingyu@gmail.com
const NURSE_1_ID = 'Nurse_1';
const NURSE_1_EMAIL = 'emma.tingyu@gmail.com';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return Response.json(
      { error: 'RESEND_API_KEY is not set' },
      { status: 500 }
    );
  }

  try {
    const outputDir = path.join(process.cwd(), 'my_crew', 'output');
    const nursePath = path.join(outputDir, 'nurse_view.json');
    const patientPath = path.join(outputDir, 'patient_view.json');

    type AssignmentRow = { room: string; start: number; stop: number; briefing: string; todos: string[] };
    let assignments: AssignmentRow[] = [];

    const formatTime = (t: number) => {
      if (t === -1) return 'N/A';
      const h = Math.floor(t);
      const m = Math.round((t % 1) * 60);
      return `${(h % 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    let patientsByRoom: Record<string, { id: string; start: number; stop: number; index: number }> = {};
    if (fs.existsSync(patientPath)) {
      const patientData = JSON.parse(fs.readFileSync(patientPath, 'utf-8'));
      const patients = patientData.patients || [];
      patients.forEach((p: { id: string; room: string | number; start: number; stop: number }, i: number) => {
        const room = typeof p.room === 'string' ? p.room : String(p.room);
        if (room && room !== '-1') {
          patientsByRoom[room] = { id: p.id, start: p.start, stop: p.stop, index: i + 1 };
        }
      });
    }

    const defaultTodos = ['Check vital signs', 'Administer medications', 'Update patient records'];

    if (fs.existsSync(nursePath)) {
      const nurseData = JSON.parse(fs.readFileSync(nursePath, 'utf-8'));
      const all = nurseData.nurse_assignments || [];
      const filtered = all
        .filter((a: { id: string }) => a.id === NURSE_1_ID)
        .sort((a: { start: number }, b: { start: number }) => a.start - b.start);

      assignments = filtered.map((a: { room: string; start: number; stop: number }) => {
        const patient = patientsByRoom[a.room];
        const shortId = patient ? `P${patient.index.toString().padStart(3, '0')}` : null;
        const briefing = shortId
          ? `Patient ${shortId} in room ${a.room}, ${formatTime(a.start)}–${formatTime(a.stop)}`
          : `Room ${a.room}, ${formatTime(a.start)}–${formatTime(a.stop)}`;
        return {
          room: a.room,
          start: a.start,
          stop: a.stop,
          briefing,
          todos: defaultTodos,
        };
      });
    }

    console.log('[send-schedule-email] Sending to', NURSE_1_EMAIL, 'assignments:', assignments.length);

    const { data, error } = await resend.emails.send({
      from: 'Atria <onboarding@resend.dev>',
      to: [NURSE_1_EMAIL],
      subject: 'Atria: Your nurse schedule is ready',
      react: ScheduleEmailTemplate({
        nurseName: 'Nurse 1',
        assignments,
        logoUrl: process.env.ATRIA_LOGO_URL || undefined,
      }),
    });

    if (error) {
      console.error('[send-schedule-email] Resend error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    console.log('[send-schedule-email] Resend success id:', data?.id);
    return Response.json({ success: true, id: data?.id });
  } catch (err: unknown) {
    console.error('[send-schedule-email] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to send schedule email' },
      { status: 500 }
    );
  }
}
