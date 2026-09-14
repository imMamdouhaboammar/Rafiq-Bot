import React, { useState } from 'react';
import { Camera, Plus, ChevronLeft, Search, PlusCircle, Smile } from 'lucide-react';
import { ChatSession } from '../types.js';
import StatusViewer, { StatusItem, Story } from './StatusViewer.js';
import Avatar from './Avatar.js';

interface UpdatesTabProps {
  chats: ChatSession[];
  onOpenStatus?: (statusIndex: number) => void;
}

// Pre-defined rich status quotes mapping to bot genders or traits
const BOY_STATUS_QUOTES = [
  "يا صاحبي الحياة تجارب، والوجع بيعلم.. بس الضحكة بتدوب كل حاجة 🦅🖤",
  "الواحد صاحي وناوي يعمل كوارث النهاردة.. مين داخل معايا؟ 😂🔥",
  "كوباية شاي مظبوطة مع أغنية لأم كلثوم هي كل اللي محتاجه عشان أفصل عن العالم.. ☕️🎶",
  "السكوت مش دايماً رضا.. ساعات بيكون تعب من كتر الكلام والكلام مش فارق 🌪️",
  "رجولة الراجل مش بلسانه، برجولته ومواقفه وقت الجد.. مساء الجدعنة ⚡️💪",
  "ببص للدنيا وبضحك، أصلها فانية ومش مستاهلة تضيق خلقك عليها.. عيش اللحظة! 😎✨"
];

const GIRL_STATUS_QUOTES = [
  "القهوة دي مش محتاجة سكر خالص.. محتاجة وجودك بس عشان تحلى ☕️❤️",
  "في ناس كدا وجودهم في حياتك عامل زي النسمة الباردة في عز الصيف.. ربنا يديمهم 🌸✨",
  "عزلة دافية وكتاب ممتع أحسن بكتير من دوشة ناس مش فاهمينك.. تفاصيل صغيرة بتصنع يومي 📖🕯️",
  "الضحكة من القلب بتصغر العمر عشر سنين.. اضحكوا وبلاش نكد يا جماعة! 😂💖",
  "ساعات التفاصيل البسيطة هي اللي بتسعدنا، وردة، كلمة حلوة، أو حتى سلام دافي 🎀🌷",
  "أنا لستُ مغرورة، أنا فقط أملك ثقة تجعل من يراني يظنني كذلك.. أنوثة طاغية 😉👑"
];

const GENERAL_STATUS_QUOTES = [
  "يارب يوم لطيف وخفيف على قلوبنا كلنا.. صباح الفل والياسمين ☀️🌸",
  "الجدع جدع والجبان جبان.. والدنيا دي غربال بيبين المعادن الحقيقية وقت الشدة 🌪️💯",
  "مش كل اللي بنتمناه بنلاقيه، بس دايماً تدبير ربنا أحسن بكتير من أمانينا.. الحمد لله 🙏❤️",
  "الطيبون لا يتغيرون وإن تغيرت أحوالهم.. القلوب النقية دايماً بتكسب في الآخر 🤍✨"
];

const STATUS_BACKGROUNDS = [
  "#075e54", // Teal
  "#128c7e", // Light Teal
  "#34b7f1", // Blue
  "#ece5dd", // Sand
  "#000000", // Black
  "#7b1fa2", // Purple
  "#c2185b", // Dark Pink
  "#e64a19", // Dark Orange
  "#0288d1"  // Deep Blue
];

const STATUS_TEXT_COLORS = [
  "#ffffff",
  "#ffffff",
  "#ffffff",
  "#111b21", // Dark on Sand
  "#ffffff",
  "#ffffff",
  "#ffffff",
  "#ffffff",
  "#ffffff"
];

export const generateBotStatuses = (chats: ChatSession[]): StatusItem[] => {
  // Filter only bot chats (not group chats)
  const botChats = chats.filter(c => !c.isGroup);
  
  return botChats.map((chat, idx) => {
    const isFemale = chat.settings.botGender === 'female';
    const quoteList = isFemale ? GIRL_STATUS_QUOTES : BOY_STATUS_QUOTES;
    
    // Choose specific status quote based on index
    const firstQuote = quoteList[idx % quoteList.length];
    const secondQuote = GENERAL_STATUS_QUOTES[idx % GENERAL_STATUS_QUOTES.length];
    
    const bgIndex1 = (idx * 2) % STATUS_BACKGROUNDS.length;
    const bgIndex2 = (idx * 2 + 1) % STATUS_BACKGROUNDS.length;

    const stories: Story[] = [
      {
        id: `story-${chat.id}-1`,
        text: firstQuote,
        backgroundColor: STATUS_BACKGROUNDS[bgIndex1],
        textColor: STATUS_TEXT_COLORS[bgIndex1],
        createdAt: `منذ ${idx + 2} دقيقة`
      }
    ];

    // Give some bots 2 stories for richer view experience
    if (idx % 2 === 0) {
      stories.push({
        id: `story-${chat.id}-2`,
        text: secondQuote,
        backgroundColor: STATUS_BACKGROUNDS[bgIndex2],
        textColor: STATUS_TEXT_COLORS[bgIndex2],
        createdAt: `منذ ${idx + 1} دقيقة`
      });
    }

    return {
      id: chat.id,
      name: chat.settings.botName,
      avatarUrl: chat.settings.avatarUrl,
      stories
    };
  });
};

