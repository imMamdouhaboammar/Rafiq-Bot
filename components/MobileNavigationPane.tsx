import React, { useMemo, useState } from 'react';
import {
  Camera,
  CheckCheck,
  Download,
  MessageCircle,
  MessageSquarePlus,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { ChatSession, UserProfile } from '../types.js';
import Avatar from './Avatar.js';
import PwaToolsTab from './PwaToolsTab.js';
import UpdatesTab from './UpdatesTab.js';
import UserProfileModal from './UserProfileModal.js';
import { triggerHaptic } from '../utils/haptics.js';

export type MobileNavigationTab = 'chats' | 'updates' | 'pwa' | 'profile';
type FilterChip = 'all' | 'unread' | 'groups' | 'bots';

interface MobileNavigationPaneProps {
  activeTab: MobileNavigationTab;
  chats: ChatSession[];
  userProfile: UserProfile | null;
  onTabChange: (tab: MobileNavigationTab) => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onSaveProfile: (profile: UserProfile) => void | Promise<void>;
}

const formatTime = (value?: Date): string => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
};

const MobileNavigationPane: React.FC<MobileNavigationPaneProps> = ({
  activeTab,
  chats,
  userProfile,
  onTabChange,
  onSelectChat,
  onNewChat,
  onSaveProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showTopMenu, setShowTopMenu] = useState(false);

  const totalUnread = chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
  const bots = chats.filter(chat => !chat.isGroup);

  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      // Filter chip
      if (activeFilter === 'unread' && (!chat.unreadCount || chat.unreadCount === 0)) return false;
      if (activeFilter === 'groups' && !chat.isGroup) return false;
      if (activeFilter === 'bots' && chat.isGroup) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = chat.isGroup ? chat.groupName || '' : chat.settings.botName || '';
      const lastMsg = chat.lastMessage || '';
      return name.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
    });
  }, [chats, activeFilter, searchQuery]);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f0f2f5]" dir="rtl">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(64px+env(safe-area-inset-bottom))]">
        {activeTab === 'chats' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* WhatsApp Top Header Bar */}
            <header className="flex h-[calc(60px+env(safe-area-inset-top))] shrink-0 items-center justify-between bg-[#008069] px-4 pt-[env(safe-area-inset-top)] text-white shadow-sm">
              <h1 className="text-xl font-bold tracking-wide">رفيق</h1>

              <div className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onNewChat();
                  }}
                  className="grid h-11 w-11 place-items-center rounded-full text-white/90 hover:bg-white/10 active:scale-90 transition-transform"
                  aria-label="كاميرا"
                >
                  <Camera size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowSearch(prev => !prev);
                  }}
                  className={`grid h-11 w-11 place-items-center rounded-full text-white/90 hover:bg-white/10 active:scale-90 transition-transform ${showSearch ? 'bg-white/20' : ''}`}
                  aria-label="بحث"
                >
                  <Search size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowTopMenu(prev => !prev);
                  }}
                  className="grid h-11 w-11 place-items-center rounded-full text-white/90 hover:bg-white/10 active:scale-90 transition-transform"
                  aria-label="المزيد من الخيارات"
                >
                  <MoreVertical size={20} />
                </button>

                {/* Top Dropdown Menu */}
                {showTopMenu ? (
                  <div
                    className="absolute left-0 top-12 z-50 w-48 overflow-hidden rounded-xl bg-white py-1.5 text-[#111b21] shadow-2xl ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-150"
                    dir="rtl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setShowTopMenu(false);
                        onNewChat();
                      }}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#f0f2f5] active:bg-[#e9edef]"
                    >
                      <Plus size={18} className="text-[#008069]" />
                      شخصية / دردشة جديدة
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setShowTopMenu(false);
                        onTabChange('profile');
                      }}
                      className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#f0f2f5] active:bg-[#e9edef]"
                    >
                      <UserRound size={18} className="text-[#54656f]" />
                      الإعدادات والملف الشخصي
                    </button>
                  </div>
                ) : null}
              </div>
            </header>

            {/* Expandable Search Input (WhatsApp Style) */}
            {showSearch ? (
              <div className="border-b border-gray-200 bg-white px-3 py-2 animate-in slide-in-from-top-2 duration-150">
                <div className="flex h-11 items-center gap-2 rounded-full bg-[#f0f2f5] px-3">
                  <Search size={18} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث في الدردشات..."
                    className="w-full bg-transparent text-[16px] text-[#111b21] outline-none placeholder:text-gray-400"
                    autoFocus
                    dir="auto"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-400 hover:text-gray-600 active:scale-90 transition-transform"
                      aria-label="مسح البحث"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Filter Chips (WhatsApp 2024 Modern Style) */}
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-4 py-2 overflow-x-auto no-scrollbar">
              {([
                ['all', 'الكل'],
                ['unread', 'غير مقروءة'],
                ['bots', 'المرافقين'],
                ['groups', 'المجموعات'],
              ] as const).map(([chip, label]) => {
                const active = activeFilter === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setActiveFilter(chip);
                    }}
                    className={`inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-full px-4 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                      active
                        ? 'bg-[#e7f7ef] text-[#008069] ring-1 ring-[#008069]'
                        : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* WhatsApp Chats List */}
            <div className="momentum-scroll min-h-0 flex-1 overflow-y-auto bg-white">
              {filteredChats.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center px-4 text-center text-gray-400">
                  <p className="text-sm font-medium">لا توجد دردشات مطابقة</p>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onNewChat();
                    }}
                    className="mt-4 flex items-center gap-2 rounded-full bg-[#008069] px-5 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition-transform"
                  >
                    <Plus size={16} />
                    ابدأ دردشة جديدة
                  </button>
                </div>
              ) : (
                filteredChats.map(chat => {
                  const botName = chat.isGroup ? chat.groupName || 'مجموعة' : chat.settings.botName;
                  return (
                    <button
                      type="button"
                      key={chat.id}
                      onClick={() => {
                        triggerHaptic('light');
                        onSelectChat(chat.id);
                      }}
                      className="flex min-h-[72px] w-full items-center gap-3 border-b border-gray-100/80 px-4 py-3 text-right transition-colors active:bg-[#f0f2f5] active:scale-[0.99] touch-squash-subtle"
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          name={botName}
                          gender={chat.settings.botGender}
                          size="lg"
                          imageUrl={chat.settings.avatarUrl}
                          isGroup={chat.isGroup}
                          groupMembersCount={chat.memberIds?.length}
                        />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-center">
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <strong className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#111b21]">
                            {botName}
                          </strong>
                          <time className="shrink-0 text-[11px] font-medium text-[#667781]">
                            {formatTime(chat.lastMessageTimestamp)}
                          </time>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Sent status double ticks */}
                          {!chat.unreadCount && chat.lastMessage ? (
                            <CheckCheck size={16} className="text-[#53bdeb] shrink-0" />
                          ) : null}

                          <span
                            className={`min-w-0 flex-1 truncate text-[13.5px] ${
                              chat.unreadCount ? 'font-semibold text-[#111b21]' : 'text-[#667781]'
                            }`}
                          >
                            {chat.lastMessage || 'ابدأ المحادثة...'}
                          </span>

                          {chat.unreadCount ? (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-bold text-white shadow-xs">
                              {chat.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* WhatsApp Floating Action Button (FAB) */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                onNewChat();
              }}
              className="absolute bottom-[calc(80px+env(safe-area-inset-bottom))] left-5 z-20 grid h-14 w-14 place-items-center rounded-2xl bg-[#008069] text-white shadow-xl transition-transform active:scale-90 hover:scale-105"
              aria-label="دردشة جديدة"
            >
              <MessageSquarePlus size={24} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {activeTab === 'updates' ? <UpdatesTab chats={chats} /> : null}
        {activeTab === 'pwa' ? <PwaToolsTab /> : null}
        {activeTab === 'profile' ? (
          <UserProfileModal inline profile={userProfile} onSave={profile => void onSaveProfile(profile)} />
        ) : null}
      </div>

      {/* Modern WhatsApp 4-Tab Bottom Navigation Bar */}
      <nav
        className="absolute inset-x-0 bottom-0 z-30 flex h-[calc(64px+env(safe-area-inset-bottom))] items-center border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] text-gray-500 shadow-lg"
        aria-label="التنقل الرئيسي"
      >
        {([
          ['chats', 'الدردشات', MessageCircle],
          ['updates', 'المستجدات', RefreshCw],
          ['pwa', 'الأدوات', Download],
          ['profile', 'الملف الشخصي', UserRound],
        ] as const).map(([tab, label, Icon]) => {
          const isActive = activeTab === tab;
          return (
            <button
              type="button"
              key={tab}
              onClick={() => {
                triggerHaptic('selection');
                onTabChange(tab);
              }}
              className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 focus:outline-none"
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${
                  isActive ? 'bg-[#e7f7ef] text-[#008069]' : 'text-gray-500'
                }`}
              >
                <Icon size={21} aria-hidden="true" />
              </div>
              <span
                className={`text-[11px] font-bold transition-colors ${
                  isActive ? 'text-[#008069]' : 'text-gray-500'
                }`}
              >
                {label}
              </span>

              {tab === 'chats' && totalUnread > 0 ? (
                <span className="absolute right-[calc(50%-22px)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#25D366] px-1 text-[9px] font-bold text-white">
                  {totalUnread}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MobileNavigationPane;
