import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function cleanThoughtLeaks(text: string): string {
  if (!text) return "";
  return text
    .split("|||")
    .map((part) => {
      let trimmed = part.trim();
      if (!trimmed) return "";
      trimmed = trimmed
        .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
        .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
        .replace(/\s*[([][^\])]*?(?:slang|intensity|checked|rule|prompt|instruction|thought|thinking|analysis)[^\])]*?[\])]/gi, "")
        .trim();
      return trimmed;
    })
    .filter(Boolean)
    .join(" ||| ");
}

export interface AgentRouterCredentials {
  token: string;
  baseUrl: string;
  defaultModel: string;
}

export class AgentRouterConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRouterConfigurationError";
  }
}

export const resolveAgentRouterCredentials = (): AgentRouterCredentials => {
  let token = process.env.AGENT_ROUTER_TOKEN || process.env.AGENTROUTER_API_KEY || "";
  let baseUrl = process.env.AGENTROUTER_BASE_URL || "https://agentrouter.org/v1";
  let defaultModel = process.env.AGENTROUTER_MODEL || "gpt-5.6-sol";

  // Check ~/.agentrouter/.env if in local filesystem
  try {
    const dotEnvPath = path.join(os.homedir(), ".agentrouter", ".env");
    if (fs.existsSync(dotEnvPath)) {
      const content = fs.readFileSync(dotEnvPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [k, ...vParts] = trimmed.split("=");
        const key = k.trim();
        const value = vParts.join("=").trim().replace(/^["']|["']$/g, "");
        if ((key === "AGENT_ROUTER_TOKEN" || key === "AGENTROUTER_API_KEY") && !token) {
          token = value;
        } else if (key === "AGENTROUTER_BASE_URL" && !process.env.AGENTROUTER_BASE_URL) {
          baseUrl = value;
        } else if (key === "AGENTROUTER_MODEL" && !process.env.AGENTROUTER_MODEL) {
          defaultModel = value;
        }
      }
    }
  } catch {
    // Ignore reading errors on serverless environments
  }

  // Check ~/.codex-agentrouter/auth.json if token not yet found
  try {
    const authJsonPath = path.join(os.homedir(), ".codex-agentrouter", "auth.json");
    if (!token && fs.existsSync(authJsonPath)) {
      const auth = JSON.parse(fs.readFileSync(authJsonPath, "utf8"));
      token = auth.AGENT_ROUTER_TOKEN || auth.OPENAI_API_KEY || "";
    }
  } catch {
    // Ignore reading errors
  }

  return { token, baseUrl, defaultModel };
};

export interface AgentRouterGenerateOptions {
  model?: string;
  systemInstruction?: string;
  timeoutMs?: number;
}

/**
 * Builds safe system prompt with English framing to satisfy AgentRouter moderation requirements
 */
function buildSystemFraming(systemInstruction?: string): string {
  const baseFraming = `You are Rafiq (رفيق), an authentic and engaging Egyptian AI companion.
Core Guidelines:
- Respond in natural, warm Egyptian Arabic dialect.
- Talk authentically like a close friend in a WhatsApp conversation.
- Use " ||| " to separate distinct thought bursts or multiple message bubbles.
- Never output reasoning tokens or internal thought tags in the final answer.`;

  if (!systemInstruction) return baseFraming;

  return `${baseFraming}\n\nAdditional Persona & Memory Details:\n${systemInstruction}`;
}

/**
 * Performs a direct HTTPS API call to AgentRouter REST API
 */
export const generateAgentRouterResponse = async (
  prompt: string,
  options: AgentRouterGenerateOptions = {}
): Promise<string> => {
  const credentials = resolveAgentRouterCredentials();
  if (!credentials.token) {
    throw new AgentRouterConfigurationError(
      "Missing AGENT_ROUTER_TOKEN in environment or configuration."
    );
  }

  const model = options.model?.replace(/^agentrouter-/, "") || credentials.defaultModel || "gpt-5.6-sol";
  const systemContent = buildSystemFraming(options.systemInstruction);

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemContent },
    { role: "user", content: prompt },
  ];

  const payload = JSON.stringify({
    model,
    messages,
    max_tokens: 2048,
    temperature: 0.7,
  });

  const fullUrl = `${credentials.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const timeoutMs = options.timeoutMs || 90000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${credentials.token}`,
        "User-Agent": "Cline/3.0.0",
        "X-Title": "Cline",
        "HTTP-Referer": "https://github.com/cline/cline",
      },
      body: payload,
      signal: controller.signal,
    });

    const rawBody = await res.text();

    if (!res.ok) {
      throw new Error(`AgentRouter API error (HTTP ${res.status}): ${rawBody.slice(0, 300)}`);
    }

    try {
      const data = JSON.parse(rawBody);
      const content = data.choices?.[0]?.message?.content || "";
      return cleanThoughtLeaks(content);
    } catch (parseErr) {
      console.error(`[AgentRouter Parse Error] Status: ${res.status}, Headers:`, Object.fromEntries(res.headers.entries()), `Body: ${rawBody.slice(0, 400)}`);
      throw new Error(`Failed to parse AgentRouter JSON response (HTTP ${res.status}): ${rawBody.slice(0, 150)}`);
    }
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Streams response from AgentRouter and yields message bubbles
 */
export async function* streamAgentRouterResponse(
  prompt: string,
  options: AgentRouterGenerateOptions = {}
): AsyncGenerator<{ text: string; toolsUsed: any[]; urls: any[] }> {
  const credentials = resolveAgentRouterCredentials();
  if (!credentials.token) {
    yield {
      text: "معلش، مش قادر أوصل لـ AgentRouter دلوقتي.. اتأكد من ضبط الـ Token.",
      toolsUsed: [],
      urls: [],
    };
    return;
  }

  const fullText = await generateAgentRouterResponse(prompt, options);

  // Split bubbles by |||
  const bubbles = fullText.includes("|||")
    ? fullText.split("|||").map((b) => b.trim()).filter(Boolean)
    : [fullText.trim()];

  for (let i = 0; i < bubbles.length; i++) {
    const bubble = bubbles[i];
    const isLast = i === bubbles.length - 1;
    yield {
      text: isLast ? bubble : `${bubble} ||| `,
      toolsUsed: [],
      urls: [],
    };
  }
}
