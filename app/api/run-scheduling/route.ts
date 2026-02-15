import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// Force Node.js runtime for child_process
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Starting scheduling pipeline request...');

    // Wait 2 seconds before starting
    await new Promise(resolve => setTimeout(resolve, 2000));

    const crewPath = path.join(process.cwd(), '..', 'my_crew');
    console.log('[API] Crew path:', crewPath);
    console.log('[API] Current working directory:', process.cwd());

    // Check if directory exists
    const fs = await import('fs');
    if (!fs.existsSync(crewPath)) {
      console.error('[API] Crew directory does not exist:', crewPath);
      return Response.json(
        {
          success: false,
          message: 'Crew directory not found',
          error: `Directory ${crewPath} does not exist`,
        },
        { status: 500 }
      );
    }

    return new Promise((resolve) => {
      console.log('[API] Spawning uv process...');

      // Run the Python command: uv run run_from_csv
      const pythonProcess = spawn('uv', ['run', 'run_from_csv'], {
        cwd: crewPath,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
        shell: true, // Use shell to find uv in PATH
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('[Python stdout]:', text);
      });

      pythonProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.error('[Python stderr]:', text);
      });

      pythonProcess.on('close', (code) => {
        console.log('[API] Process closed with code:', code);
        if (code === 0) {
          resolve(
            Response.json({
              success: true,
              message: 'Scheduling pipeline completed successfully',
              output: output,
            })
          );
        } else {
          resolve(
            Response.json(
              {
                success: false,
                message: `Pipeline failed with exit code ${code}`,
                error: errorOutput,
                output: output,
              },
              { status: 500 }
            )
          );
        }
      });

      pythonProcess.on('error', (error) => {
        console.error('[API] Process error:', error);
        resolve(
          Response.json(
            {
              success: false,
              message: 'Failed to start pipeline',
              error: error.message,
              details: 'Make sure "uv" is installed and in your PATH',
            },
            { status: 500 }
          )
        );
      });
    });
  } catch (error: any) {
    console.error('[API] Caught error:', error);
    return Response.json(
      {
        success: false,
        message: 'Failed to execute scheduling pipeline',
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
