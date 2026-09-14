# API Reference

Rafiq exposes 4 HTTP endpoints. All endpoints share the same base URL in both environments:

- **Development:** `http://localhost:3000`
- **Production:** Vercel Functions URL (configured in `vercel.json`)

---

## Authentication

Most endpoints require a valid **HMAC-signed session cookie** issued by `POST /api/auth-login`.

The cookie is set by `services/appAuth.server.ts: createAppSessionCookie()` and validated by `assertAppSession(req)`. It is HMAC-signed with `RAFIQ_APP_SESSION_SECRET`.

**Error response (401):**
```json
{ "success": false, "error": "App password required." }
```

---

## POST /api/auth-login

Authenticates the app password and sets a signed session cookie.

**Auth required:** No

**Request body:**
```json
{ "password": "your-app-password" }
```

**Success response (200):**
```json
{ "success": true }
```
The response also sets `Set-Cookie` with an HMAC-signed session token.

**Error response (401):**
```json
{ "success": false, "error": "Wrong password" }
```

**Error response (405):**
```json
{ "success": false, "error": "Method not allowed" }
```

> Password is verified against `RAFIQ_APP_PASSWORD_HASH` (a 64-character SHA-256 hex digest). `RAFIQ_APP_SESSION_SECRET` must also be configured independently with at least 32 characters. Missing or invalid auth configuration is treated as a configuration error in every environment.

---

## POST /api/gemini

Action dispatcher for all non-streaming Gemini operations. Each call specifies an `action` name and an `args` array.

**Auth required:** Yes (session cookie)

**Request body:**
```json
{
  "action": "<action-name>",
  "args": [<positional arguments>]
}
```

**Success response (200):**
```json
{ "success": true, "result": <action-specific return value> }
```

**Error response (400) — invalid action or args format:**
```json
{ "success": false, "error": "Invalid Gemini action" }
```

**Error response (5xx) — action threw:**
```json
{ "success": false, "error": "<message>", "stage": "<clone-stage or null>" }
```

### Available actions

All actions are registered in `api/gemini.ts: ACTIONS`. Types come from `types.ts`.

| Action | Arguments | Returns |
|--------|-----------|---------|
| `sendMessageToGemini` | `(history, newMessage, attachments, useThinking, settings, userProfile, psychology, groupContext?, externalContext?, replyContext?, allowSearch?, routeHint?, memoryScopeId?, dynamicsInstruction?)` | `GeminiResponse` |
| `generateGroupResponse` | `(settings, history, newMessage, groupMembers, userProfile, psychology)` | `string` |
| `analyzeChatExport` | `(text: string, botName: string)` | `string` |
| `generateInitiativeMessage` | `(settings, userProfile, psychology)` | `string` |
| `generateBioFromTraits` | `(name, gender, age, traits, soulId?)` | `string` |
| `generateImage` | `(prompt, config)` | `{ imageBase64: string }` |
| `generateSelfie` | `(selfieRequest, botSettings, userProfile, psychology)` | `{ imageBase64: string }` |
| `buildAvatarImagePrompt` | `(settings, userProfile, psychology, visionInput?)` | `AvatarImagePromptPlan` |
| `generateStudioImage` | `(studioMessage, botSettings, userProfile?)` | `{ imageBase64: string }` |
| `generateProfileAvatar` | `(name, gender, age?, details?, visualSeed?)` | `{ imageBase64: string }` |
| `generateUserAvatar` | `(userProfile, visionInput?)` | `{ imageBase64: string }` |
| `analyzePersonalitySignals` | `({ botName, currentSummary, messages })` | `AdaptivePersonalityMutation` |
| `runReflectionConsolidation` | `({ chatId, botId, botName, currentState, messages })` | `ReflectionResult` |
| `generateVideo` | `(prompt: string)` | `{ videoUri: string }` |
| `processFileUpload` | `(file, mimeType)` | `ProcessedFile` |
| `startProgressiveCloneAnalysis` | (clone pipeline — `CLONE_ACTIONS`) | `CloneAnalysisProgressSchema` |
| `getProgressiveCloneJobStatus` | (clone pipeline) | `CloneAnalysisProgressSchema` |
| `commitProgressiveClone` | (clone pipeline) | `SoulSynthesisResult` |

