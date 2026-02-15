import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { messages, agentLog } = await request.json();

    // Build context from agent log
    const logContext = agentLog && agentLog.length > 0
      ? `\n\nCurrent Agent Activity Log:\n${agentLog.map((event: any) =>
        `[${event.type}] ${event.data.message || JSON.stringify(event.data)}`
      ).join('\n')}`
      : '';

    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant helping monitor and explain a hospital multi-agent scheduling system. 
The system schedules patients to rooms and assigns nurses to check on patients.

You have access to the real-time event log from the scheduling pipeline. Use this context to answer questions about:
- Which patients are being processed
- Model predictions and results
- Room assignments
- Nurse schedules
- Any errors or warnings

Be concise and helpful. Reference specific events from the log when relevant.${logContext}`,
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [systemMessage, ...messages],
    });

    return Response.json({
      message: completion.choices[0].message,
    });
  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return Response.json(
      {
        error: error.message || 'Failed to get response',
        details: error.response?.data || null,
      },
      { status: 500 }
    );
  }
}
