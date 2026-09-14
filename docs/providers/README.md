# Inference providers

Rafiq currently has three distinct provider surfaces. They are not equivalent and should not be described as interchangeable until the main chat runtime is normalized behind a provider interface.

## Current matrix

| Path | Runtime status | Authentication | Main chat integration |
| --- | --- | --- | --- |
| Google Gemini API | primary | `GEMINI_API_KEY` | yes |
| Google Vertex AI | primary alternative | Google Cloud project plus application or service-account credentials | yes |
| AgentRouter | optional gateway | `AGENT_ROUTER_TOKEN` or `AGENTROUTER_API_KEY` | yes for model IDs recognized by the current router |
| KoboldCpp | tested local adapter | local endpoint | adapter exists, but it is not yet the main-chat provider selector |

The implementation evidence is `services/googleClient.server.ts`, `services/agentRouter.server.ts`, and `services/koboldInferenceProvider.ts`. Model routing for the integrated paths is in `services/geminiModels.ts` and `services/modelRouter.ts`.

## Google Gemini and Vertex AI

`services/googleClient.server.ts` selects API-key mode when `GEMINI_API_KEY` is configured, or Vertex AI when Google Cloud project credentials are present. Credentials remain server-side. `services/geminiService.server.ts` owns the current production chat, media, analysis, and embedding call paths.

## AgentRouter

`services/agentRouter.server.ts` is an optional HTTP gateway. The current model registry contains hidden AgentRouter model identifiers, but that does not mean Rafiq implements direct provider authentication for the companies behind those model names. AgentRouter credentials and billing are separate from direct OpenAI, Anthropic, or other provider accounts.

## KoboldCpp

`services/koboldInferenceProvider.ts` probes an OpenAI-compatible local endpoint and can generate a non-streaming chat completion. Its tests prove the adapter contract. It is not currently wired into the primary UI model selector or the full Rafiq memory/tool pipeline.

## Not currently implemented

Rafiq does not currently ship direct ChatGPT/OpenAI, Claude/Anthropic, OpenRouter, xAI/Grok, or Gemini consumer-subscription OAuth as a general provider connection flow. Do not reuse OAuth client IDs copied from another project. Provider policy and an officially permitted client flow must be verified before adding subscription authentication.

For new integrations, follow [Adding a provider](adding-a-provider.md) and update this matrix from executable evidence rather than provider marketing claims.
