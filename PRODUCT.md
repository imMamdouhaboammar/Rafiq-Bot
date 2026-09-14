# PRODUCT.md

## Product Summary
Rafiq is an authentic, warm, and witty AI companion designed specifically for Egyptian users, conversing primarily in Egyptian Arabic vernacular. It provides users with a human-like companion experience, integrating a dynamic psychological state engine, long-term memory systems, and media generation capacities directly inside a chat interface modeled after WhatsApp.

## Target Users & Roles
- **End User**: Main chat participant seeking human-like companionship, custom bot creation, and personal media generation.
- **Companion Bot**: The AI personas acting as empathetic Egyptian friends with distinct traits (chaos, empathy, slang, intellect, positivity).

## Jobs To Be Done
- When I open Rafiq, I want to talk to an authentic Egyptian companion who remembers my details, so I can feel supported and engaged.
- When I import my WhatsApp chat export, I want the system to clone the target soul and preserve their memories, so I can resume chatting with their replica.

## Main Use Cases
- Interactive chatting with dynamic mood and relationship evolution (Stranger, Acquaintance, Friend, Close Friend, Soulmate).
- Cloning real human personas from WhatsApp TXT exports (synthesizing soul traits and memory seeds).
- Generating profile avatars and Studio images, with an explicit-confirmation selfie flow under active delivery.

## Non-Goals
- We will NOT support group-chat real-time VoIP audio calls in the initial release.
- We will NOT store user-uploaded chat logs permanently on the server side; all parsing is local/ephemeral.

## Data Boundaries & State Behavior
- Local IndexedDB (Dexie) is the authority for local chat histories, psychology variables, and memory seeds.
- Redis Vector Search is used when explicitly configured on the backend for chat-scoped semantic memory lookups; records are not pooled across bots.
- State changes (like intimacy or mood shifts) are calculated asynchronously by Gemini during the self-evolution loop.

## Core User Flows
1. User logs in, lands on the WhatsApp-style sidebar, and selects a companion bot.
2. User chats with the bot, triggering instant replies and background psychological updates.
3. User opens the New Chat Modal, uploads a WhatsApp chat export file, parses participants, select a contact to clone, and initializes the bot with seeded memory blocks.

## Feature List
- Real-time text streaming with dynamic simulated typing delays.
- WhatsApp Chat Export Parser & Persona Cloner.
- Studio-only general image generation using provider-default image safety behavior.
- Chat-scoped memory retrieval without a global cross-bot pool.
- Structured selfie requests that require an explicit user confirmation before execution.

## Functional Requirements
- The system must reply to messages in under 3 seconds under normal network conditions.
- The system must protect user privacy by masking any API tokens or credentials.

## Acceptance Criteria
- **Given** a user imports a valid WhatsApp chat log, **when** the cloner finishes, **then** a new bot is created with matching name, traits, and IndexedDB seeded memories.
- **Given** ordinary chat text or a model-emitted image token, **when** it is processed, **then** no image operation runs.
- **Given** the user confirms a selfie through the interface, **when** the structured request is submitted, **then** it executes at most once for its idempotency key.

## Constraints
- Local IndexedDB storage capacity constraints apply.
- Gemini API token window sizes limit the chat history context retrieved.

## Risk Notes
- Risk: Memory degradation over time. Mitigation: Periodic background self-evolution steps summarize facts and save them as vector memory entries.

## AI-Agent Implementation Boundaries
- Inspect existing files before editing.
- Change one feature area at a time.
- Preserve existing behavior unless explicitly instructed.
