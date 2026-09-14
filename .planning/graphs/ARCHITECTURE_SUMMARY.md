# Codebase Architecture Graph Summary
Generated at: 2026-09-13T15:12:57.030Z
Root: /Users/mamdouhaboammar/Documents/antigravity/zealous-hypatia
Total Source Files: 336
Total Dependencies/Edges: 598

## Critical Hub Nodes (Highest Connectivity / Architectural Load):
1. **`types.ts`** (73 connections: 71 in, 2 out)
2. **`services/geminiService.server.ts`** (34 connections: 4 in, 30 out)
3. **`hooks/useChatController.ts`** (25 connections: 1 in, 24 out)
4. **`components/ChatInterface.tsx`** (24 connections: 1 in, 23 out)
5. **`services/eventBus.ts`** (24 connections: 23 in, 1 out)
6. **`services/db.ts`** (21 connections: 19 in, 2 out)
7. **`App.tsx`** (19 connections: 1 in, 18 out)
8. **`contracts/rafiqV6.ts`** (18 connections: 17 in, 1 out)
9. **`services/googleClient.server.ts`** (16 connections: 10 in, 6 out)
10. **`services/personaEngine.ts`** (15 connections: 8 in, 7 out)

## Key Exported Classes & Symbols:
- **`App.tsx`**: DialogState, App
- **`api/gemini.ts`**: validateReflectionArgs
- **`components/AppDialog.tsx`**: AppDialogProps, AppDialogTone
- **`components/Avatar.tsx`**: AvatarProps
- **`components/BotStoryPanel.tsx`**: CorrectionDraft
- **`components/CapabilityHealthDashboard.tsx`**: CapabilityHealthDashboardProps
- **`components/ChatBubble.tsx`**: ChatBubbleProps
- **`components/ChatInterface.tsx`**: ChatInterfaceProps
- **`components/CloneAnalysisEditor.tsx`**: CloneAnalysisEditorProps, CloneProfile, EditableCloneProfile, EditableCloneProfile
- **`components/CloneAnalysisStatus.tsx`**: CloneAnalysisStatusProps, CloneProfile
- **`components/ComposerAttachmentTray.tsx`**: ComposerAttachmentUpload, ReadyComposerAttachment, ComposerAttachmentTrayProps, ComposerAttachmentUpload, ReadyComposerAttachment
- **`components/FilePreviewCard.tsx`**: FilePreviewCardProps
- **`components/FloatingTriggerButton.tsx`**: FloatingTriggerButtonProps, FloatingTriggerButton
- **`components/LiveVoice.tsx`**: LiveVoiceProps
- **`components/MobileNavigationPane.tsx`**: MobileNavigationPaneProps, MobileNavigationTab, FilterChip, MobileNavigationTab