> **Rate limits** (enforced in `api/gemini.ts`):  
> - `analyzePersonalitySignals`: max 24 calls per rolling 60-minute window per session  
> - `runReflectionConsolidation`: max 12 calls per rolling 60-minute window per session

---

## POST /api/gemini-stream

Server-Sent Events (SSE) endpoint for streaming chat completions. Wraps `services/geminiService.server.ts: sendMessageToGeminiStream`.

**Auth required:** Yes (session cookie)

**Request body:**
```json
{
  "args": [
    history,         // args[0]  { role: string; parts: { text: string }[] }[]
    newMessage,      // args[1]  string
    attachments,     // args[2]  { mimeType, data, fileName?, fileSize?, category? }[]
    useThinking,     // args[3]  boolean
    settings,        // args[4]  BotSettings
    userProfile,     // args[5]  UserProfile | null
    psychology,      // args[6]  PsychologicalState | undefined
    groupContext,    // args[7]  { isGroup, otherMembers } | undefined
    externalContext, // args[8]  string | undefined
    replyContext,    // args[9]  { senderName, text } | undefined
    allowSearch,     // args[10] boolean | undefined
    routeHint,       // args[11] string | undefined
    memoryScopeId,   // args[12] string | undefined
    dynamicsInstruction // args[13] string | undefined
  ]
}
```

**Response headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**Streaming response format:**

Each chunk is a Server-Sent Event:
```
data: {"text":"chunk text","isThinking":false}\n\n
```

Fields in each chunk:
- `text` — partial response text
- `isThinking` — `true` when the chunk is from Gemini's thinking mode
- `isError` — `true` on error; `text` will contain an Arabic-language error message

Termination event:
```
data: [DONE]\n\n
```

**Error handling:**

If `args` is not an array, returns immediately:
```json
{ "success": false, "error": "Invalid arguments" }
```

If streaming throws, a final error chunk is emitted before the stream closes:
```
data: {"text":"معلش الشبكة وحشة اوي.. بتقول ايه؟","isError":true}\n\n
```

---

## POST /api/capability-test

Backend reachability probe. Tests that Gemini API and (optionally) web search are reachable.

**Auth required:** Yes (session cookie)

**Request body:**
```json
{ "capability": "gemini" }
```

Supported capability values: `"gemini"`, `"web_search"`

**Success response (200):**
```json
{
  "ok": true,
  "kind": "real_provider",
  "reason": "Gemini returned a valid health-check response."
}
```

**Error response (503) — capability not reachable:**
```json
{
  "ok": false,
  "kind": "real_provider",
  "reason": "<error message>"
}
```

**Error response (400) — unsupported capability:**
```json
{ "ok": false, "error": "Unsupported capability probe." }
```

**Error response (405) — wrong method:**
```json
{ "ok": false, "error": "Method not allowed." }
```

> The `"gemini"` probe sends a minimal 8-token health-check request to `gemini-3.5-flash` (or the model in `RAFIQ_HEALTHCHECK_MODEL` if set). It uses `GEMINI_SAFETY_OFF_SETTINGS` to avoid safety-related failures on the probe prompt.

---

## Error response conventions

All non-streaming endpoints return JSON with the shape:

```typescript
// success
{ success: true, result: unknown }
// or: { ok: true, kind: string, reason: string }

// failure
{ success: false, error: string, stage?: string }
// or: { ok: false, error: string, reason?: string }
```

HTTP status codes follow REST conventions: 200 for success, 400 for bad input, 401 for missing auth, 405 for wrong method, 5xx for server errors.
