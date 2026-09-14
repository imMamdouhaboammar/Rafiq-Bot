import React, { useEffect, useMemo, useState } from 'react';
import { Bot, ChevronDown, MessageCircleMore } from 'lucide-react';
import { useRafiqStore } from '../stores/useRafiqStore.js';
import SocialAgencySettings from './SocialAgencySettings.js';

const SocialAgencyControlsPanel: React.FC = () => {
  const chats = useRafiqStore(state => state.chats);
  const bots = useMemo(() => chats.filter(chat => !chat.isGroup), [chats]);
  const [selectedBotId, setSelectedBotId] = useState('');

  useEffect(() => {
    if (!selectedBotId && bots[0]) setSelectedBotId(bots[0].id);
    if (selectedBotId && !bots.some(bot => bot.id === selectedBotId)) {
      setSelectedBotId(bots[0]?.id || '');
    }
  }, [bots, selectedBotId]);

  if (bots.length === 0) {
    return (
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm" aria-labelledby="social-agency-controls-title">
        <h2 id="social-agency-controls-title" className="flex items-center gap-2 text-base font-bold text-gray-800">
          <MessageCircleMore size={19} className="text-wa-teal" aria-hidden="true" />
          حضور البوت ومبادرته
        </h2>
        <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <Bot size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="mt-2 text-sm font-bold text-gray-700">لا يوجد بوت لضبط حضوره</p>
          <p className="mt-1 text-xs text-gray-500">أنشئ بوتًا أولًا ثم ارجع إلى هذه الشاشة</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="social-agency-controls-title">
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="social-agency-controls-title" className="flex items-center gap-2 text-base font-bold text-gray-800">
              <MessageCircleMore size={19} className="text-wa-teal" aria-hidden="true" />
              حضور البوت ومبادرته
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-gray-500">
              اضبط الجرأة والمبادرة وحدود الرسائل غير المطلوبة لكل بوت بصورة مستقلة
            </p>
          </div>
          <label className="relative block min-w-48">
            <span className="sr-only">اختار البوت</span>
            <select
              value={selectedBotId}
              onChange={event => setSelectedBotId(event.target.value)}
              className="min-h-11 w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3 pl-10 text-sm font-bold text-gray-800 outline-none focus:border-wa-teal"
            >
              {bots.map(bot => (
                <option key={bot.id} value={bot.id}>{bot.settings.botName}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
          </label>
        </div>
      </div>

      <SocialAgencySettings key={selectedBotId} botId={selectedBotId} />
    </section>
  );
};

export default SocialAgencyControlsPanel;
