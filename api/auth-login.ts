import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createAppSessionCookie, verifyAppPassword } from "../services/appAuth.server.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { password } = req.body ?? {};
  if (!verifyAppPassword(password)) {
    return res.status(401).json({ success: false, error: "Wrong password" });
  }

  res.setHeader("Set-Cookie", createAppSessionCookie());
  return res.status(200).json({ success: true });
}
