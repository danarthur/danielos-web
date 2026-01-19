import React from 'react';
import { motion } from 'framer-motion';
import { CloudRain, Battery, Wifi, Cpu, Calendar, ArrowUpRight } from 'lucide-react';

interface MorningBriefingProps {
  state: 'overview' | 'chat';
}

export const MorningBriefing: React.FC<MorningBriefingProps> = ({ state }) => {
  const isChat = state === 'chat';

  return (
    <div className={`w-full h-full flex flex-col ${isChat ? 'p-6 justify-start' : 'p-12 justify-center'} transition-all duration-500`}>
      
      {/* HEADER */}
      <motion.div layout className={`mb-6 ${isChat ? 'mt-4' : 'mb-10'}`}>
        <motion.h1 
          layout
          className={`font-light text-white tracking-tight whitespace-nowrap transition-all duration-500 ${isChat ? 'text-4xl mb-2' : 'text-6xl mb-4'}`}
        >
          Good Morning, <span className="text-[#E7E5DA]">Daniel.</span>
        </motion.h1>
        <motion.div layout className="flex items-center gap-3 opacity-60">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-emerald-500">System Nominal</span>
        </motion.div>
      </motion.div>

      {/* BENTO GRID -> VERTICAL STACK */}
      <motion.div 
        layout
        className={`grid gap-4 w-full transition-all duration-500 ${isChat ? 'grid-cols-1' : 'grid-cols-4 grid-rows-2 h-[440px]'}`}
      >
        
        {/* WEATHER */}
        <motion.div 
          layout
          className={`bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 backdrop-blur-sm flex flex-col justify-between ${isChat ? 'h-40' : 'col-span-1 row-span-2'}`}
        >
          <div className="flex justify-between items-start">
            <span className="font-mono text-[10px] uppercase text-stone-500">Irvine, CA</span>
            <CloudRain size={20} className="text-stone-400" />
          </div>
          <div>
            <motion.div layout className={`font-light text-white tracking-tighter ${isChat ? 'text-5xl' : 'text-5xl'}`}>
              62°
            </motion.div>
            <div className="text-sm text-stone-500 mt-2 font-medium">Heavy Rain</div>
          </div>
        </motion.div>

        {/* TIME */}
        <motion.div 
          layout
          className={`bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 relative overflow-hidden flex flex-col justify-center items-center ${isChat ? 'h-40' : 'col-span-2 row-span-1'}`}
        >
           <motion.div layout className={`font-thin text-white tracking-tighter z-10 ${isChat ? 'text-6xl' : 'text-8xl'}`}>
             09:41
           </motion.div>
           <motion.div layout className="text-stone-500 font-mono text-sm z-10 mt-2">
             Friday, January 24
           </motion.div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-[#E7E5DA]/5 blur-[80px] rounded-full pointer-events-none" />
        </motion.div>

        {/* STATS */}
        <motion.div 
          layout
          className={`bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 flex flex-col gap-6 justify-center ${isChat ? 'h-40' : 'col-span-1 row-span-2'}`}
        >
          <span className="font-mono text-[10px] uppercase text-stone-500">Diagnostics</span>
          <div className="space-y-5">
            <div className="flex justify-between items-center"><Cpu size={16} className="text-stone-600"/><span className="font-mono text-sm text-[#E7E5DA]">12%</span></div>
            <div className="flex justify-between items-center"><Wifi size={16} className="text-stone-600"/><span className="font-mono text-sm text-[#E7E5DA]">3.2GB</span></div>
            <div className="flex justify-between items-center"><Battery size={16} className="text-stone-600"/><span className="font-mono text-sm text-[#E7E5DA]">98%</span></div>
          </div>
        </motion.div>

        {/* CALENDAR */}
        <motion.div 
          layout
          className={`bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 flex flex-col justify-center ${isChat ? 'h-auto' : 'col-span-2 row-span-1'}`}
        >
          <div className="flex justify-between items-center mb-4">
            <span className="font-mono text-[10px] uppercase text-stone-500">Upcoming</span>
            <Calendar size={16} className="text-stone-600" />
          </div>
          <div className="flex justify-between items-center group cursor-pointer p-2 -mx-2 hover:bg-white/5 rounded-xl transition-colors">
            <div className="flex gap-4 items-center">
              <span className="font-mono text-xs text-stone-500 bg-white/5 px-2 py-1 rounded">10:00 AM</span>
              <span className="text-base text-stone-200 group-hover:text-white transition-colors">Product Sync</span>
            </div>
            <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-400"/>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
};