import React from 'react';

const renderInline = (text: string): React.ReactNode[] => {
  if (!text) return [];
  const tokenPattern = /(\*\*.*?\*\*|__.*?__|~~.*?~~|`.*?`|\[.*?\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>(),;"'\s]+)/g;

  return text.split(tokenPattern).map((part, index) => {
    if (!part) return null;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={index} className="font-bold">{renderInline(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <span key={index} className="line-through">{renderInline(part.slice(2, -2))}</span>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="break-all rounded border border-black/5 bg-black/5 px-1 py-0.5 font-mono text-[13px] font-semibold text-[#d91460]">
          {part.slice(1, -1)}
        </code>
      );
    }

    const markdownLink = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (markdownLink) {
      return (
        <a
          key={index}
          href={markdownLink[2]}
          target="_blank"
          rel="noreferrer noopener"
          className="break-all font-semibold text-[#027eb5] underline hover:text-[#025d85]"
          dir="ltr"
        >
          {markdownLink[1]}
        </a>
      );
    }

    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer noopener"
          className="break-all text-[#027eb5] underline hover:text-[#025d85]"
          dir="ltr"
        >
          {part}
        </a>
      );
    }

    const italicPattern = /(\*.*?\*|_.*?_)/g;
    const segments = part.split(italicPattern);
    if (segments.length > 1) {
      return (
        <span key={index}>
          {segments.map((segment, segmentIndex) => (
            (segment.startsWith('*') && segment.endsWith('*')) || (segment.startsWith('_') && segment.endsWith('_'))
              ? <em key={segmentIndex} className="italic">{segment.slice(1, -1)}</em>
              : segment
          ))}
        </span>
      );
    }

    return part;
  });
};

const MessageMarkdown: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith('```')) {
      const language = line.trim().match(/^```(\w*)/)?.[1] || 'code';
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const code = codeLines.join('\n');
      elements.push(
        <div key={`code-${index}`} className="relative my-2 w-full overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-[12.5px] text-slate-100 shadow-inner" dir="ltr">
          <div className="mb-1 flex select-none items-center justify-between border-b border-slate-800/60 pb-1 font-sans text-[10px] uppercase tracking-wider text-slate-400">
            <span>{language}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(code).catch(() => undefined)}
              className="min-h-8 rounded bg-slate-800 px-2 text-[10px] hover:bg-slate-700 hover:text-white"
              aria-label="نسخ الكود"
            >
              نسخ
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre leading-relaxed"><code>{code}</code></pre>
        </div>,
      );
      continue;
    }

    if (/^(---|\*\*\*|___)$/.test(line.trim())) {
      elements.push(<hr key={`hr-${index}`} className="my-2.5 w-full border-t border-black/10" />);
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const classes = level === 1
        ? 'mt-2.5 mb-1.5 border-b border-black/5 pb-1 text-[16px]'
        : level === 2
          ? 'mt-2 mb-1 text-[15.5px]'
          : 'mt-1.5 mb-1 text-[14.8px]';
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      elements.push(<Tag key={`h-${index}`} className={`${classes} font-bold text-[#111b21]`}>{renderInline(heading[2])}</Tag>);
      index += 1;
      continue;
    }

    if (line.startsWith('>')) {
      elements.push(
        <blockquote key={`quote-${index}`} className="my-2 w-full rounded-l border-r-4 border-wa-blue/45 bg-black/5 py-1 pl-1 pr-2.5 text-[13.8px] italic text-gray-600">
          {renderInline(line.startsWith('> ') ? line.slice(2) : line.slice(1))}
        </blockquote>,
      );
      index += 1;
      continue;
    }

    if (/^[-*•]\s/.test(line)) {
      elements.push(
        <div key={`bullet-${index}`} className="my-1 flex items-start gap-1.5 pr-1">
          <span className="mt-1.5 select-none text-[8px] text-wa-blue">•</span>
          <div className="flex-1 text-[14px] leading-relaxed text-[#111b21]">{renderInline(line.slice(2))}</div>
        </div>,
      );
      index += 1;
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s(.*)/);
    if (numbered) {
      elements.push(
        <div key={`number-${index}`} className="my-1 flex items-start gap-1.5 pr-1">
          <span className="mt-0.5 select-none text-[12.5px] font-bold text-wa-blue">{numbered[1]}.</span>
          <div className="flex-1 text-[14px] leading-relaxed text-[#111b21]">{renderInline(numbered[2])}</div>
        </div>,
      );
      index += 1;
      continue;
    }

    elements.push(line.trim()
      ? <div key={`line-${index}`} className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px] text-[#111b21]">{renderInline(line)}</div>
      : <div key={`space-${index}`} className="h-2" />);
    index += 1;
  }

  return <div className="flex w-full flex-col gap-1">{elements}</div>;
};

export default React.memo(MessageMarkdown);
