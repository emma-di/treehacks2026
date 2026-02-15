import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';

// Force Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Starting async scheduling pipeline...');

    // Wait 2 seconds before starting
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the correct path
    const crewPath = path.join(process.cwd(), 'my_crew');
    console.log('[API] Crew path:', crewPath);
    console.log('[API] Process cwd:', process.cwd());

    // Set the API endpoint for event streaming
    const apiEndpoint = 'http://localhost:3000/api/agent-events';
    console.log('[API] Setting NEXT_API_ENDPOINT to:', apiEndpoint);

    // Run async - don't wait for completion (Windows has no /tmp)
    const logPath = path.join(os.tmpdir(), 'scheduling-output.log');
    const command = `cd "${crewPath}" && NEXT_API_ENDPOINT="${apiEndpoint}" uv run run_from_csv > "${logPath}" 2>&1 &`;

    console.log('[API] Executing command:', command);

    exec(command, {
      env: {
        ...process.env,
        NEXT_API_ENDPOINT: apiEndpoint,
      }
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('[API] Failed to start:', error);
      } else {
        console.log('[API] Pipeline started in background');
        if (stdout) console.log('[API] stdout:', stdout);
        if (stderr) console.log('[API] stderr:', stderr);
      }
    });

    // Send a test event to verify the connection
    try {
      await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pipeline_start',
          timestamp: Date.now() / 1000,
          data: {
            message: 'Scheduling pipeline initiated from UI',
            command: 'uv run run_from_csv',
          }
        }),
      });
      console.log('[API] Test event sent successfully');
    } catch (err) {
      console.error('[API] Failed to send test event:', err);
    }

    // Return immediately
    return Response.json({
      success: true,
      message: 'Scheduling pipeline started in background. Check Agent tab for progress.',
      note: `Pipeline is running asynchronously. Output logged to ${logPath}`,
    });

  } catch (error: any) {
    console.error('[API] Error:', error);
    return Response.json(
      {
        success: false,
        message: 'Failed to start pipeline',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
