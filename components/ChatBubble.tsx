import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Copy,
  Info,
  Reply as ReplyIcon,
  Trash2,
} from 'lucide-react';
import type { ChatMessage } from '../types.js';
import { useLongPress } from '../hooks/useLongPress.js';
import { areChatBubblePropsEqual } from '../services/chatBubbleComparator.js';
import Avatar from './Avatar.js';
import FilePreviewCard from './FilePreviewCard.js';
import MessageMarkdown from './chat/MessageMarkdown.js';
import ResolvedAttachmentAudio from './chat/ResolvedAttachmentAudio.js';
import ResolvedAttachmentImage from './chat/ResolvedAttachmentImage.js';

interface ChatBubbleProps {
  message: ChatMessage;
  senderName?: string;
  senderAvatar?: string;
  isGroup?: boolean;
  isUser: boolean;
  onReply: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  senderName,
  senderAvatar,
  isGroup,
  isUser,
  onReply,
  onDelete,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const openContextMenuAtBubble = useCallback(() => {
    const rectangle = bubbleRef.current?.getBoundingClientRect();
    if (!rectangle) return;
    setContextMenu({
      x: rectangle.left + rectangle.width / 2,
      y: rectangle.top + rectangle.height / 2,
    });
  }, []);
  const longPressHandlers = useLongPress(openContextMenuAtBubble, 500);

