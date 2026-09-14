import express from "express";
import "./services/env.server.ts";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { createAppSessionCookie, hasValidAppSession, verifyAppPassword } from "./services/appAuth.server.ts";
import * as GeminiServerService from "./services/geminiService.server.ts";
import * as ReflectionEngine from "./services/reflectionEngine.server.ts";
import { processFileUpload } from "./services/fileProcessor.server.ts";
import { CLONE_ACTIONS, getCloneActionStage } from "./services/cloneActionRegistry.server.ts";


async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Set credentials for local Vertex AI testing if file exists and GOOGLE_APPLICATION_CREDENTIALS is not already set
  const localServiceAccountPath = path.join(process.cwd(), 'service-account.json');
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(localServiceAccountPath)) {
    try {
      const stats = fs.statSync(localServiceAccountPath);
      if (stats.size > 0) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = localServiceAccountPath;
      }
    } catch (err) {
      console.warn("[Server] Failed to check service-account.json stats:", err);
    }
  }

  // Middleware for large payloads (base64 images)
  app.use(express.json({ limit: "50mb" }));

  app.post("/api/auth-login", (req, res) => {
    if (!verifyAppPassword(req.body?.password)) {
      return res.status(401).json({ success: false, error: "Wrong password" });
    }
    res.setHeader("Set-Cookie", createAppSessionCookie());
    res.json({ success: true });
  });

  const requireAppSession = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (hasValidAppSession(req.headers.cookie)) return next();
    res.status(401).json({ success: false, error: "App password required." });
  };

  // API Routes for Gemini
  app.post("/api/gemini", requireAppSession, async (req, res) => {
    try {
      const { action, args } = req.body;
      const actions: Record<string, (...params: any[]) => any> = {
        ...GeminiServerService,
        runReflectionConsolidation: ReflectionEngine.runReflectionConsolidation,
        processFileUpload,
        ...CLONE_ACTIONS,
      };
      if (typeof action !== "string" || !(action in actions) || !Array.isArray(args)) {
        return res.status(400).json({ success: false, error: "Invalid Gemini action" });
      }
      const result = await actions[action](...args);
      res.json({ success: true, result });
    } catch (e: any) {
      const cloneStage = getCloneActionStage(e);
      if (cloneStage) {
        console.error("[Clone RPC Error]", { stage: cloneStage, errorName: e?.name || "Error" });
      } else {
        console.error("[RPC Error]", e);
      }
      const statusCode = Number(e?.statusCode) || 500;
      res.status(statusCode).json({
        success: false,
        error: e.message || String(e),
        stage: cloneStage,
      });
    }
  });

  app.post("/api/gemini-stream", requireAppSession, async (req, res) => {
    try {
      const { args } = req.body;
      if (!Array.isArray(args)) {
        return res.status(400).json({ success: false, error: "Invalid arguments" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      
      const streamGenerator = GeminiServerService.sendMessageToGeminiStream(
        args[0], // history
        args[1], // newMessage
        args[2], // attachments
        args[3], // useThinking
        args[4], // settings
        args[5], // userProfile
        args[6], // psychology
        args[7], // groupContext
        args[8], // externalContext
        args[9], // replyContext
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
    } catch (e: any) {
      console.error("[Streaming RPC Error]", e);
      res.write(`data: ${JSON.stringify({ text: "معلش الشبكة وحشة اوي.. بتقول ايه؟", isError: true })}\n\n`);
      res.end();
    }
  });



  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    app.use((_req, res, next) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      next();
    });
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();