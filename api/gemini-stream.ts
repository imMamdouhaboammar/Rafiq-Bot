import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertAppSession } from "../services/appAuth.server.js";
import { sendMessageToGeminiStream } from "../services/geminiService.server.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    assertAppSession(req);
    const { args } = req.body ?? {};
    if (!Array.isArray(args)) {
      return res.status(400).json({ success: false, error: "Invalid arguments" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const streamGenerator = sendMessageToGeminiStream(
      args[0],  // history
      args[1],  // newMessage
      args[2],  // attachments
      args[3],  // useThinking
      args[4],  // settings
      args[5],  // userProfile
      args[6],  // psychology
      args[7],  // groupContext
      args[8],  // externalContext
      args[9],  // replyContext
      args[10], // allowSearch
      args[11], // routeHint
      args[12], // memoryScopeId
      args[13]  // dynamicsInstruction
    );

    for await (const chunk of streamGenerator) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Streaming API Error]", message);
    // If headers already sent, stream the error
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ text: "معلش الشبكة وحشة اوي.. بتقول ايه؟", isError: true })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
}
