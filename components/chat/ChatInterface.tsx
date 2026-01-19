'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, ArrowUp, Hash } from 'lucide-react';
import { useSession } from '../context/SessionContext'; // <--- Import the Shared Brain
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInterfaceProps {
  viewState: 'overview' | 'chat';
  onInteraction: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ viewState, onInteraction }) => {
  // 1. GET MESSAGES FROM THE SHARED BRAIN (Not Props)
  const { messages, addMessage, isLoading } = useSession(); 
  
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    onInteraction(); // Switch layout
    addMessage('user', input); // Add to global memory
    setInput('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when messages change
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
            
            {/* Header */}
            <div className="flex flex-col items-center justify-center py-12 opacity-60 select-none">
              <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-4">
                <Hash size={16} className="text-stone-300" />
              </div>
              <h1 className="font-sans text-lg font-medium text-stone-200 tracking-tight">System Optimization</h1>
              <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mt-8" />
            </div>

            {/* Messages Loop */}
            <div className="flex flex-col justify-end gap-8">
              <AnimatePresence mode="popLayout">
                {messages && messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <motion.div 
                      key={msg.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col gap-1.5 group ${isUser ? 'items-end' : 'items-start'}`}
                    >
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
                        {msg.content}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-stone-600 animate-pulse mt-4">
                  Thinking...
                </motion.div>
              )}
              <div ref={scrollRef} />
            </div>
          </div>
        </div>
      </div>
      
      {/* Note: The Input Dock is handled by the main page layout now, 
          but we keep logic here just in case you move it back. 
          Currently this component is mostly for DISPLAYING the chat. */}
    </>
  );
};