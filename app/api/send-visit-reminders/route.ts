/**
 * Visit reminders: 15 minutes before a nurse visit, send the nurse an email with
 * a todo list (from summaries) at the top and previous nurse–patient conversation summaries.
 *
 * Call GET or POST /api/send-visit-reminders every minute (e.g. cron or Vercel Cron).
 * Optional: ?nowHours=10 to simulate "current time" for testing (triggers for visits at 10:15).
 */
import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Nurse ID -> email. Extend via env (e.g. NURSE_EMAILS=Nurse_1:a@b.com,Nurse_2:c@d.com) or add here. */
function getNurseEmail(nurseId: string): string | null {
  const fromEnv = process.env.NURSE_EMAILS;
  if (fromEnv) {
    const pairs = fromEnv.split(',').map((s) => s.trim().split(':'));
    for (const [id, email] of pairs) {
      if (id === nurseId && email) return email;
    }
  }
  if (nurseId === 'Nurse_1') return process.env.NURSE_1_EMAIL ?? 'emma.tingyu@gmail.com';
  return null;
}

const REMINDER_WINDOW_MIN = 14 / 60; // 14 min from now
const REMINDER_WINDOW_MAX = 16 / 60; // 16 min from now
const SENT_DEBOUNCE_MS = 55 * 60 * 1000; // don't send again for same visit for 55 min

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSummariesPath(): string {
  return path.join(process.cwd(), 'data', 'patient_visit_summaries.json');
}

function getSentPath(): string {
  return path.join(process.cwd(), 'data', 'visit_reminders_sent.json');
}

type SummaryEntry = { summary: string; transcription?: string; updatedAt: string; providerId?: string | null };

function loadSummariesForPatient(patientShortId: string): SummaryEntry[] {
  const p = getSummariesPath();
  if (!fs.existsSync(p)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    const val = raw[patientShortId];
    if (Array.isArray(val)) return val as SummaryEntry[];
    if (val && typeof val === 'object' && 'summary' in (val as object)) {
      const o = val as Record<string, unknown>;
      return [{ summary: String(o.summary ?? ''), transcription: o.transcription as string | undefined, updatedAt: String(o.updatedAt ?? ''), providerId: (o.providerId as string | null) ?? null }];
    }
    return [];
  } catch {
    return [];
  }
}

function formatTime(timeValue: number): string {
  if (timeValue === -1) return 'N/A';
  const hours = Math.floor(timeValue);
  const minutes = Math.round((timeValue % 1) * 60);
  const displayHours = hours % 24;
  const dayOffset = Math.floor(hours / 24);
  const timeStr = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return dayOffset > 0 ? `${timeStr} (+${dayOffset}d)` : timeStr;
}

const DEFAULT_TODOS = ['Check vital signs', 'Administer medications', 'Update patient records'];

async function getTodosFromSummaries(summaries: SummaryEntry[]): Promise<string[]> {
  if (summaries.length === 0 || !process.env.OPENAI_API_KEY) return DEFAULT_TODOS;
  const combined = summaries.map((e) => e.summary).join('\n\n').trim();
  if (!combined) return DEFAULT_TODOS;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'From the given nurse–patient conversation summaries, extract 3–5 concrete action items for the next nurse visiting this patient. Reply with only a JSON array of strings, e.g. ["Check vital signs", "Review pain level"]. No other text.',
        },
        { role: 'user', content: combined },
      ],
      max_tokens: 200,
    });
    const text = (completion.choices[0]?.message?.content ?? '').trim();
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') && parsed.length > 0) return parsed as string[];
  } catch {
    // fallback
  }
  return DEFAULT_TODOS;
}

function nurseLabel(entry: SummaryEntry): string {
  return entry.providerId ? entry.providerId.replace('_', ' ') : 'Nurse (unknown)';
}

