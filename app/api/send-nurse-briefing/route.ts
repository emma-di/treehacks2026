/**
 * Manual send briefings: send the selected nurse one email with all their visits,
 * a todo list (from summaries) at the top of each patient block, and conversation summaries.
 * Called from the Provider (nurse) view "Send briefings" button.
 */
import { NextRequest } from 'next/server';
import { Resend } from 'resend';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';

const resend = new Resend(process.env.RESEND_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

function getSummariesPath(): string {
  return path.join(process.cwd(), 'data', 'patient_visit_summaries.json');
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function buildBriefingHtml(
  nurseName: string,
  assignments: { patientShortId: string; room: string; start: number; stop: number; summaries: SummaryEntry[]; todos: string[] }[]
): string {
  const visitsHtml = assignments
    .map((a) => {
      const visitTimeStr = `${formatTime(a.start)} – ${formatTime(a.stop)}`;
      const todosHtml =
        '<ul style="margin:0 0 16px 0;padding-left:20px;color:#334155;font-size:14px;">' +
        a.todos.map((t) => `<li style="margin-bottom:4px;">${escapeHtml(t)}</li>`).join('') +
        '</ul>';
      let summariesHtml = '';
      if (a.summaries.length === 0) {
        summariesHtml = '<p style="color:#64748b;font-size:14px;margin:0;">No conversation summaries for this patient yet.</p>';
      } else {
        summariesHtml = a.summaries
          .map(
            (e) => `
          <div style="margin-bottom:12px;padding:12px;background:#f8fafc;border-radius:8px;border-left:4px solid #3b82f6;">
            <p style="margin:0 0 6px 0;font-size:12px;color:#64748b;font-weight:600;">${escapeHtml(nurseLabel(e))} · ${new Date(e.updatedAt).toLocaleString()}</p>
            <p style="margin:0;color:#334155;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(e.summary)}</p>
          </div>`
          )
          .join('');
      }
      return `
        <div style="margin-bottom:24px;padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;">
          <h3 style="color:#1e3a5f;margin:0 0 8px 0;font-size:16px;">${escapeHtml(a.patientShortId)} · Room ${escapeHtml(a.room)} · ${visitTimeStr}</h3>
          <p style="color:#64748b;font-size:12px;margin:0 0 8px 0;font-weight:600;">Todo (from summaries)</p>
          ${todosHtml}
          <p style="color:#64748b;font-size:12px;margin:0 0 12px 0;font-weight:600;">Conversation summaries</p>
          ${summariesHtml}
        </div>`;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your visit briefings – Atria</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#334155;">
  <h1 style="color:#1e3a5f;margin-bottom:8px;">Your visit briefings</h1>
  <p style="color:#475569;margin-bottom:24px;">Hi ${escapeHtml(nurseName)}, here are your scheduled visits with previous nurse–patient conversation summaries for each patient.</p>
  ${visitsHtml}
  <p style="color:#94a3b8;font-size:12px;margin-top:24px;">Atria · Briefings sent on demand</p>
</body>
</html>`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return Response.json({ error: 'RESEND_API_KEY is not set' }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const nurseId = (body.nurseId ?? body.nurse_id) as string | undefined;
    if (!nurseId || typeof nurseId !== 'string') {
      return Response.json({ error: 'nurseId required' }, { status: 400 });
    }

    const email = getNurseEmail(nurseId);
    if (!email) {
      return Response.json({ error: 'No email configured for this nurse. Set NURSE_1_EMAIL or NURSE_EMAILS in .env.local.' }, { status: 400 });
    }

    const outputDir = path.join(process.cwd(), 'my_crew', 'output');
    const nursePath = path.join(outputDir, 'nurse_view.json');
    const patientPath = path.join(outputDir, 'patient_view.json');

    if (!fs.existsSync(nursePath) || !fs.existsSync(patientPath)) {
      return Response.json({ error: 'No schedule data found (my_crew/output/nurse_view.json, patient_view.json)' }, { status: 404 });
    }

    const nurseData = JSON.parse(fs.readFileSync(nursePath, 'utf-8'));
    const patientData = JSON.parse(fs.readFileSync(patientPath, 'utf-8'));
    const allAssignments: { id: string; room: string; start: number; stop: number }[] = nurseData.nurse_assignments || [];
    const patients: { id: string; room: string | number }[] = patientData.patients || [];

    const patientsByRoom: Record<string, { shortId: string }> = {};
    patients.forEach((p: { id: string; room: string | number }, i: number) => {
      const room = String(p.room);
      if (room && room !== '-1') {
        patientsByRoom[room] = { shortId: `P${(i + 1).toString().padStart(3, '0')}` };
      }
    });

    const thisNurseAssignments = allAssignments
      .filter((a: { id: string }) => a.id === nurseId)
      .sort((a: { start: number }, b: { start: number }) => a.start - b.start);

    const assignmentsWithSummaries = thisNurseAssignments.map((a: { room: string; start: number; stop: number }) => {
      const patient = patientsByRoom[a.room];
      const patientShortId = patient?.shortId ?? 'N/A';
      const summaries = loadSummariesForPatient(patientShortId);
      return { patientShortId, room: a.room, start: a.start, stop: a.stop, summaries };
    });

    const assignmentsWithTodos = await Promise.all(
      assignmentsWithSummaries.map(async (a) => {
        const todos = await getTodosFromSummaries(a.summaries);
        return { ...a, todos };
      })
    );

    const nurseName = nurseId.replace('_', ' ');
    const html = buildBriefingHtml(nurseName, assignmentsWithTodos);

    const { data, error } = await resend.emails.send({
      from: 'Atria <onboarding@resend.dev>',
      to: [email],
      subject: `Atria: Your visit briefings (${assignmentsWithSummaries.length} visit${assignmentsWithSummaries.length === 1 ? '' : 's'})`,
      html,
    });

    if (error) {
      console.error('[send-nurse-briefing] Resend error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    console.log('[send-nurse-briefing] Sent to', email, 'for', nurseId, 'visits:', assignmentsWithTodos.length);
    return Response.json({ success: true, id: data?.id, visits: assignmentsWithTodos.length });
  } catch (err: unknown) {
    console.error('[send-nurse-briefing] Error:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to send briefings' },
      { status: 500 }
    );
  }
}
