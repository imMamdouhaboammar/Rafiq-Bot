# DESIGN.md

## Design Read
Reading this as: WhatsApp-style web chat application for general users seeking companionship, with a clean and flat visual system decision, leaning toward WhatsApp's color palette (teal and light sand backgrounds) and highly readable font pairing.

## Taste Controls
- DESIGN_VARIANCE: 5
- MOTION_INTENSITY: 4
- VISUAL_DENSITY: 5

## Design System Decision
Chosen foundation: Tailwind CSS.

## Design Principles
- Clear before clever.
- Mobile behavior must be explicit.
- Every interactive component needs loading, empty, error, disabled, hover, focus, and success states.

## Information Architecture & Routes
- `/` -> Main Chat Interface (including sidebar, status updates, and settings tabs).

## Main Screens
- **Main Chat Workspace**: Split layout with Sidebar on the left (or full screen on mobile) and Chat area on the right.
- **New Chat Modal**: Multi-step modal for creating a bot or uploading/exporting chat files.

## Component Inventory
- Layout: Split Screen Container, Sidebar, Chat Area
- UI Elements: Chat Bubbles, Audio Recorder, image generation viewer, Status viewer circle, Toast alerts.

## Responsive Behavior (Deterministic)
- Mobile (under 768px): Use flex-col and w-full blocks. Sidebar takes full screen by default. Selecting a chat shifts view to Chat Interface. Modals use 100% width and fit inside viewport.
- Tablet (md 768px): md:flex and md:grid layouts for split-pane views.
- Desktop (lg 1024px): lg:grid layouts with fixed sidebar width.

## Typography Scale
- H1: `text-2xl font-bold leading-normal`
- H2: `text-xl font-semibold leading-normal`
- Body: `text-base normal leading-relaxed`
- Label: `text-sm font-medium leading-normal`
- Helper Text: `text-xs normal leading-normal`
- Error Text: `text-xs font-medium leading-normal text-red-500`

## RTL Typography Contract
- **Arabic Font handling**: Mixed-language pages use a clean Arabic font system with clean fallback.
- **Arabic Line-Height**: Set Arabic line-height to `leading-relaxed` or `leading-loose` to prevent vertical glyph clipping.
- **Bilingual Type**: Ensure proper font pairing for English and Arabic.
- **Label Density**: Avoid tight vertical grids in bilingual headings.

## Modal & Overlay Viewport Contract
- **Viewport Contract**: Overlays must fit inside the visual viewport on mobile and desktop, ensuring no clipping.
- **Width Guard**: Use `max-w-md` or `w-full` to prevent horizontal stretch.
- **Height Guard**: Use max-height 90dvh or dynamic 100dvh units.
- **Internal Scroll**: Long overlay content needs internal scroll behavior, scrolling only the content pane via overflow-y-auto.
- **Scrollbar Aesthetic**: Scrollable overlays use custom scrollbar or thin scrollbar to hide native heavy scrollbars.
- **Mobile Behavior**: Center-aligned modal on desktop, full screen or bottom sheet on mobile.
- **Viewport QA Proof**: Verified layouts on 320x568, 375x667, and 390x844 in both portrait and landscape modes, and under keyboard-open state with no horizontal overflow.
- **Fixed Size Risk Prevention**: Bounded dynamic viewport heights prevent fixed pixel sizing bugs.

## Stacking Plan & Layer Scale
- **Stacking Plan**: All overlays are rendered at the root level of the stacking context.
- **Layer Scale**:
  - Base: z-index 0
  - Sidebar: z-index 10
  - Chat Header: z-index 20
  - Modal Backdrop: z-index 90
  - Modal Content: z-index 100
  - Toast Host: z-index 200
  - Event Console: z-index 9999
- **Stacking Context Audit**: Audit ancestor elements for transform, opacity, filter, or will-change properties to prevent layer leak.
- **Overlay Portal Policy**: Modals must render in a portal root to ensure correct stacking context layout.
- **Conflict Matrix**: Layer order guarantees modal overlays render above the sticky header, drawer vs sidebar, and toast vs modal.

## Accessibility & Contrast (Deterministic)
- Focus management: Interactive elements must use focus-visible:ring-2 focus-visible:ring-offset-2. Never use outline-none.
- Focus trap: Modals must trap focus internally and release on close.
- Contrast math: Mathematical deltas: light backgrounds (50-200) require dark text (800-950); dark backgrounds (700-950) require light text (50-200). Never place text on buttons lighter than 600.

## Interaction States
- Loading state: Interactive widgets use animate-pulse for loading.
- Disabled state: Use opacity-50 and cursor-not-allowed.
- Empty state: Call to action message when data is missing.

## Form Behavior
- Form validation: Validate inputs on blur/submit.
- Error copy: Inline warning texts placed under fields.
- Submission state: Disable submit button during active submission.

## Visual Consistency Rules
- Reuse tailwind utility spacing values (e.g., p-4, m-2).

## Agent Handoff
- Before coding, the agent must restate the Design Read, chosen Taste Controls, and screen being edited.

## Pre-flight Check
- [x] Design Read is specific to the product and audience.
- [x] Taste Controls are calibrated.
- [x] Typography, viewport contract, and stacking plan are defined.
