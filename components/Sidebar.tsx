
import React, { useRef } from 'react';
import { AlertCircle, CheckCircle2, FolderInput, Loader2, MessageSquarePlus, MoreVertical, Pencil, Search, Trash2, Users, CircleDashed } from 'lucide-react';
import { ChatSession, UserProfile } from '../types.js';
import Avatar from './Avatar.js';
import { eventBus } from '../services/eventBus.js';



interface SidebarProps {
  userProfile: UserProfile | null;
  chats: ChatSession[];
  activeChatId: string | null;
  isTyping: boolean;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onEditChat: (chat: ChatSession) => void;
  onOpenProfile: () => void;
  onNewChat: () => void;
  onImportChat: (file: File) => void;
}



const Sidebar: React.FC<SidebarProps> = ({
  userProfile,
  chats,
  activeChatId,
  isTyping,
  onSelectChat,
  onDeleteChat,
  onEditChat,
  onOpenProfile,
  onNewChat,
  onImportChat
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleComingSoon = (feature: string) => {
      eventBus.emit('ui:toast', { message: `قريباً: ${feature}`, type: 'info' });
  };

  const handleMenuClick = () => {
      // Mock menu action
      eventBus.emit('ui:toast', { message: 'الإعدادات والخيارات (قريباً)', type: 'info' });
  }

  return (
    <div className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] flex-col border-r border-gray-200 bg-white z-20 h-full shrink-0`}>
       
       {/* WhatsApp Header */}
       <div className="h-[60px] bg-[#f0f2f5] px-4 flex items-center justify-between shrink-0 border-r border-gray-300">
          <div 
             className="cursor-pointer"
             onClick={onOpenProfile}
             title="ملفك الشخصي"
          >
             {/* User Avatar */}
             <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden border border-gray-200">
                {userProfile ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-xl">
                        {userProfile.gender === 'male' ? '🧔🏻‍♂️' : '👩🏻‍🦱'}
                    </div>
                ) : (
                    <div className="w-full h-full bg-gray-400" />
                )}
             </div>
          </div>
          
          <div className="flex items-center gap-5 text-[#54656f]">
              <button onClick={() => handleComingSoon('المجتمعات')} title="Communities"><Users size={22} /></button>
              <button onClick={() => handleComingSoon('الحالات (Status)')} title="Status"><CircleDashed size={22} /></button>
              <button onClick={onNewChat} title="New Chat"><MessageSquarePlus size={22} /></button>
              <button onClick={() => importInputRef.current?.click()} title="استيراد محادثة"><FolderInput size={22} /></button>
              <button onClick={handleMenuClick} title="Menu"><MoreVertical size={22} /></button>
              <input
                type="file"
                ref={importInputRef}
                className="hidden"
                accept=".rafiq,.json"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    onImportChat(e.target.files[0]);
                    e.target.value = ''; // Reset so same file can be re-imported
                  }
                }}
              />
          </div>
       </div>

       {/* Search Bar */}
       <div className="p-2 border-b border-gray-100 bg-white shrink-0">
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-500" />
             </div>
             <input 
               placeholder="بحث أو بدء محادثة جديدة" 
               className="w-full bg-[#f0f2f5] text-sm rounded-lg py-2 pl-10 pr-4 focus:outline-none text-right font-sans placeholder:text-gray-500 h-9" 
               dir="rtl" 
             />
          </div>
       </div>

       <div className="flex-1 overflow-y-auto bg-white custom-scrollbar min-h-0">
          {chats.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm mt-10">
                <p>لا توجد دردشات</p>
             </div>
          ) : (
            chats.map(chat => (
                <div 
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors relative border-b border-gray-100 group ${activeChatId === chat.id ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'}`}
                >
                <Avatar 
                    name={chat.isGroup ? chat.groupName! : chat.settings.botName} 
                    gender={chat.settings.botGender} 
                    size="lg" 
                    imageUrl={chat.settings.avatarUrl} 
                    isGroup={chat.isGroup}
                    groupMembersCount={chat.memberIds?.length}
                />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-[11px] text-gray-500 shrink-0 ml-2">
                            {chat.lastMessageTimestamp && new Date(chat.lastMessageTimestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                        <h3 className="text-[16px] leading-tight truncate text-right font-normal text-[#111b21] flex-1">
                            {chat.isGroup ? chat.groupName : chat.settings.botName}
                        </h3>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                        {chat.unreadCount ? (
                            <div className="bg-[#25D366] text-white text-[10px] font-bold h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center shadow-sm order-first shrink-0">
                                {chat.unreadCount}
                            </div>
                        ) : null}
                        <span className={`truncate flex-1 text-right text-[13px] ${chat.unreadCount ? 'text-[#111b21] font-medium' : 'text-gray-500'}`}>
                            {chat.id === activeChatId && isTyping ? <span className="text-[#25D366]">يكتب...</span> : (chat.lastMessage || '...')}
                        </span>
                    </div>
                </div>
                
                {/* Edit Button - Visible on Group Hover */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onEditChat(chat); }}
                    className="absolute top-1/2 -translate-y-1/2 left-14 p-2 bg-white/80 rounded-full shadow-sm text-gray-500 opacity-0 group-hover:opacity-100 hover:text-wa-teal hover:bg-white transition-all z-10"
                    title="تعديل"
                >
                    <Pencil size={14} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                    className="absolute top-1/2 -translate-y-1/2 left-3 p-2 bg-white/80 rounded-full shadow-sm text-gray-500 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-white transition-all z-10"
                    title="حذف الدردشة"
                >
                    <Trash2 size={14} />
                </button>
                </div>
            ))
          )}
       </div>
    </div>
  );
};

export default Sidebar;
