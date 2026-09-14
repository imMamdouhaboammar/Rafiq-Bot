
import { useState, useEffect, useMemo, useRef, type ChangeEvent } from 'react';
import { useGroupStore } from '../stores/groupStore.js';
import { groupEngine } from '../services/groupEngine.js';
import * as DB from '../services/db.js';
import { ChatSession, ChatMessage, MessageRole, type Attachment } from '../types.js';
import { eventBus, RafiqEventMap } from '../services/eventBus.js';
import {
    finalizeComposerAttachments,
    releaseComposerAttachments,
    stageComposerAttachment,
    type StagedComposerAttachment,
} from '../services/attachmentComposer.js';
import { attachmentRepository } from '../services/attachmentRepository.js';

export interface GroupComposerAttachmentUpload {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    progress: number;
}

export const useGroupController = (groupChat: ChatSession) => {
    const { messages, addGroupMessage, addReaction, removeGroupMessage, setGroupMessages, typingPersonas, setTyping } = useGroupStore();
    const [input, setInput] = useState('');
    const [isReady, setIsReady] = useState(false);
    const [initializationError, setInitializationError] = useState<string | null>(null);
    const [initializationAttempt, setInitializationAttempt] = useState(0);
    const [stagedAttachments, setStagedAttachments] = useState<StagedComposerAttachment[]>([]);
    const [attachmentUploads, setAttachmentUploads] = useState<GroupComposerAttachmentUpload[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const initializationRef = useRef<Promise<void> | null>(null);
    const readyRef = useRef(false);
    const initializedMemberSignatureRef = useRef('');
    const isSendingRef = useRef(false);
    const stagedAttachmentsRef = useRef<StagedComposerAttachment[]>([]);
    const attachmentUploadsRef = useRef<GroupComposerAttachmentUpload[]>([]);
    const attachmentUploadControllersRef = useRef(new Map<string, AbortController>());
    const memberSignature = [...(groupChat.memberIds || [])].sort().join(':');
    const groupId = groupChat.id;
    const groupDefinition = useMemo<ChatSession>(() => ({
        id: groupChat.id,
        isGroup: groupChat.isGroup,
        groupName: groupChat.groupName,
        memberIds: groupChat.memberIds ? [...groupChat.memberIds] : undefined,
        settings: groupChat.settings,
        psychology: groupChat.psychology,
    }), [
        groupChat.id,
        groupChat.isGroup,
        groupChat.groupName,
        groupChat.memberIds,
        memberSignature,
        groupChat.settings,
        groupChat.psychology,
    ]);
    
    // Group-specific messages from store
    const groupMessages = messages[groupChat.id] || [];
    const attachments = useMemo(
        () => stagedAttachments.map(attachment => attachment.draft),
        [stagedAttachments],
    );
    const composerAttachments = useMemo(
        () => stagedAttachments.map(attachment => ({ id: attachment.attachmentId, attachment: attachment.draft })),
        [stagedAttachments],
    );

    const replaceAttachmentUploads = (
        updater: (current: GroupComposerAttachmentUpload[]) => GroupComposerAttachmentUpload[],
    ) => {
        const next = updater(attachmentUploadsRef.current);
        attachmentUploadsRef.current = next;
        setAttachmentUploads(next);
    };

    useEffect(() => {
        stagedAttachmentsRef.current = stagedAttachments;
    }, [stagedAttachments]);

    useEffect(() => {
        setStagedAttachments([]);
        setAttachmentUploads([]);

        return () => {
            for (const controller of attachmentUploadControllersRef.current.values()) controller.abort();
            for (const upload of attachmentUploadsRef.current) {
                void attachmentRepository.remove(upload.id);
            }
            attachmentUploadControllersRef.current.clear();
            attachmentUploadsRef.current = [];
            const unsentAttachments = stagedAttachmentsRef.current;
            stagedAttachmentsRef.current = [];
            releaseComposerAttachments(unsentAttachments);
            for (const attachment of unsentAttachments) {
                void attachmentRepository.remove(attachment.attachmentId);
            }
        };
    }, [groupId]);

    // 1. Initialize Engine & Load Data
    useEffect(() => {
        let cancelled = false;
        let groupSessionInitialized = false;
        readyRef.current = false;
        initializedMemberSignatureRef.current = '';
        setIsReady(false);
        setInitializationError(null);

        const init = async () => {
            // Load Members
            if (!groupDefinition.isGroup || !groupDefinition.memberIds?.length) return;
            const [members, history] = await Promise.all([
                DB.getChatSessionsByIds(groupDefinition.memberIds),
                DB.getMessagesForChat(groupId, 50, true),
            ]);
            if (cancelled) return;
            setGroupMessages(groupId, history);
            if (members.length < 2) {
                throw new Error('المجموعة محتاجة بوتين موجودين على الأقل');
            }
            
            // Start Engine
            await groupEngine.initGroupSession(groupDefinition, members);
            groupSessionInitialized = true;
            if (cancelled) {
                groupEngine.destroyGroupSession(groupId);
                return;
            }
            
            if (!cancelled) {
                readyRef.current = true;
                initializedMemberSignatureRef.current = memberSignature;
                setIsReady(true);
            }
        };
        const initialization = init().catch((error) => {
            if (!cancelled) {
                setInitializationError(error instanceof Error ? error.message : 'تعذر تجهيز المجموعة');
                eventBus.emitError('GroupController', error, 'GROUP_INITIALIZATION_FAILED');
            }
        });
        initializationRef.current = initialization;

        return () => {
            cancelled = true;
            readyRef.current = false;
            initializedMemberSignatureRef.current = '';
            if (groupSessionInitialized) groupEngine.destroyGroupSession(groupId);
        };
    }, [groupDefinition, groupId, initializationAttempt, memberSignature, setGroupMessages]);

    const retryInitialization = () => {
        setInitializationAttempt(attempt => attempt + 1);
    };

    const showAttachmentError = (message: string) => {
        eventBus.emit('ui:toast', { message, type: 'error' });
    };

    const addAttachment = async (file: File) => {
        const attachmentId = crypto.randomUUID();
        const controller = new AbortController();
        attachmentUploadControllersRef.current.set(attachmentId, controller);
        replaceAttachmentUploads(current => [...current, {
            id: attachmentId,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileSize: file.size,
            progress: 0,
        }]);

        try {
            const staged = await stageComposerAttachment({
                chatId: groupId,
                file,
                attachmentId,
                currentCount: stagedAttachmentsRef.current.length + attachmentUploadsRef.current.length - 1,
                signal: controller.signal,
                onProgress: progress => {
                    replaceAttachmentUploads(current => current.map(upload => (
                        upload.id === attachmentId ? { ...upload, progress } : upload
                    )));
                },
            });
            if (controller.signal.aborted) {
                staged.revokePreview();
                await attachmentRepository.remove(attachmentId);
                return;
            }
            const next = [...stagedAttachmentsRef.current, staged];
            stagedAttachmentsRef.current = next;
            setStagedAttachments(next);
        } catch (error) {
            await attachmentRepository.remove(attachmentId);
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
                showAttachmentError(error instanceof Error ? error.message : 'تعذر حفظ الملف محليًا');
            }
        } finally {
            attachmentUploadControllersRef.current.delete(attachmentId);
            replaceAttachmentUploads(current => current.filter(upload => upload.id !== attachmentId));
        }
    };

    const addAttachments = async (files: File[]) => {
        for (const file of files) await addAttachment(file);
    };

    const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.length) {
            await addAttachments(Array.from(event.target.files));
            event.target.value = '';
        }
    };

    const handleFileDrop = async (files: FileList | File[]) => {
        await addAttachments(Array.from(files));
    };

    const cancelAttachmentUpload = (attachmentId: string) => {
        attachmentUploadControllersRef.current.get(attachmentId)?.abort();
    };

    const removeComposerAttachment = async (attachmentId: string) => {
        const current = stagedAttachmentsRef.current.find(attachment => attachment.attachmentId === attachmentId);
        if (!current) return;
        const next = stagedAttachmentsRef.current.filter(attachment => attachment.attachmentId !== attachmentId);
        stagedAttachmentsRef.current = next;
        setStagedAttachments(next);
        current.revokePreview();
        try {
            await attachmentRepository.remove(attachmentId);
        } catch (error) {
            showAttachmentError(error instanceof Error ? error.message : 'تعذر إزالة المرفق');
        }
    };

    // 2. Listen for Real-time Events
    useEffect(() => {
        const handleNewMessage = (payload: RafiqEventMap['group:message_send']) => {
            if (payload.groupId !== groupId) return;

            const msg: ChatMessage = {
                id: payload.msgId || crypto.randomUUID(),
                chatId: payload.groupId,
                role: payload.senderId === 'user' ? MessageRole.USER : MessageRole.MODEL,
                senderId: payload.senderId,
                senderName: payload.senderName,
                rootMessageId: payload.rootMessageId,
                replyToMessageId: payload.replyToMessageId,
                depth: payload.depth,
                text: payload.text,
                timestamp: new Date()
            };
            
            // If it's incoming (not user), add to store (User msg is added optimistically in handleSend)
            if (payload.senderId !== 'user') {
                addGroupMessage(groupId, msg);
            }

        };

        const handleReaction = (payload: RafiqEventMap['group:message_reaction']) => {
            if (payload.groupId !== groupId) return;
            addReaction(groupId, payload.messageId, {
                senderId: payload.senderId,
                senderName: payload.senderName,
                emoji: payload.emoji
            });
        };

        const handleThinkingStart = (p: {chatId: string; personaId: string}) => {
            if (p.chatId === groupId) setTyping(groupId, p.personaId, true);
        };

        const handleThinkingEnd = (p: {chatId: string; personaId: string}) => {
            if (p.chatId === groupId) setTyping(groupId, p.personaId, false);
        };

        eventBus.on("group:message_send", handleNewMessage);
        eventBus.on("group:message_reaction", handleReaction);
        eventBus.on("ai:thinking_start", handleThinkingStart);
        eventBus.on("ai:thinking_end", handleThinkingEnd);

        return () => {
            eventBus.off("group:message_send", handleNewMessage);
            eventBus.off("group:message_reaction", handleReaction);
            eventBus.off("ai:thinking_start", handleThinkingStart);
            eventBus.off("ai:thinking_end", handleThinkingEnd);
        };
    }, [addGroupMessage, addReaction, groupId, setTyping]);



    const handleSend = async () => {
        const text = input.trim();
        if (attachmentUploadsRef.current.length > 0) {
            showAttachmentError('استنى لحد ما رفع المرفقات يكتمل');
            return;
        }
        if ((!text && stagedAttachmentsRef.current.length === 0) || isSendingRef.current) return;

        if (!readyRef.current || initializedMemberSignatureRef.current !== memberSignature) {
            await initializationRef.current;
        }

        if (!readyRef.current || initializedMemberSignatureRef.current !== memberSignature) {
            eventBus.emit('ui:toast', {
                message: 'المجموعة لسه بتتجهز، جرّب تاني بعد لحظة',
                type: 'info',
            });
            return;
        }

        isSendingRef.current = true;
        const msgId = crypto.randomUUID();
        let persistentAttachments: Attachment[] = [];
        try {
            persistentAttachments = await finalizeComposerAttachments({
                staged: stagedAttachmentsRef.current,
                messageId: msgId,
            });
        } catch (error) {
            showAttachmentError(error instanceof Error ? error.message : 'تعذر تجهيز المرفقات');
            isSendingRef.current = false;
            return;
        }
        const userMsg: ChatMessage = {
            id: msgId,
            chatId: groupChat.id,
            role: MessageRole.USER,
            senderId: 'user',
            senderName: 'أنت',
            rootMessageId: msgId,
            depth: 0,
            text,
            attachments: persistentAttachments,
            timestamp: new Date()
        };

        // 1. Optimistic UI Update
        addGroupMessage(groupChat.id, userMsg);
        setInput('');
        const sentAttachments = stagedAttachmentsRef.current;
        setStagedAttachments([]);
        stagedAttachmentsRef.current = [];
        releaseComposerAttachments(sentAttachments);
        
        // 2. Persist
        try {
            await DB.saveGroupMessage(userMsg);
        } catch (error) {
            removeGroupMessage(groupChat.id, msgId);
            setInput(current => current.trim() ? current : text);
            eventBus.emitError('GroupController', error, 'GROUP_MESSAGE_SAVE_FAILED');
            isSendingRef.current = false;
            return;
        }

        // 3. Notify Engine
        eventBus.emit("group:message_send", {
            groupId: groupChat.id,
            senderId: 'user',
            senderName: 'أنت',
            text: userMsg.text,
            msgId: msgId,
            rootMessageId: msgId,
            depth: 0,
            attachmentIds: sentAttachments.map(attachment => attachment.attachmentId),
        });
        isSendingRef.current = false;
    };

    return {
        messages: groupMessages,
        input,
        setInput,
        handleSend,
        scrollRef,
        isReady: isReady && initializedMemberSignatureRef.current === memberSignature,
        initializationError,
        retryInitialization,
        typingUsers: typingPersonas[groupChat.id] || [],
        attachments,
        composerAttachments,
        attachmentUploads,
        addAttachment,
        handleFile,
        handleFileDrop,
        cancelAttachmentUpload,
        removeComposerAttachment,
    };
};
