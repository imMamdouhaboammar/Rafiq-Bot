import type { RafiqTransferV2, StoryAcl } from '../contracts/rafiqV6.js';
import { validateRafiqTransferV2 } from './transferV2.js';

export interface ExistingTransferIds {
  chatIds: Iterable<string>;
  messageIds: Iterable<string>;
  lifeStoryEventIds: Iterable<string>;
  botStoryEventIds: Iterable<string>;
  memoryIds: Iterable<string>;
  attachmentIds: Iterable<string>;
}

export interface TransferImportIdMaps {
  chats: Map<string, string>;
  messages: Map<string, string>;
  lifeStoryEvents: Map<string, string>;
  botStoryEvents: Map<string, string>;
  memories: Map<string, string>;
  attachments: Map<string, string>;
}

export interface PreparedTransferImport {
  transfer: RafiqTransferV2;
  idMaps: TransferImportIdMaps;
  warnings: string[];
  missingBotIds: string[];
  degradedGroupIds: string[];
}

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const readId = (value: unknown, kind: string): string => {
  const id = asRecord(value).id;
  if (typeof id !== 'string' || !id.trim()) {
    throw new Error(`Transfer ${kind} record is missing a valid ID.`);
  }
  return id;
};

const createMap = (
  values: unknown[],
  existingIds: Iterable<string>,
  prefix: string,
  createId: (prefix: string, oldId: string) => string,
): Map<string, string> => {
  const occupied = new Set(existingIds);
  const result = new Map<string, string>();
  for (const value of values) {
    const oldId = readId(value, prefix);
    let nextId = oldId;
    if (occupied.has(nextId)) {
      do {
        nextId = createId(prefix, oldId);
      } while (occupied.has(nextId));
    }
    occupied.add(nextId);
    result.set(oldId, nextId);
  }
  return result;
};

const mapString = (value: unknown, mapping: Map<string, string>): unknown => (
  typeof value === 'string' ? mapping.get(value) || value : value
);

const remapAcl = (
  acl: StoryAcl,
  chatMap: Map<string, string>,
  validBotIds: Set<string>,
  warnings: string[],
  ownerId: string,
): StoryAcl => {
  if (acl.visibility !== 'selected_bots') return structuredClone(acl);
  const mapped = [...new Set(acl.botIds
    .map(botId => chatMap.get(botId) || botId)
    .filter(botId => validBotIds.has(botId)))];
  if (mapped.length > 0) return { visibility: 'selected_bots', botIds: mapped };

  warnings.push(`${ownerId}: selected bot ACL had no available bots and was changed to private.`);
  return { visibility: 'private', botIds: [] };
};

const remapMessage = (
  value: unknown,
  maps: TransferImportIdMaps,
): unknown => {
  const message = structuredClone(asRecord(value));
  const oldId = readId(message, 'message');
  message.id = maps.messages.get(oldId)!;
  message.chatId = mapString(message.chatId, maps.chats);
  message.senderId = mapString(message.senderId, maps.chats);
  message.rootMessageId = mapString(message.rootMessageId, maps.messages);
  message.replyToMessageId = mapString(message.replyToMessageId, maps.messages);

  const replyTo = asRecord(message.replyTo);
  if (Object.keys(replyTo).length > 0) {
    message.replyTo = {
      ...replyTo,
      id: mapString(replyTo.id, maps.messages),
      senderId: mapString(replyTo.senderId, maps.chats),
    };
  }

  if (Array.isArray(message.attachments)) {
    message.attachments = message.attachments.map(attachmentValue => {
      const attachment = structuredClone(asRecord(attachmentValue));
      if (typeof attachment.id === 'string') {
        attachment.id = maps.attachments.get(attachment.id) || attachment.id;
      }
      delete attachment.base64;
      delete attachment.file;
      delete attachment.data;
      delete attachment.bytes;
      delete attachment.blob;
      attachment.previewUrl = '';
      attachment.availability = 'missing';
      return attachment;
    });
  }
  return message;
};

