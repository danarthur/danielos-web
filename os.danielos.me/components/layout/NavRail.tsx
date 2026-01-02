'use client';
import { Home, Terminal, Settings, Sparkles } from 'lucide-react';

export function NavRail() {
  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 h-96 w-16 bg-stone-900/40 backdrop-blur-xl border border-white/5 rounded-full flex flex-col items-center justify-between py-8 z-50">
      <div className="space-y-8 flex flex-col items-center">
        <button className="p-3 rounded-full bg-stone-800 text-stone-200 hover:scale-110 transition-all shadow-lg shadow-stone-900/50">
          <Home size={20} />
        </button>
        <button className="p-3 rounded-full text-stone-500 hover:text-stone-200 hover:bg-white/5 transition-all">
          <Sparkles size={20} />
        </button>
        <button className="p-3 rounded-full text-stone-500 hover:text-stone-200 hover:bg-white/5 transition-all">
          <Terminal size={20} />
        </button>
      </div>
      <button className="p-3 rounded-full text-stone-600 hover:text-stone-300 transition-all">
        <Settings size={20} />
      </button>
    </div>
  );
}
