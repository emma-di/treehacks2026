import { NextRequest } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CLINICAL_EXTRACT_SYSTEM = `You are a clinical documentation assistant. Given a transcription of a conversation between a nurse and a patient, extract only the information that is clinically relevant for the next nurse who will check on the patient. Output a concise summary (2–5 sentences) that includes:
- Chief complaint or reason for visit
- Key symptoms or concerns mentioned by the patient
- Relevant findings or plans (e.g., vitals, medications, follow-up)
- Any specific instructions or precautions the next nurse should know

Write in plain language suitable for a nurse briefing. Do not include small talk or non-clinical content. If the transcription is empty or unintelligible, respond with "No clinically relevant information extracted."`;

type SummaryEntry = { summary: string; transcription?: string; updatedAt: string; providerId?: string | null };

function getDataPath(): string {
  return path.join(process.cwd(), 'data', 'patient_visit_summaries.json');
}

function toEntryArray(raw: unknown): SummaryEntry[] {
  if (Array.isArray(raw)) return raw as SummaryEntry[];
  if (raw && typeof raw === 'object' && 'summary' in raw) {
    const o = raw as Record<string, unknown>;
    return [{ summary: String(o.summary ?? ''), transcription: o.transcription as string | undefined, updatedAt: String(o.updatedAt ?? ''), providerId: (o.providerId as string | null) ?? null }];
  }
  return [];
}

async function loadSummaries(): Promise<Record<string, SummaryEntry[]>> {
  const dataPath = getDataPath();
  try {
    const raw = await fs.readFile(dataPath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, SummaryEntry[]> = {};
    for (const [patientId, value] of Object.entries(parsed)) {
      out[patientId] = toEntryArray(value);
      out[patientId].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return out;
  } catch {
    return {};
  }
}

async function saveSummaries(data: Record<string, SummaryEntry[]>): Promise<void> {
  const dataPath = getDataPath();
  const dir = path.dirname(dataPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(request: NextRequest) {
  try {
    const patientId = request.nextUrl.searchParams.get('patientId');
    if (!patientId) {
      return Response.json({ error: 'patientId required' }, { status: 400 });
    }
    const all = await loadSummaries();
    const list = all[patientId] ?? [];
    return Response.json({ summaries: list });
  } catch (error: unknown) {
    console.error('[voice-summary GET]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to load summary' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const patientId = formData.get('patientId');
    const audio = formData.get('audio');
    const providerId = formData.get('providerId');

    if (!patientId || typeof patientId !== 'string') {
      return Response.json({ error: 'patientId required' }, { status: 400 });
    }
    if (!audio || !(audio instanceof Blob)) {
      return Response.json({ error: 'audio file required' }, { status: 400 });
    }
    const providerIdStr = providerId && typeof providerId === 'string' ? providerId : null;

    const buffer = Buffer.from(await audio.arrayBuffer());
    const ext = audio.type === 'audio/webm' ? '.webm' : audio.type?.includes('m4a') ? '.m4a' : '.webm';
    const file = await toFile(buffer, `audio${ext}`);

    const transcriptionResponse = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });
    const transcription = (transcriptionResponse as { text?: string }).text?.trim() ?? '';

    let summary = 'No clinically relevant information extracted.';
    if (transcription) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: CLINICAL_EXTRACT_SYSTEM },
          { role: 'user', content: transcription },
        ],
        max_tokens: 400,
      });
      summary = (completion.choices[0]?.message?.content ?? '').trim() || summary;
    }

    const updatedAt = new Date().toISOString();
    const entry: SummaryEntry = { summary, transcription, updatedAt, providerId: providerIdStr };
    const all = await loadSummaries();
    const list = (all[patientId] ?? []).concat(entry).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    all[patientId] = list;
    await saveSummaries(all);

    return Response.json({ transcription, summary, updatedAt, providerId: providerIdStr, summaries: list });
  } catch (error: unknown) {
    console.error('[voice-summary POST]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to process recording' },
      { status: 500 }
    );
  }
}
