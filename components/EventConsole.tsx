
import React, { useEffect, useState, useRef } from 'react';
import { eventBus, SmartEvent, RafiqEventMap } from '../services/eventBus.js';
import { Terminal, X, Minimize2, Maximize2, Trash2, Activity } from 'lucide-react';

const EventConsole: React.FC = () => {
  const [logs, setLogs] = useState<SmartEvent<keyof RafiqEventMap>[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sub = eventBus.observe.subscribe((event) => {
      setLogs((prev) => [...prev.slice(-49), event]); // Keep last 50 events
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-neutral-900 text-green-400 p-3 rounded-full shadow-lg hover:scale-110 transition-transform border border-green-900/50"
        title="Rafiq Event Bus Console"
      >
        <Activity size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[400px] h-[300px] bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl flex flex-col font-mono text-xs overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
      
      {/* Header */}
      <div className="bg-neutral-900 p-2 flex justify-between items-center border-b border-neutral-800">
        <div className="flex items-center gap-2 text-green-500 font-bold">
          <Terminal size={14} />
          <span>Rafiq Event Bus</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-400">
          <button onClick={() => setLogs([])} className="hover:text-red-400" title="Clear"><Trash2 size={14} /></button>
          <button onClick={() => setIsOpen(false)} className="hover:text-white" title="Minimize"><Minimize2 size={14} /></button>
        </div>
      </div>

      {/* Logs */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 bg-black/50 backdrop-blur-sm">
        {logs.length === 0 && (
            <div className="text-neutral-600 text-center mt-10 italic">Waiting for events...</div>
        )}
        {logs.map((log) => (
          <div key={log._meta.id} className="group border-l-2 border-transparent hover:border-green-500 pl-2 py-1 transition-all">
            <div className="flex justify-between text-[10px] text-neutral-500 mb-0.5">
                <span>{new Date(log._meta.timestamp).toLocaleTimeString()}</span>
                <span className="opacity-50">{log._meta.source}</span>
            </div>
            <div className="flex gap-2">
                <span className={`font-bold ${getEventColor(log.name)}`}>{log.name}</span>
            </div>
            <div className="text-neutral-400 truncate opacity-70 group-hover:opacity-100 group-hover:whitespace-pre-wrap group-hover:break-words">
                {JSON.stringify(log.payload)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const getEventColor = (name: string) => {
    if (name.startsWith('system:error')) return 'text-red-500';
    if (name.startsWith('chat:')) return 'text-blue-400';
    if (name.startsWith('ai:')) return 'text-purple-400';
    if (name.startsWith('persona:')) return 'text-amber-400';
    if (name.startsWith('ui:')) return 'text-pink-400';
    return 'text-white';
}

export default EventConsole;
