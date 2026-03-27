import { spawn } from "child_process";

interface ClaudeCliResult {
  result: string;
  structured_output?: {
    message: string;
    actions: Array<{ tool: string; params: Record<string, unknown> }>;
  };
  session_id: string;
  total_cost_usd?: number;
}

export async function spawnClaude(
  systemPrompt: string,
  userMessage: string,
  schemaJson: string,
  sessionId?: string
): Promise<ClaudeCliResult> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--output-format",
      "json",
      "--max-turns",
      "1",
    ];

    if (sessionId) {
      args.push("--resume", sessionId);
    }

    const proc = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
      reject(new Error("Claude CLI timed out after 120 seconds"));
    }, 120000);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
    });

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code !== 0 && code !== null) {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as ClaudeCliResult;
        resolve(parsed);
      } catch {
        reject(
          new Error(
            `Failed to parse Claude CLI output: ${stdout.slice(0, 500)}`
          )
        );
      }
    });

    // Build the full prompt with system context and structured output instruction
    const fullMessage = `${systemPrompt}\n\n---\n\nUser request: ${userMessage}\n\nIMPORTANT: You MUST respond with valid JSON matching this exact schema:\n${schemaJson}\n\nRespond with a JSON object containing "message" (your text response) and "actions" (array of editor actions to take). If no actions are needed, use an empty array.`;

    proc.stdin.write(fullMessage);
    proc.stdin.end();
  });
}
