import fs from "fs";
import path from "path";

const parseEnvLine = (line: string): [string, string] | null => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return key ? [key, value] : null;
};

export const loadLocalEnv = () => {
  const loadFile = (filename: string) => {
    const envPath = path.join(process.cwd(), filename);
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      // Local configuration files take precedence over pre-existing system environment variables during development
      process.env[key] = value;
    }
  };

  // Load .env first, then .env.local (which has higher priority)
  loadFile(".env");
  loadFile(".env.local");
};

loadLocalEnv();