function buildReminderHtml(
  patientShortId: string,
  room: string,
  visitStart: number,
  visitStop: number,
  todos: string[],
  summaries: SummaryEntry[]
): string {
  const visitTimeStr = `${formatTime(visitStart)} – ${formatTime(visitStop)}`;
  const todosHtml =
    '<ul style="margin:0 0 20px 0;padding-left:20px;color:#334155;font-size:14px;">' +
    todos.map((t) => `<li style="margin-bottom:4px;">${escapeHtml(t)}</li>`).join('') +
    '</ul>';
  let summariesHtml = '';
  if (summaries.length === 0) {
    summariesHtml = '<p style="color:#64748b;font-size:14px;">No conversation summaries for this patient yet.</p>';
  } else {
    summariesHtml = summaries
      .map(
        (e) => `
        <div style="margin-bottom:16px;padding:12px;background:#f8fafc;border-radius:8px;border-left:4px solid #3b82f6;">
          <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;font-weight:600;">${escapeHtml(nurseLabel(e))} · ${new Date(e.updatedAt).toLocaleString()}</p>
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(e.summary)}</p>
        </div>`
      )
      .join('');
  }
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Visit reminder – ${escapeHtml(patientShortId)}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#334155;">
  <h1 style="color:#1e3a5f;margin-bottom:8px;">Visit in 15 minutes</h1>
  <p style="color:#475569;margin-bottom:20px;">Patient <strong>${escapeHtml(patientShortId)}</strong> · Room <strong>${escapeHtml(room)}</strong> · ${visitTimeStr}</p>
  <h2 style="color:#1e3a5f;font-size:16px;margin-bottom:12px;">Todo (from summaries)</h2>
  ${todosHtml}
  <h2 style="color:#1e3a5f;font-size:16px;margin-bottom:12px;">Conversation summaries</h2>
  ${summariesHtml}
  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Atria · Visit reminder</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function recordSent(nurseId: string, patientShortId: string, start: number): Promise<void> {
  const key = `${nurseId}|${patientShortId}|${start}`;
  const p = getSentPath();
  const dir = path.dirname(p);
  await fsPromises.mkdir(dir, { recursive: true });
  let data: Record<string, number> = {};
  try {
    const raw = await fsPromises.readFile(p, 'utf-8');
    data = JSON.parse(raw);
  } catch {
    // file missing or invalid
  }
  data[key] = Date.now();
  await fsPromises.writeFile(p, JSON.stringify(data, null, 2), 'utf-8');
}

function wasSentRecently(nurseId: string, patientShortId: string, start: number): boolean {
  const key = `${nurseId}|${patientShortId}|${start}`;
  const p = getSentPath();
  if (!fs.existsSync(p)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, number>;
    const sentAt = data[key];
    if (sentAt == null) return false;
    return Date.now() - sentAt < SENT_DEBOUNCE_MS;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  return runReminders(request);
}

export async function POST(request: NextRequest) {
  return runReminders(request);
}

async function runReminders(request: NextRequest): Promise<Response> {
  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: 'RESEND_API_KEY is not set' }, { status: 500 });
  }

  try {
    const url = request.nextUrl;
    let nowHours: number;
    const param = url.searchParams.get('nowHours');
    if (param != null && param !== '') {
      nowHours = parseFloat(param);
      if (Number.isNaN(nowHours)) nowHours = new Date().getHours() + new Date().getMinutes() / 60;
    } else {
      const d = new Date();
      nowHours = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
    }

    const outputDir = path.join(process.cwd(), 'my_crew', 'output');
    const nursePath = path.join(outputDir, 'nurse_view.json');
    const patientPath = path.join(outputDir, 'patient_view.json');

    if (!fs.existsSync(nursePath) || !fs.existsSync(patientPath)) {
      return Response.json({ message: 'No schedule data', sent: 0 });
    }

    const nurseData = JSON.parse(fs.readFileSync(nursePath, 'utf-8'));
    const patientData = JSON.parse(fs.readFileSync(patientPath, 'utf-8'));
    const assignments: { id: string; room: string; start: number; stop: number }[] = nurseData.nurse_assignments || [];
    const patients: { id: string; room: string | number }[] = patientData.patients || [];

    const patientsByRoom: Record<string, { shortId: string }> = {};
    patients.forEach((p: { id: string; room: string | number }, i: number) => {
      const room = String(p.room);
      if (room && room !== '-1') {
        patientsByRoom[room] = { shortId: `P${(i + 1).toString().padStart(3, '0')}` };
      }
    });

    const minStart = nowHours + REMINDER_WINDOW_MIN;
    const maxStart = nowHours + REMINDER_WINDOW_MAX;
    const due = assignments.filter((a: { start: number }) => a.start >= minStart && a.start <= maxStart);

    const results: { nurseId: string; patientShortId: string; room: string; start: number; sent: boolean; error?: string }[] = [];
    let sentCount = 0;

    for (const a of due) {
      const patient = patientsByRoom[a.room];
      const patientShortId = patient?.shortId ?? 'N/A';
      const email = getNurseEmail(a.id);
      if (!email) {
        results.push({ nurseId: a.id, patientShortId, room: a.room, start: a.start, sent: false, error: 'No email for nurse' });
        continue;
      }
      if (wasSentRecently(a.id, patientShortId, a.start)) {
        results.push({ nurseId: a.id, patientShortId, room: a.room, start: a.start, sent: false, error: 'Already sent recently' });
        continue;
      }

      const summaries = loadSummariesForPatient(patientShortId);
      const todos = await getTodosFromSummaries(summaries);
      const html = buildReminderHtml(patientShortId, a.room, a.start, a.stop, todos, summaries);

      const { data, error } = await resend.emails.send({
        from: 'Atria <onboarding@resend.dev>',
        to: [email],
        subject: `Atria: Visit in 15 min – ${patientShortId} (Room ${a.room})`,
        html,
      });

      if (error) {
        results.push({ nurseId: a.id, patientShortId, room: a.room, start: a.start, sent: false, error: error.message });
        continue;
      }
      await recordSent(a.id, patientShortId, a.start);
      sentCount++;
      results.push({ nurseId: a.id, patientShortId, room: a.room, start: a.start, sent: true });
      console.log('[send-visit-reminders] Sent to', email, 'for', patientShortId, 'room', a.room, 'at', formatTime(a.start));
    }

    return Response.json({
      message: due.length ? `Checked ${due.length} visit(s) in 15-min window` : 'No visits in 15-min window',
      nowHours,
      window: [minStart, maxStart],
      results,
      sent: sentCount,
    });
  } catch (err: unknown) {
    console.error('[send-visit-reminders] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to run visit reminders' },
      { status: 500 }
    );
  }
}
