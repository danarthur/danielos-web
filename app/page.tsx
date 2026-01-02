/**
 * DANIELOS - ORCHESTRATOR v21.0
 * * Role: Manages global state (Overview vs Chat) and layout shell.
 * * Content: Delegates to <MorningBriefing /> and <ChatInterface />.
 */

'use client';

import React, { useState } from 'react';
import { Menu, Activity, Search, Clock } from 'lucide-react';
import { MorningBriefing } from '@/components/dashboard/MorningBriefing';
import { ChatInterface } from '@/components/chat/ChatInterface';

export default function Dashboard() {
  const [viewState, setViewState] = useState<'overview' | 'chat'>('overview');

  return (
    <div className="grid grid-cols-[auto_1fr] h-[100dvh] w-full bg-void font-sans text-stone-400 overflow-hidden">
      
      {/* 1. SIDEBAR */}
      <aside className="w-16 hidden md:flex flex-col items-center py-8 border-r border-white/[0.03] bg-void z-50">
        <div className="flex flex-col gap-6">
          <button className="h-10 w-10 rounded-lg flex items-center justify-center hover:bg-white/5 hover:text-stone-200 transition-colors">
            <Menu size={18} strokeWidth={1.5} />
          </button>
          <button 
            onClick={() => setViewState(prev => prev === 'overview' ? 'chat' : 'overview')}
            className={`h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${viewState === 'chat' ? 'text-stone-200 bg-white/5' : 'hover:text-stone-200'}`}
          >
            <Activity size={18} strokeWidth={1.5} />
          </button>
        </div>
      </aside>

      {/* 2. MAIN STAGE */}
      <main className="relative flex flex-col h-full min-w-0 bg-cinematic overflow-hidden">
        
        {/* HEADER */}
        <header className="flex-none h-24 w-full px-8 flex items-center justify-between border-b border-white/[0.03] z-40 bg-void/20 backdrop-blur-md">
          <div className="flex flex-col justify-center">
            <h1 className="font-sans text-base font-medium text-stone-100 tracking-tight leading-none mb-2">Daniel_OS</h1>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              <span className="font-mono text-[9px] text-stone-500 tracking-[0.2em] uppercase">Runtime v21.0</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.02] border border-white/[0.04]">
              <Clock size={12} className="text-stone-500" />
              <span className="font-mono text-[10px] text-stone-400">09:41 AM</span>
            </div>
            <Search size={18} strokeWidth={1.5} className="text-stone-500 hover:text-stone-200 transition-colors" />
          </div>
        </header>

        {/* 3. MORPHING LAYOUT */}
        <div className="flex-1 flex relative overflow-hidden">
          
          {/* PANEL A: Briefing */}
          <section className={`
            relative flex flex-col border-r border-white/[0.02] bg-void/10 backdrop-blur-sm
            transition-all duration-700 ease-in-out
            ${viewState === 'overview' ? 'flex-[1_0_100%] items-center justify-center' : 'flex-[0_0_20rem] items-start justify-start'}
          `}>
            <div className="w-full h-full overflow-y-auto no-scrollbar">
               <MorningBriefing state={viewState} />
            </div>
          </section>

          {/* PANEL B: Chat Stream + Input */}
          <ChatInterface viewState={viewState} onInteraction={() => setViewState('chat')} />

        </div>
      </main>
    </div>
  );
}