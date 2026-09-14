import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertAppSession } from '../services/appAuth.server.js';
import { createGoogleGenAIClient } from '../services/googleClient.server.js';
import { GEMINI_SAFETY_OFF_SETTINGS } from '../services/geminiSafety.server.js';
import { executeWebSearch } from '../services/tools/webSearchTool.server.js';

const SUPPORTED_CAPABILITIES = new Set(['gemini', 'web_search']);

const getRequestCapability = (request: VercelRequest): string => {
  const capability = request.body?.capability;
  return typeof capability === 'string' ? capability.trim() : '';
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  try {
    assertAppSession(request);
  } catch (error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 401;
    return response.status(statusCode).json({ ok: false, error: 'Authentication required.' });
  }

  const capability = getRequestCapability(request);
  if (!SUPPORTED_CAPABILITIES.has(capability)) {
    return response.status(400).json({
      ok: false,
      error: 'Unsupported capability probe.',
    });
  }

  try {
    if (capability === 'gemini') {
      const client = createGoogleGenAIClient();
      const result = await client.models.generateContent({
        model: process.env.RAFIQ_HEALTHCHECK_MODEL || 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }],
        config: {
          temperature: 0,
          maxOutputTokens: 8,
          safetySettings: GEMINI_SAFETY_OFF_SETTINGS,
        },
      });
      const text = result.text?.trim();
      if (!text) throw new Error('Gemini returned an empty health-check response.');
      return response.status(200).json({
        ok: true,
        kind: 'real_provider',
        reason: 'Gemini returned a valid health-check response.',
      });
    }

    const result = await executeWebSearch({
      query: 'OpenAI official website',
      maxResults: 1,
      locale: 'en-US',
      region: 'us',
    });
    if (result.provider === 'unavailable') {
      return response.status(503).json({
        ok: false,
        kind: 'real_provider',
        reason: 'Web search provider is not configured.',
      });
    }
    if (result.results.length === 0) {
      throw new Error(`Web search provider ${result.provider} returned no results.`);
    }
    return response.status(200).json({
      ok: true,
      kind: 'real_provider',
      reason: `Web search provider ${result.provider} returned a live result.`,
    });
  } catch (error) {
    return response.status(503).json({
      ok: false,
      kind: 'real_provider',
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
