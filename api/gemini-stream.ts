import type { ApiRequest, ApiResponse } from "./httpTypes.js";
import { assertAppSession } from "../services/appAuth.server.js";
import { sendMessageToGeminiStream } from "../services/geminiService.server.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
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

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    // Send initial keep-alive comment immediately to establish connection stream
    res.write(": keep-alive\n\n");
    if (typeof (res as any).flush === "function") {
      (res as any).flush();
    }

    const keepAliveInterval = setInterval(() => {
      if (!(res as any).writableEnded) {
        res.write(": keep-alive\n\n");
        if (typeof (res as any).flush === "function") {
          (res as any).flush();
        }
      }
    }, 12000);

    try {
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
    } finally {
      clearInterval(keepAliveInterval);
    }
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Streaming API Error]", message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ text: "Network connection interrupted. Please try again.", isError: true })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ success: false, error: message });
    }
  }
}
