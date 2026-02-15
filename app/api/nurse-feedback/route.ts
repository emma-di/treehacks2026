/**
 * Nurse feedback: store workload/acuity feedback and expose load adjustments for the scheduler.
 * Before the next run, roster load is increased for nurses who reported "overwhelmed" or missed visits.
 */
import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEEDBACK_FILE = 'nurse_feedback.json';
const LOOKBACK_DAYS = 7;
const OVERWHELMED_LOAD_DELTA = 1;
const MISSED_VISITS_LOAD_DELTA = 1;

function getDataPath(): string {
  return path.join(process.cwd(), 'data', FEEDBACK_FILE);
}

export type FeedbackEntry = {
  nurseId: string;
  shiftDate: string; // ISO date YYYY-MM-DD
  overwhelmed?: boolean;
  missedVisits?: number;
  acuityAdjustment?: string;
  comments?: string;
  submittedAt: string; // ISO datetime
};

async function loadFeedback(): Promise<FeedbackEntry[]> {
  const p = getDataPath();
  try {
    const raw = await fs.readFile(p, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : data.entries ?? [];
  } catch {
    return [];
  }
}

async function saveFeedback(entries: FeedbackEntry[]): Promise<void> {
  const p = getDataPath();
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(p, JSON.stringify(entries, null, 2), 'utf-8');
}

/** Compute per-nurse load adjustment from recent feedback (for scheduler). */
export async function getLoadAdjustments(): Promise<Record<string, number>> {
  const entries = await loadFeedback();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const out: Record<string, number> = {};
  for (const e of entries) {
    if (e.shiftDate < cutoffStr) continue;
    const delta =
      (e.overwhelmed ? OVERWHELMED_LOAD_DELTA : 0) +
      (typeof e.missedVisits === 'number' ? Math.min(e.missedVisits, 3) * MISSED_VISITS_LOAD_DELTA : 0);
    if (delta > 0) out[e.nurseId] = (out[e.nurseId] ?? 0) + delta;
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const nurseId = url.searchParams.get('nurseId');
    if (url.searchParams.get('loadAdjustments') !== null) {
      const adjustments = await getLoadAdjustments();
      return Response.json(adjustments);
    }
    const entries = await loadFeedback();
    if (nurseId) {
      const filtered = entries.filter((e) => e.nurseId === nurseId);
      return Response.json({ entries: filtered });
    }
    return Response.json({ entries });
  } catch (err: unknown) {
    console.error('[nurse-feedback GET]', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to load feedback' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const nurseId = body.nurseId as string | undefined;
    if (!nurseId || typeof nurseId !== 'string') {
      return Response.json({ error: 'nurseId required' }, { status: 400 });
    }
    const shiftDate =
      (body.shiftDate as string) || new Date().toISOString().slice(0, 10);
    const overwhelmed = Boolean(body.overwhelmed);
    const missedVisits =
      typeof body.missedVisits === 'number'
        ? Math.max(0, body.missedVisits)
        : typeof body.missedVisits === 'string'
          ? parseInt(body.missedVisits, 10) || 0
          : undefined;
    const acuityAdjustment =
      typeof body.acuityAdjustment === 'string' ? body.acuityAdjustment : undefined;
    const comments =
      typeof body.comments === 'string' ? body.comments : undefined;

    const entry: FeedbackEntry = {
      nurseId,
      shiftDate,
      overwhelmed,
      missedVisits,
      acuityAdjustment,
      comments,
      submittedAt: new Date().toISOString(),
    };
    const entries = await loadFeedback();
    entries.push(entry);
    await saveFeedback(entries);
    return Response.json({ success: true, entry });
  } catch (err: unknown) {
    console.error('[nurse-feedback POST]', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to save feedback' },
      { status: 500 }
    );
  }
}
