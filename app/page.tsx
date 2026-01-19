'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, Command, Paperclip, ArrowUp } from 'lucide-react';
import { MorningBriefing } from '@/components/dashboard/MorningBriefing';
import { ChatInterface } from '@/components/chat/ChatInterface'; // Removed 'Message' import as it's now internal
import { useSession } from '@/components/context/SessionContext'; // <--- THE SHARED BRAIN

export default function Dashboard() {
  // 1. DELETE LOCAL STATE, USE GLOBAL STATE
  const { viewState, setViewState, messages, addMessage, isLoading } = useSession();
  
  const [input, setInput] = useState('');
  
  // High-End Fluid Physics
  const fluidTransition = { 
    type: "spring", 
    stiffness: 250, 
    damping: 40, 
    mass: 1.2 
  };

  // 2. Updated Handler using Global Brain
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Switch to Chat Mode
    setViewState('chat');
    
    // Add to Global Memory
    addMessage('user', input);
    
    setInput('');
    
    // Note: The actual AI response should come from your n8n backend later.
    // For now, this fallback logic is handled in ChatInterface or removed if n8n handles it.
  };

  return (
    <div className="h-screen w-full bg-[#050505] text-stone-400 overflow-hidden flex font-sans selection:bg-[#d4c4a8] selection:text-[#0a0a0a]">
      
      {/* SIDEBAR */}
      <aside className="w-16 h-full border-r border-white/5 bg-[#080808] flex flex-col items-center py-6 z-[60]">
        <div className="mb-8 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
          <div className="w-2 h-2 bg-[#d4c4a8] rounded-full shadow-[0_0_10px_rgba(212,196,168,0.5)]" />
        </div>
        <nav className="flex flex-col gap-6 w-full items-center">
          <button className="p-3 text-stone-500 hover:text-white transition-colors"><Menu size={20} /></button>
          <button 
            onClick={() => setViewState(viewState === 'overview' ? 'chat' : 'overview')}
            className={`p-3 rounded-xl transition-all ${viewState === 'chat' ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-white'}`}
          >
            <Command size={20} />
          </button>
        </nav>
        <div className="mt-auto pb-4">
           <button className="p-3 text-stone-500 hover:text-white"><Search size={20} /></button>
        </div>
      </aside>

      {/* MAIN STAGE */}
      <main className="flex-1 relative h-full flex overflow-hidden">
        
        {/* PANEL A: DASHBOARD */}
        <motion.div 
          initial={false}
          animate={{ 
            width: viewState === 'overview' ? '100%' : '480px',
            borderRightWidth: viewState === 'overview' ? '0px' : '1px'
          }}
          transition={fluidTransition}
          className="relative h-full bg-[#050505] z-0 overflow-hidden border-white/5"
        >
          <motion.div 
            className={`h-full w-full overflow-y-auto no-scrollbar pb-32 flex ${viewState === 'overview' ? 'justify-center' : 'justify-start pl-0'}`}
            layout
          >
             <div className="w-full h-full max-w-6xl flex justify-center pt-8 md:pt-0">
                <MorningBriefing state={viewState} />
             </div>
          </motion.div>
          
          <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent pointer-events-none z-10" />
        </motion.div>

        {/* PANEL B: CHAT HISTORY */}
        <motion.div 
          className="flex-1 h-full bg-[#050505] relative z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: viewState === 'chat' ? 1 : 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }} 
        >
          {/* We pass nothing because ChatInterface now uses useSession() internally too, 
              but if your ChatInterface component still expects props, we might need to update it.
              Based on our previous steps, ChatInterface should be clean. */}
          <ChatInterface viewState={viewState} onInteraction={() => setViewState('chat')} />
        </motion.div>

        {/* INPUT LAYER */}
        <motion.div
          className="absolute left-0 w-full flex items-end justify-center pointer-events-none z-50 px-6"
          initial={false}
          animate={{
            paddingLeft: viewState === 'overview' ? '0px' : '480px',
            bottom: viewState === 'overview' ? '60px' : '40px',
          }}
          transition={fluidTransition}
        >
          <motion.form 
            layout
            onSubmit={handleSend}
            className="relative flex items-end gap-3 bg-[#111111] p-2 pl-4 rounded-[36px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] border border-white/[0.06] pointer-events-auto backdrop-blur-2xl"
            initial={false}
            animate={{
              maxWidth: viewState === 'overview' ? '650px' : '900px', 
              width: '100%' 
            }}
            transition={fluidTransition}
          >
            <button type="button" className="p-3 mb-0.5 rounded-full text-stone-500 hover:text-white transition-colors">
              <Paperclip size={20} strokeWidth={2} />
            </button>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Arthur..."
              className="flex-1 bg-transparent border-none outline-none text-stone-200 placeholder-stone-600 font-sans text-[16px] h-[52px] py-3 min-w-0"
              autoFocus
            />
            <button 
              type="submit" 
              disabled={!input.trim()}
              className={`p-3 mb-0.5 rounded-full transition-all duration-300 flex items-center justify-center flex-shrink-0
                ${input.trim() ? 'bg-white text-black hover:scale-105' : 'bg-[#222] text-stone-600'}`}
            >
              <ArrowUp size={22} strokeWidth={2.5} />
            </button>
          </motion.form>
        </motion.div>

        <AnimatePresence>
          {viewState === 'overview' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute bottom-6 left-0 w-full text-center pointer-events-none z-40"
            >
              <p className="text-[10px] text-stone-600 tracking-widest uppercase font-mono">
                DanielOS v22.0 • Neural Interface Active
              </p>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}