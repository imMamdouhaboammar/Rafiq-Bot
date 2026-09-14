import { GoogleGenAI } from "@google/genai";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export class GoogleAiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAiConfigurationError";
  }
}

export type GoogleAiConfiguration =
  | { mode: 'api_key'; apiKey: string }
  | { mode: 'vertex'; project: string; location: string };

const decodeServiceAccountJson = (env: NodeJS.ProcessEnv): string | undefined => {
  const direct = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (direct) return direct;

  const encoded = env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim();
  if (!encoded) return undefined;

  try {
    return Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    throw new GoogleAiConfigurationError('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 is not valid base64.');
  }
};

const readServiceAccountProject = (serviceAccountJson: string): string | undefined => {
  try {
    const parsed = JSON.parse(serviceAccountJson) as { project_id?: unknown };
    return typeof parsed.project_id === 'string' && parsed.project_id.trim()
      ? parsed.project_id.trim()
      : undefined;
  } catch {
    throw new GoogleAiConfigurationError('Google service account JSON is malformed.');
  }
};

export const resolveGoogleAiConfiguration = (
  env: NodeJS.ProcessEnv = process.env,
): GoogleAiConfiguration => {
  const serviceAccountJson = decodeServiceAccountJson(env);
  const project = env.GOOGLE_CLOUD_PROJECT?.trim()
    || (serviceAccountJson ? readServiceAccountProject(serviceAccountJson) : undefined);
  const hasApplicationCredentials = Boolean(env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
  const hasInlineCredentials = Boolean(serviceAccountJson);

  // If explicit Vertex AI credentials (project and service account / application credentials) are configured,
  // use Vertex AI to consume Google Cloud project resources and promotional credits.
  if ((hasApplicationCredentials || hasInlineCredentials) && project) {
    return {
      mode: 'vertex',
      project,
      location: env.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
    };
  }

  if (hasApplicationCredentials && !project) {
    throw new GoogleAiConfigurationError(
      'GOOGLE_CLOUD_PROJECT is required for Vertex AI when the service account does not declare project_id.',
    );
  }

  const apiKey = env.GEMINI_API_KEY?.trim();
  if (apiKey) return { mode: 'api_key', apiKey };

  if (project) {
    return {
      mode: 'vertex',
      project,
      location: env.GOOGLE_CLOUD_LOCATION?.trim() || 'global',
    };
  }

  throw new GoogleAiConfigurationError(
    'Configure GEMINI_API_KEY or explicit Vertex AI credentials.',
  );
};

const configureServiceAccountCredentials = (env: NodeJS.ProcessEnv): void => {
  if (env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) return;

  const serviceAccountJson = decodeServiceAccountJson(env);
  if (serviceAccountJson) {
    readServiceAccountProject(serviceAccountJson);
    const credentialsPath = path.join(os.tmpdir(), 'rafiq-google-service-account.json');
    fs.writeFileSync(credentialsPath, serviceAccountJson, { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    return;
  }
};

const getGoogleAuthClient = (env: NodeJS.ProcessEnv): any => {
  const serviceAccountJson = decodeServiceAccountJson(env);
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      const auth = new GoogleAuth({
        credentials: parsed,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
      return auth.getClient();
    } catch {
      // Fallback
    }
  }

  try {
    const token = execSync("gcloud auth print-access-token 2>/dev/null").toString().trim();
    if (!token) return undefined;
    const client = new OAuth2Client();
    client.setCredentials({ access_token: token });
    return client;
  } catch {
    return undefined;
  }
};

export const createGoogleGenAIClient = () => {
  const configuration = resolveGoogleAiConfiguration(process.env);

  if (configuration.mode === 'api_key') {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_LOCATION;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return new GoogleGenAI({ apiKey: configuration.apiKey, vertexai: false });
  }

  configureServiceAccountCredentials(process.env);
  const authClient = getGoogleAuthClient(process.env);

  return new GoogleGenAI({
    vertexai: true,
    project: configuration.project,
    location: configuration.location,
    googleAuthOptions: authClient ? { authClient } : undefined,
  } as any);
};
