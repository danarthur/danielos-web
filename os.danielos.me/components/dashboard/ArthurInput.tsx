'use client';

import { ChangeEvent, FormEvent } from 'react';
import { motion } from 'framer-motion';

interface ArthurInputProps {
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
}

export function ArthurInput({ input, handleInputChange, handleSubmit, isLoading }: ArthurInputProps) {
  return (
    <motion.div 
      className="w-full max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.8 }}
    >
      <form onSubmit={handleSubmit} className="relative group">
        {/* Pulsing Border Glow when loading */}
        <motion.div 
          className={`absolute -inset-0.5 rounded-lg blur-sm ${
            isLoading 
              ? 'bg-gradient-to-r from-[#e5e5e5]/20 via-[#e5e5e5]/10 to-[#e5e5e5]/20' 
              : 'bg-gradient-to-r from-[#e5e5e5]/5 to-[#e5e5e5]/5'
          }`}
          animate={isLoading ? {
            opacity: [0.3, 0.6, 0.3],
          } : {}}
          transition={isLoading ? {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          } : {}}
        />
        
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask Arthur..."
          className="relative w-full bg-[#0a0908]/60 backdrop-blur-2xl border border-[#e5e5e5]/10 text-[#e5e5e5] placeholder-[#e5e5e5]/30 rounded-lg py-5 px-6 focus:outline-none focus:border-[#e5e5e5]/20 focus:ring-1 focus:ring-[#e5e5e5]/10 transition-all duration-500 font-light tracking-wide shadow-2xl"
          disabled={isLoading}
        />
        <button 
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-[#e5e5e5]/40 hover:text-[#e5e5e5]/70 disabled:opacity-20 transition-colors duration-300"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-[#e5e5e5]/40 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          )}
        </button>
      </form>
    </motion.div>
  );
}

