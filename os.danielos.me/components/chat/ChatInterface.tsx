import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, ArrowUp, Hash } from 'lucide-react';

// Types
type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
};

interface ChatInterfaceProps {
  viewState: 'overview' | 'chat';
  onInteraction: () => void; // Callback to tell parent "Switch to Chat Mode"
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ viewState, onInteraction }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: "Session context initialized.", timestamp: '09:41' }
  ]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    onInteraction(); // Trigger layout morph in parent

    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setTimeout(() => {
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: "I have processed your request. The modular architecture is now active.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);
    }, 1200);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (viewState === 'chat') {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, viewState]);

  return (
    <>
      {/* CHAT STREAM PANEL */}
      <div className={`
        flex flex-col min-w-0 h-full relative overflow-hidden
        transition-all duration-700 ease-in-out
        ${viewState === 'overview' ? 'flex-[0_0_0] opacity-0' : 'flex-[1_1_auto] opacity-100'}
      `}>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-12 py-6 scroll-smooth scrollbar-thin scrollbar-thumb-white/10">
          <div className="max-w-3xl mx-auto flex flex-col min-h-full pb-32">
            
            {/* Session Header */}
            <div className="flex flex-col items-center justify-center py-12 opacity-60 select-none">
              <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-4">
                <Hash size={16} className="text-stone-300" />
              </div>
              <h1 className="font-sans text-lg font-medium text-stone-200 tracking-tight">System Optimization</h1>
              <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mt-8" />
            </div>

            {/* Messages */}
            <div className="flex flex-col justify-end gap-8">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`flex flex-col gap-1.5 group ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className={`font-mono text-[9px] tracking-[0.1em] uppercase ${isUser ? 'text-stone-400' : 'text-stone-500'}`}>
                        {isUser ? 'Daniel' : 'Arthur'}
                      </span>
                      <span className="font-mono text-[9px] text-stone-600">{msg.timestamp}</span>
                    </div>
                    <div className={`
                      max-w-[85%] text-[15px] leading-relaxed font-light
                      ${isUser ? 'text-stone-100 text-right drop-shadow-md' : 'text-stone-400 text-left'}
                    `}>
                      {msg.content.split('\n').map((line, idx) => (
                        <p key={idx} className="mb-2 last:mb-0">{line}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex flex-col gap-2 items-start opacity-40">
                  <span className="font-mono text-[10px] text-stone-500">ARTHUR</span>
                  <div className="text-xs text-stone-600 italic">Thinking...</div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </div>
        </div>
      </div>

      {/* GLOBAL INPUT DOCK */}
      <div className={`
        absolute bottom-0 left-0 right-0 z-50 p-6 md:p-12 pointer-events-none 
        transition-all duration-700 ease-in-out
        ${viewState === 'overview' ? 'pl-0' : 'pl-0 md:pl-80'} 
      `}>
        <div className="w-full h-full flex justify-center items-end">
          <div className="w-full max-w-3xl pointer-events-auto">
            <div className="relative group flex items-end gap-2 p-2.5 rounded-[1.25rem] bg-stone-900/80 backdrop-blur-xl border border-white/[0.05] shadow-2xl hover:border-white/10 transition-all">
              <button type="button" className="p-2.5 rounded-full text-stone-500 hover:text-stone-200 transition-colors">
                <Sparkles size={16} strokeWidth={1.5} />
              </button>
              <textarea 
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }} 
                onKeyDown={onKeyDown}
                placeholder={viewState === 'overview' ? "Initialize system..." : "Direct the system..."}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none text-stone-200 placeholder:text-stone-600 text-[15px] font-light py-2.5 px-1 resize-none min-h-[44px] max-h-[160px]"
                disabled={isLoading}
              />
              <button 
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className={`
                  p-2.5 rounded-full transition-all duration-300
                  ${input.trim() && !isLoading
                    ? 'text-stone-200 bg-white/5 hover:bg-white/10' 
                    : 'text-stone-700 opacity-50 cursor-not-allowed'}
                `}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-stone-400/30 border-t-stone-200 rounded-full animate-spin" />
                ) : (
                  <ArrowUp size={18} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

