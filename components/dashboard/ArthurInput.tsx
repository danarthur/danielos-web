'use client';

import { ChangeEvent, FormEvent, useEffect, useRef } from 'react';

interface ArthurInputProps {
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function ArthurInput({ input, handleInputChange, handleSubmit, isLoading }: ArthurInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus(); // Auto-focus on mount
  }, []);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
      <form onSubmit={handleSubmit} className="relative group">
        {/* Ambient Glow */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-stone-700 to-stone-900 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        
        <div className="relative flex items-center bg-[#0a0a0a]/90 backdrop-blur-xl border border-stone-800/50 rounded-lg overflow-hidden shadow-2xl">
           {/* Status Bar */}
          <div className={`w-1 h-12 transition-colors duration-500 ${isLoading ? 'bg-amber-500/80 animate-pulse' : 'bg-stone-800'}`} />
          
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask Arthur..."
            className="w-full bg-transparent text-stone-200 placeholder-stone-600 px-6 py-4 outline-none font-light tracking-wide text-sm"
            disabled={isLoading}
          />
          
          <button 
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 text-stone-500 hover:text-stone-300 disabled:opacity-30 transition-colors uppercase text-[10px] tracking-widest font-mono"
          >
            {isLoading ? 'PROCESSING' : 'SEND'}
          </button>
        </div>
      </form>
    </div>
  );
}

