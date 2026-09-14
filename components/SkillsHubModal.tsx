import React, { useState, useEffect } from 'react';
import { X, Sparkles, Check, Power, Terminal, BookOpen, ShieldCheck, Zap } from 'lucide-react';
import {
  BUILTIN_SKILLS,
  getInstalledSkills,
  toggleSkill,
} from '../services/skillRegistry.js';
import type { SkillCategory, SkillDefinition, InstalledSkillRecord } from '../types.js';

interface SkillsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSlashCommand?: (cmd: string) => void;
}

export const SkillsHubModal: React.FC<SkillsHubModalProps> = ({
  isOpen,
  onClose,
  onSelectSlashCommand,
}) => {
  const [installedMap, setInstalledMap] = useState<Record<string, InstalledSkillRecord>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  const loadInstalled = async () => {
    try {
      const records = await getInstalledSkills();
      const map: Record<string, InstalledSkillRecord> = {};
      records.forEach(rec => {
        map[rec.skillId] = rec;
      });
      setInstalledMap(map);
    } catch (err) {
      console.warn('[SkillsHubModal] Failed to load skills:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadInstalled();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'lifestyle', label: 'جيم وصحة' },
    { id: 'emotional', label: 'فضفضة ومشاعر' },
  ];

  const filteredSkills = BUILTIN_SKILLS.filter(s => {
    if (selectedCategory === 'all') return true;
    return s.category === selectedCategory;
  });

  const handleToggle = async (skillId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const nextState = await toggleSkill(skillId);
    setInstalledMap(prev => ({
      ...prev,
      [skillId]: {
        ...(prev[skillId] || {
          skillId,
          installedAt: new Date(),
          priority: 5,
          pinnedInChat: true,
          activationCount: 0,
        }),
        isEnabled: nextState,
      },
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#f0f2f5] text-[#111b21] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-[#008069] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/20">
              <Sparkles size={22} className="text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold">شطارات ومهارات رفيق (Skills Hub)</h2>
              <p className="text-xs text-white/80">
                زوّد رفيق بتخصصات وأدوار حياتية مع الحفاظ على روحه ولهجته المصرية
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/20 hover:text-white"
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 border-b border-[#e9edef] bg-white px-6 py-3">
          {categories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-[#008069] text-white'
                  : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Skills List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredSkills.map(skill => {
            const isEnabled = installedMap[skill.id]?.isEnabled ?? skill.isDefaultInstalled ?? true;
            const isExpanded = expandedSkillId === skill.id;

            return (
              <div
                key={skill.id}
                className="overflow-hidden rounded-xl border border-[#e9edef] bg-white shadow-sm transition-all hover:border-[#008069]/40"
              >
                <div
                  className="flex cursor-pointer items-start justify-between p-4"
                  onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
                >
                  <div className="flex items-start gap-3.5">
                    <span className="text-3xl select-none">{skill.icon}</span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#111b21]">{skill.name}</h3>
                        <span className="rounded bg-[#e7f7ef] px-2 py-0.5 text-[10px] font-semibold text-[#008069]">
                          {skill.englishName}
                        </span>
                      </div>
                      <p className="text-xs text-[#54656f] leading-relaxed max-w-md">
                        {skill.description}
                      </p>

                      {/* Triggers Bar */}
                      <div className="pt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#667781]">
                        <span className="font-medium text-[#111b21]">أوامر سريعة:</span>
                        {skill.triggers.slashCommand && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectSlashCommand && skill.triggers.slashCommand) {
                                onSelectSlashCommand(skill.triggers.slashCommand);
                                onClose();
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded bg-[#f0f2f5] px-2 py-0.5 font-mono text-[#008069] hover:bg-[#e7f7ef]"
                          >
                            <Terminal size={10} />
                            {skill.triggers.slashCommand}
                          </button>
                        )}
                        {skill.triggers.arabicSlashAlias && (
                          <span className="inline-flex items-center gap-1 rounded bg-[#f0f2f5] px-2 py-0.5 text-[#008069]">
                            {skill.triggers.arabicSlashAlias}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <div className="flex flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleToggle(skill.id, e)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        isEnabled
                          ? 'bg-[#008069] text-white hover:bg-[#00705b]'
                          : 'bg-[#e9edef] text-[#54656f] hover:bg-[#d1d7db]'
                      }`}
                    >
                      <Power size={13} />
                      {isEnabled ? 'مفعل' : 'معطل'}
                    </button>
                    <span className="text-[11px] text-[#8696a0] hover:underline">
                      {isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-[#f0f2f5] bg-[#fafafa] p-4 space-y-3 text-xs">
                    {/* Tone & Instructions */}
                    <div>
                      <span className="font-bold text-[#111b21] block mb-1">
                        طبيعة الأسلوب وتعديل النبرة:
                      </span>
                      <p className="text-[#54656f] bg-white p-2.5 rounded-lg border border-[#e9edef]">
                        {skill.behavior.toneModifier}
                      </p>
                    </div>

                    {/* Sample Dialogue */}
                    {skill.behavior.sampleTurn && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-[#111b21] block">مثال من واقع الشات:</span>
                        <div className="rounded-lg bg-white p-3 border border-[#e9edef] space-y-2">
                          <div className="flex gap-2">
                            <span className="font-bold text-[#54656f] shrink-0">أنت:</span>
                            <span className="text-[#111b21]">{skill.behavior.sampleTurn.user}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="font-bold text-[#008069] shrink-0">رفيق:</span>
                            <span className="text-[#111b21]">{skill.behavior.sampleTurn.bot}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Keywords */}
                    <div>
                      <span className="font-bold text-[#111b21] block mb-1">
                        كلمات مفتاحية تنشط المهارة تلقائياً:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {skill.triggers.keywords.map(kw => (
                          <span
                            key={kw}
                            className="rounded bg-white px-2 py-0.5 text-[11px] text-[#54656f] border border-[#e9edef]"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="border-t border-[#e9edef] bg-white px-6 py-3 flex items-center justify-between text-xs text-[#54656f]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#008069]" />
            <span>
              <strong>ضمان كفاءة التوكنز:</strong> المهارات تعمل بنظام Zero-Cost Idle، ولا تستهلك أي توكنز إضافية في الشات اليومي العادي.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#008069] px-4 py-1.5 font-bold text-white hover:bg-[#00705b]"
          >
            تم
          </button>
        </div>
      </div>
    </div>
  );
};