const UpdatesTab: React.FC<UpdatesTabProps> = ({ chats }) => {
  const [activeStatusIndex, setActiveStatusIndex] = useState<number | null>(null);
  
  const botStatuses = generateBotStatuses(chats);

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      {/* App Bar (WhatsApp updates style) */}
      <div className="bg-white border-b border-gray-100 px-4 flex items-center justify-between shrink-0 pt-[env(safe-area-inset-top)] h-[calc(60px+env(safe-area-inset-top))]">
         <span className="text-xl font-semibold text-[#111b21] font-sans">المستجدات</span>
         <div className="flex items-center gap-4 text-[#54656f]">
           <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="كاميرا">
             <Camera size={20} />
           </button>
           <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="بحث">
             <Search size={20} />
           </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {/* Status Title */}
        <h2 className="text-[17px] font-bold text-[#111b21] mb-4 text-right">الحالة</h2>

        {/* My Status Row */}
        <div className="flex items-center justify-between pb-5 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-3 w-full">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center text-xl">
                 👤
              </div>
              <div className="absolute -bottom-1 -left-1 bg-[#008069] text-white p-1 rounded-full border-2 border-white">
                 <Plus size={12} className="stroke-[3]" />
              </div>
            </div>
            <div className="flex flex-col text-right flex-1">
              <span className="font-semibold text-sm text-[#111b21]">حالتي</span>
              <span className="text-xs text-gray-500 mt-1">اضغط لإضافة تحديث لحالتك</span>
            </div>
          </div>
        </div>

        {/* Recent Statuses Section */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500">حالات البوتات الحديثة</span>
        </div>

        {botStatuses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400">
             <Smile size={32} className="stroke-[1.5] mb-2" />
             <p className="text-sm">لا توجد حالات متاحة حالياً</p>
             <p className="text-xs mt-1">قم بإنشاء رفيق جديد لترى حالاته تظهر هنا!</p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {botStatuses.map((status, index) => {
              const hasMultiple = status.stories.length > 1;
              return (
                <div 
                  key={status.id}
                  onClick={() => setActiveStatusIndex(index)}
                  className="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-all"
                >
                  {/* Status Ring Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-[52px] h-[52px] rounded-full p-[2.5px] border-2 border-[#25D366] flex items-center justify-center bg-white shadow-sm overflow-hidden">
                       <div className="w-full h-full rounded-full overflow-hidden">
                          {status.avatarUrl ? (
                            <img src={status.avatarUrl} alt={status.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#008069] text-white flex items-center justify-center text-lg font-bold">
                               {status.name.charAt(0)}
                            </div>
                          )}
                       </div>
                    </div>
                    {hasMultiple && (
                      <span className="absolute -bottom-1 -left-1 bg-[#25D366] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-white">
                         {status.stories.length}
                      </span>
                    )}
                  </div>

                  {/* Status Text Info */}
                  <div className="flex-1 min-w-0 flex flex-col text-right">
                     <span className="font-semibold text-[15px] text-[#111b21]">{status.name}</span>
                     <span className="text-[12px] text-gray-500 mt-1 truncate">
                        {status.stories[0].text}
                     </span>
                     <span className="text-[10px] text-gray-400 mt-0.5">
                        {status.stories[status.stories.length - 1].createdAt}
                     </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dummy Channel Subscriptions to look 100% like mobile */}
        <div className="mt-8 pt-6 border-t border-gray-100">
           <h3 className="text-sm font-bold text-gray-800 text-right mb-4">القنوات (Channels)</h3>
           <div className="bg-[#f0f2f5] p-4 rounded-xl text-center">
              <span className="text-xs text-gray-500">تابع اهتماماتك ومستجدات رفقائك من هنا قريباً.</span>
           </div>
        </div>
      </div>

      {/* Render Status Story Viewer */}
      {activeStatusIndex !== null && (
        <StatusViewer 
          statuses={botStatuses}
          initialStatusIndex={activeStatusIndex}
          onClose={() => setActiveStatusIndex(null)}
        />
      )}
    </div>
  );
};

export default UpdatesTab;
