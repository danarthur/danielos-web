/**
 * DANIELOS - RUNTIME v19.0 (SILKY SMOOTH)
 * * Animation: Tuned to 'ease-in-out' (No bounce). 700ms.
 * * Layout: Briefing is perfectly centered (Vert/Horz) in Overview.
 * * Input: Smart centering relative to the active column.
 */

'use client';

import React, { useState } from 'react';
import { 
  Menu, 
  Cpu, 
  Activity,
  Search,
  Clock
} from 'lucide-react';
import { MorningBriefing } from '@/components/dashboard/MorningBriefing';
import { ChatInterface } from '@/components/chat/ChatInterface';

export default function Dashboard() {
  // 'overview' = Center Stage. 'chat' = Split View.
  const [viewState, setViewState] = useState<'overview' | 'chat'>('overview');

  // Callback to trigger layout morph when user interacts
  const handleInteraction = () => {
    if (viewState === 'overview') setViewState('chat');
  };

  return (
    <div className="grid grid-cols-[auto_1fr] h-[100dvh] w-full bg-void font-sans text-muted selection:bg-cream/20 selection:text-cream overflow-hidden">
      
      {/* 1. SIDEBAR (Fixed Rail) */}
      <aside className="w-16 hidden md:flex flex-col items-center py-8 border-r border-white/[0.03] bg-void z-50">
        <div className="flex flex-col gap-6">
          <button className="h-10 w-10 rounded-lg flex items-center justify-center text-subtle hover:text-stone-200 transition-colors duration-300">
            <Menu size={18} strokeWidth={1.5} />
          </button>
          <button 
            onClick={() => setViewState(prev => prev === 'overview' ? 'chat' : 'overview')}
            className="h-10 w-10 rounded-lg flex items-center justify-center text-subtle hover:text-stone-200 transition-colors duration-300"
          >
            <Activity size={18} strokeWidth={1.5} />
          </button>
      </div>
        <div className="mt-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-cream/20" />
            </div>
      </aside>

      {/* 2. MAIN STAGE */}
      <main className="relative flex flex-col h-full min-w-0 bg-cinematic overflow-hidden">
        
        {/* HEADER */}
        <header className="flex-none h-24 w-full px-8 flex items-center justify-between border-b border-white/[0.03] z-40 bg-void/20 backdrop-blur-md">
          <div className="flex flex-col justify-center">
            <h1 className="font-sans text-base font-medium text-stone-100 tracking-tight leading-none mb-2">
              Daniel_OS
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              <span className="font-mono text-[9px] text-subtle tracking-[0.2em] uppercase">
                Runtime v19.0
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.02] border border-white/[0.04]">
              <Clock size={12} className="text-subtle" />
              <span className="font-mono text-[10px] text-muted">09:41 AM</span>
            </div>
            <button type="button" className="text-subtle hover:text-stone-200 transition-colors">
              <Search size={18} strokeWidth={1.5} />
            </button>
      </div>
        </header>

        {/* 3. MORPHING LAYOUT CONTAINER */}
        <div className="flex-1 flex relative overflow-hidden">
          
          {/* LEFT PANEL: The Briefing 
              Overview: 100% width, centered content.
              Chat: 20rem width, docked content.
          */}
          <section className={`
            relative flex flex-col border-r border-white/[0.02] bg-void/10 backdrop-blur-sm
            transition-all duration-700 ease-in-out
            ${viewState === 'overview' ? 'w-full items-center justify-center' : 'w-0 md:w-80 items-start justify-start overflow-hidden'}
          `}>
            
            {/* Inner Content - This fades and resizes */}
            <div className={`
              w-full h-full overflow-y-auto no-scrollbar transition-all duration-700 ease-in-out
              ${viewState === 'overview' ? 'flex items-center justify-center' : ''}
            `}>
              <div className={`
                transition-all duration-700 ease-in-out
                ${viewState === 'overview' ? 'w-full max-w-5xl' : 'w-80'}
              `}>
                <MorningBriefing state={viewState} />
              </div>
            </div>
          </section>

          {/* RIGHT PANEL: Chat Stream (Now handled by ChatInterface component) */}
          <ChatInterface 
            viewState={viewState} 
            onInteraction={handleInteraction}
      />

        </div>


    </main>
    </div>
  );
}