  useEffect(() => {
    if (!contextMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeContextMenu();
    };
    const handleScroll = () => closeContextMenu();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, 0);

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeContextMenu, contextMenu]);

  const audioAttachment = useMemo(
    () => message.attachments?.find(attachment => attachment.mimeType.startsWith('audio')),
    [message.attachments],
  );
  const imageAttachments = useMemo(
    () => message.attachments?.filter(attachment => attachment.mimeType.startsWith('image')) || [],
    [message.attachments],
  );
  const fileAttachments = useMemo(
    () => message.attachments?.filter(attachment => (
      !attachment.mimeType.startsWith('image') && !attachment.mimeType.startsWith('audio')
    )) || [],
    [message.attachments],
  );

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY });
  };

  const handleCopy = () => {
    if (message.text) void navigator.clipboard.writeText(message.text).catch(() => undefined);
    closeContextMenu();
  };

  const handleReply = () => {
    onReply(message);
    closeContextMenu();
  };

  const handleDelete = () => {
    onDelete?.(message);
    closeContextMenu();
  };

  const tail = (
    <svg
      viewBox="0 0 8 13"
      width="8"
      height="13"
      aria-hidden="true"
      className={`absolute bottom-0 fill-current ${isUser ? '-right-2 text-wa-user' : '-left-2 scale-x-[-1] text-wa-bot'}`}
    >
      <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
    </svg>
  );

  return (
    <>
      <div
        ref={bubbleRef}
        id={`bubble-${message.id}`}
        className={`group mb-[3px] flex w-full animate-in fade-in slide-in-from-bottom-1 duration-200 ${isUser ? 'justify-end' : 'justify-start'}`}
        onContextMenu={handleContextMenu}
        {...longPressHandlers}
      >
        <div className={`relative flex max-w-[85%] sm:max-w-[65%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          {!isUser && isGroup ? (
            <div className="z-10 mr-2 flex-shrink-0 self-end">
              <Avatar name={senderName || '?'} gender="female" size="sm" online={false} imageUrl={senderAvatar} />
            </div>
          ) : null}

          <article className={`relative flex min-w-[80px] max-w-full flex-col overflow-hidden rounded-lg px-1.5 py-1 shadow-bubble ${isUser ? 'rounded-tr-none bg-wa-user' : 'rounded-tl-none bg-wa-bot'}`}>
            {tail}

            {isGroup && !isUser && senderName ? (
              <span className="mb-0.5 block max-w-full truncate px-1 text-[12px] font-bold text-[#e542a3]">{senderName}</span>
            ) : null}

            {message.replyTo ? (
              <div className={`mb-1 min-w-0 overflow-hidden rounded-md border-l-4 bg-black/5 p-1.5 text-xs ${isUser ? 'border-[#008069]/50' : 'border-[#e542a3]/50'}`}>
                <div className={`mb-0.5 truncate font-bold ${isUser ? 'text-[#008069]' : 'text-[#e542a3]'}`}>
                  {message.replyTo.senderName}
                </div>
                <div className="line-clamp-2 break-words text-gray-600 opacity-70">{message.replyTo.text}</div>
              </div>
            ) : null}

            {imageAttachments.length > 0 ? (
              <div className="mb-1 flex flex-col gap-1">
                {imageAttachments.map((attachment, index) => (
                  <ResolvedAttachmentImage
                    key={`${attachment.fileName || attachment.previewUrl}-${index}`}
                    attachment={attachment}
                    index={index}
                  />
                ))}
              </div>
            ) : null}

            {fileAttachments.length > 0 ? (
              <div className="mb-1 flex flex-col gap-1">
                {fileAttachments.map((attachment, index) => (
                  <FilePreviewCard
                    key={`${attachment.fileName || attachment.mimeType}-${index}`}
                    fileName={attachment.fileName}
                    fileSize={attachment.fileSize}
                    mimeType={attachment.mimeType}
                    category={attachment.category}
                  />
                ))}
              </div>
            ) : null}

            {audioAttachment ? (
              <ResolvedAttachmentAudio
                attachment={audioAttachment}
                messageId={message.id}
                senderAvatar={senderAvatar}
                isUser={isUser}
              />
            ) : null}

            {message.text ? (
              <div className="px-1.5 font-sans text-[14.2px] leading-[19px] text-[#111b21]" dir="auto">
                <MessageMarkdown text={message.text} />
              </div>
            ) : null}

            {message.groundingUrls?.length ? (
              <div className="mt-2 flex flex-col gap-1 border-t border-black/5 pt-2 text-xs">
                {message.groundingUrls.map(url => (
                  <a
                    key={`${url.uri}:${url.title}`}
                    href={url.uri}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex max-w-full items-center gap-1 truncate rounded-lg bg-black/5 p-1.5 text-blue-600 opacity-80 hover:underline"
                  >
                    <span aria-hidden="true">🔗</span>
                    <span className="truncate font-medium">{url.title}</span>
                  </a>
                ))}
              </div>
            ) : null}

            <div className="mt-0.5 flex select-none items-center justify-end gap-1 px-0.5">
              <time className="text-[11px] leading-none text-[#667781]" dateTime={new Date(message.timestamp).toISOString()}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
              {isUser ? (
                <span className={`leading-none ${message.isThinking ? 'text-gray-400' : 'text-wa-blue'}`} aria-label={message.isThinking ? 'تم الإرسال' : 'تم التسليم'}>
                  {message.isThinking ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : <CheckCheck size={15} strokeWidth={2.5} aria-hidden="true" />}
                </span>
              ) : null}
            </div>

            {message.reactions?.length ? (
              <div className={`absolute -bottom-3 z-20 flex items-center gap-0.5 rounded-full border border-gray-100 bg-white px-1.5 py-0.5 shadow-sm ${isUser ? 'left-2' : 'right-2'}`}>
                {message.reactions.map((reaction, index) => (
                  <span key={`${reaction.senderId}:${reaction.emoji}:${index}`} className="text-sm leading-none" title={reaction.senderName}>{reaction.emoji}</span>
                ))}
                {message.reactions.length > 1 ? (
                  <span className="ms-0.5 text-[9px] font-medium text-gray-500">{message.reactions.length}</span>
                ) : null}
              </div>
            ) : null}
          </article>

          <button
            type="button"
            onClick={() => onReply(message)}
            className={`absolute hidden min-h-11 min-w-11 self-center p-1 text-gray-400 opacity-0 transition-opacity hover:text-gray-600 focus:opacity-100 group-hover:opacity-100 sm:block ${isUser ? '-left-11' : '-right-11'}`}
            aria-label="الرد على الرسالة"
          >
            <ReplyIcon size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {contextMenu ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="خيارات الرسالة"
          className="fixed z-[9999] min-w-[180px] max-w-[260px] animate-in rounded-lg bg-white py-1.5 shadow-2xl ring-1 ring-black/10 fade-in zoom-in-95 duration-150"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 220),
            left: Math.min(Math.max(contextMenu.x - 90, 8), window.innerWidth - 208),
          }}
        >
          <button type="button" role="menuitem" onClick={handleReply} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111b21] transition-colors hover:bg-[#f0f2f5]">
            <ReplyIcon size={16} className="text-[#54656f]" aria-hidden="true" /><span>رد</span>
          </button>
          {message.text ? (
            <button type="button" role="menuitem" onClick={handleCopy} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111b21] transition-colors hover:bg-[#f0f2f5]">
              <Copy size={16} className="text-[#54656f]" aria-hidden="true" /><span>نسخ</span>
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={closeContextMenu} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-sm text-[#111b21] transition-colors hover:bg-[#f0f2f5]">
            <Info size={16} className="text-[#54656f]" aria-hidden="true" /><span>معلومات الرسالة</span>
          </button>
          {onDelete ? (
            <>
              <div className="my-1 border-t border-[#e9edef]" />
              <button type="button" role="menuitem" onClick={handleDelete} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50">
                <Trash2 size={16} aria-hidden="true" /><span>حذف</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

export default React.memo(ChatBubble, areChatBubblePropsEqual);
