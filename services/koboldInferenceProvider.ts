import { z } from "zod";

export const KoboldEndpointConfigSchema = z.object({
  endpointUrl: z.string().url().default("http://localhost:5001/v1"),
  modelName: z.string().default("local-model"),
  temperature: z.number().min(0).max(2).default(0.8),
  maxTokens: z.number().int().min(50).max(8192).default(1200),
  grammar: z.string().optional(),
  timeoutMs: z.number().int().default(15000),
});

export type KoboldEndpointConfig = z.infer<typeof KoboldEndpointConfigSchema>;

export interface KoboldProbeResult {
  online: boolean;
  modelName?: string;
  latencyMs?: number;
  error?: string;
}

export interface KoboldChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Probes the local KoboldCpp server to verify if it is running and responding.
 */
export async function probeKoboldEndpoint(
  endpointUrl = "http://localhost:5001/v1"
): Promise<KoboldProbeResult> {
  const startTime = Date.now();
  const normalizedUrl = endpointUrl.replace(/\/+$/, "");
  const targetUrl = `${normalizedUrl}/models`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        online: false,
        error: `HTTP status ${res.status}: ${res.statusText}`,
      };
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const firstModel = data?.data?.[0]?.id || "KoboldCpp Local Model";

    return {
      online: true,
      modelName: firstModel,
      latencyMs: Date.now() - startTime,
    };
  } catch (err: any) {
    return {
      online: false,
      error: err?.message || "Failed to reach KoboldCpp endpoint",
    };
  }
}

/**
 * Generates a response from KoboldCpp via its standard OpenAI-compatible /v1/chat/completions endpoint.
 */
export async function generateKoboldChatCompletion(
  messages: KoboldChatMessage[],
  config: Partial<KoboldEndpointConfig> = {}
): Promise<{ text: string; model: string }> {
  const fullConfig = KoboldEndpointConfigSchema.parse(config);
  const normalizedUrl = fullConfig.endpointUrl.replace(/\/+$/, "");
  const targetUrl = `${normalizedUrl}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), fullConfig.timeoutMs);

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: fullConfig.modelName,
        messages,
        temperature: fullConfig.temperature,
        max_tokens: fullConfig.maxTokens,
        stream: false,
      }),
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`KoboldCpp error [${res.status}]: ${errorText}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };

    const text = data?.choices?.[0]?.message?.content || "";
    return {
      text: text.trim(),
      model: data?.model || fullConfig.modelName,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(`KoboldInferenceProvider failed: ${err?.message}`);
  }
}

/**
 * Builds standard GBNF grammar string for constraining outputs to structured Egyptian psychological state JSON.
 */
export function buildPsychologicalStateGBNF(): string {
  return `
root ::= "{" ws "\\"mood\\":" ws mood ws "," ws "\\"intimacyDelta\\":" ws int ws "," ws "\\"reason\\":" ws string ws "}"
mood ::= "\\"happy\\"" | "\\"sad\\"" | "\\"angry\\"" | "\\"playful\\"" | "\\"neutral\\"" | "\\"romantic\\"" | "\\"anxious\\"" | "\\"excited\\""
int ::= ("-"? [0-9]+)
string ::= "\\"" [^"\\\\]* "\\""
ws ::= [ \\t\\n\\r]*
`.trim();
}
