'use client';
import { useEffect, useRef } from 'react';

// Define strict type locally to avoid import errors
type Message = {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'data';
  content: string;
};

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto overflow-y-auto px-4 py-6 scrollbar-hide space-y-8">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full opacity-30">
            <div className="w-16 h-16 border border-stone-700 rounded-full flex items-center justify-center mb-4">
                <div className="w-2 h-2 bg-stone-500 rounded-full animate-ping" />
            </div>
            <p className="text-xs tracking-[0.2em] font-light">SYSTEM READY</p>
        </div>
      )}

      {messages.map((m) => (
        <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
          <div className={`max-w-[85%] ${m.role === 'user' ? 'bg-stone-800/50 border border-stone-700/50 text-stone-100 rounded-2xl rounded-tr-sm px-6 py-4' : 'text-stone-300 pl-4'}`}>
            {m.role === 'assistant' && (
              <span className="text-[10px] text-amber-500/50 font-mono tracking-widest uppercase mb-2 block">Arthur</span>
            )}
            <div className="text-sm font-light leading-relaxed whitespace-pre-wrap">{m.content}</div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} className="h-32" /> {/* Spacer for input bar */}
    </div>
  );
}