export const prepareTransferV2Import = (
  transferInput: unknown,
  existing: ExistingTransferIds,
  options: {
    createId?: (prefix: string, oldId: string) => string;
  } = {},
): PreparedTransferImport => {
  const transfer = validateRafiqTransferV2(transferInput);
  let counter = 0;
  const createId = options.createId || ((prefix: string) => `${prefix}-${crypto.randomUUID()}`);
  const uniqueId = (prefix: string, oldId: string): string => (
    createId(prefix, `${oldId}-${++counter}`)
  );

  const maps: TransferImportIdMaps = {
    chats: createMap(transfer.chats, existing.chatIds, 'chat', uniqueId),
    messages: createMap(transfer.messages, existing.messageIds, 'message', uniqueId),
    lifeStoryEvents: createMap(transfer.lifeStoryEvents, existing.lifeStoryEventIds, 'life-story', uniqueId),
    botStoryEvents: createMap(transfer.botStoryEvents, existing.botStoryEventIds, 'bot-story', uniqueId),
    memories: createMap(transfer.memories, existing.memoryIds, 'memory', uniqueId),
    attachments: createMap(transfer.attachments, existing.attachmentIds, 'attachment', uniqueId),
  };

  const warnings: string[] = [];
  const missingBotIds = new Set<string>();
  const degradedGroupIds: string[] = [];
  const existingChatSet = new Set(existing.chatIds);
  const importedChats = transfer.chats.map(value => {
    const chat = structuredClone(asRecord(value));
    const oldId = readId(chat, 'chat');
    chat.id = maps.chats.get(oldId)!;
    if (chat.isGroup === true && Array.isArray(chat.memberIds)) {
      const originalMemberIds = chat.memberIds.filter((id): id is string => typeof id === 'string');
      const mappedMemberIds = originalMemberIds
        .map(memberId => maps.chats.get(memberId) || memberId)
        .filter(memberId => {
          const available = existingChatSet.has(memberId) || [...maps.chats.values()].includes(memberId);
          if (!available) missingBotIds.add(memberId);
          return available;
        });
      const uniqueMemberIds = [...new Set(mappedMemberIds)];
      chat.memberIds = uniqueMemberIds;
      if (uniqueMemberIds.length < 2) {
        degradedGroupIds.push(chat.id as string);
        chat.importState = 'degraded_missing_members';
        warnings.push(`${chat.id}: group imported with fewer than two available members.`);
      }
    }
    chat.unreadCount = 0;
    return chat;
  });

  const validBotIds = new Set<string>([
    ...existingChatSet,
    ...importedChats
      .filter(chat => chat.isGroup !== true)
      .map(chat => String(chat.id)),
  ]);
  const importedMessages = transfer.messages.map(message => remapMessage(message, maps));
  const importedLifeStory = transfer.lifeStoryEvents.map(event => ({
    ...event,
    id: maps.lifeStoryEvents.get(event.id)!,
    acl: remapAcl(event.acl, maps.chats, validBotIds, warnings, event.id),
  }));
  const importedBotStory = transfer.botStoryEvents.map(event => ({
    ...event,
    id: maps.botStoryEvents.get(event.id)!,
    botId: maps.chats.get(event.botId) || event.botId,
    sourceMessageIds: event.sourceMessageIds.map(id => maps.messages.get(id) || id),
    sourceGroupId: event.sourceGroupId ? maps.chats.get(event.sourceGroupId) || event.sourceGroupId : undefined,
    supersedesId: event.supersedesId ? maps.botStoryEvents.get(event.supersedesId) || event.supersedesId : undefined,
    acl: remapAcl(event.acl, maps.chats, validBotIds, warnings, event.id),
  }));
  const importedMemories = transfer.memories.map(memory => {
    let scopeId = memory.scopeId;
    if (memory.scope === 'bot' || memory.scope === 'chat' || memory.scope === 'group') {
      scopeId = maps.chats.get(scopeId) || scopeId;
    }
    return {
      ...memory,
      id: maps.memories.get(memory.id)!,
      scopeId,
      provenance: {
        ...memory.provenance,
        sourceIds: memory.provenance.sourceIds.map(id => maps.messages.get(id) || id),
      },
      supersedesId: memory.supersedesId ? maps.memories.get(memory.supersedesId) || memory.supersedesId : undefined,
    };
  });
  const importedAttachments = transfer.attachments.map(attachment => ({
    ...attachment,
    id: maps.attachments.get(attachment.id)!,
    chatId: maps.chats.get(attachment.chatId) || attachment.chatId,
    messageId: attachment.messageId ? maps.messages.get(attachment.messageId) || attachment.messageId : undefined,
    opfsKey: undefined,
    availability: 'missing' as const,
    processingProgress: 0,
  }));

  const prepared = {
    manifest: {
      ...transfer.manifest,
      counts: {
        chats: importedChats.length,
        messages: importedMessages.length,
        lifeStoryEvents: importedLifeStory.length,
        botStoryEvents: importedBotStory.length,
        memories: importedMemories.length,
        attachments: importedAttachments.length,
      },
    },
    chats: importedChats,
    messages: importedMessages,
    lifeStoryEvents: importedLifeStory,
    botStoryEvents: importedBotStory,
    memories: importedMemories,
    attachments: importedAttachments,
  } as RafiqTransferV2;

  return {
    transfer: prepared,
    idMaps: maps,
    warnings,
    missingBotIds: [...missingBotIds],
    degradedGroupIds,
  };
};
