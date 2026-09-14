import React from 'react';
import { useVisualViewportLayout } from '../hooks/useVisualViewportLayout.js';

interface ResponsiveWhatsAppShellProps {
  sidebar: React.ReactNode;
  mobileSidebar?: React.ReactNode;
  chat: React.ReactNode;
  hasActiveChat: boolean;
  mobilePane: 'list' | 'chat';
  onShowList?: () => void;
}

const ResponsiveWhatsAppShell: React.FC<ResponsiveWhatsAppShellProps> = ({
  sidebar,
  mobileSidebar,
  chat,
  hasActiveChat,
  mobilePane,
  onShowList,
}) => {
  const viewport = useVisualViewportLayout();
  const showMobileChat = viewport.singlePane && mobilePane === 'chat' && hasActiveChat;
  const navigation = viewport.singlePane && mobileSidebar ? mobileSidebar : sidebar;

  return (
    <div
      className="relative flex w-full overflow-hidden bg-[#f0f2f5]"
      style={{ height: '100%' }}
      data-layout={viewport.singlePane ? 'single-pane' : 'split-pane'}
      data-mobile-pane={showMobileChat ? 'chat' : 'list'}
    >
      <aside
        className={`${viewport.singlePane ? (showMobileChat ? 'hidden' : 'flex w-full') : 'flex w-[min(420px,36vw)]'} min-w-0 shrink-0 flex-col border-l border-gray-200 bg-white`}
        aria-hidden={viewport.singlePane && showMobileChat}
      >
        {navigation}
      </aside>

      <main
        className={`${viewport.singlePane ? (showMobileChat ? 'flex w-full' : 'hidden') : 'flex flex-1'} min-w-0 flex-col overflow-hidden`}
        aria-hidden={viewport.singlePane && !showMobileChat}
      >
        {showMobileChat && onShowList ? (
          <button
            type="button"
            onClick={onShowList}
            className="sr-only focus:not-sr-only focus:absolute focus:right-3 focus:top-3 focus:z-50 focus:min-h-11 focus:rounded-lg focus:bg-white focus:px-4 focus:text-sm focus:font-bold focus:shadow"
          >
            الرجوع لقائمة المحادثات
          </button>
        ) : null}
        {chat}
      </main>
    </div>
  );
};

export default ResponsiveWhatsAppShell;
