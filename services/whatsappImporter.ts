import { BotSettings } from "../types.js";

export const analyzeChatAndGeneratePersona = async (fileContent: string, targetNameHint?: string): Promise<BotSettings> => {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'analyzeChatAndGeneratePersona', args: [fileContent, targetNameHint] })
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data.result;
};
