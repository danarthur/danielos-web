import React from 'react';
import { motion } from 'framer-motion';
import { 
  CloudRain, 
  Battery, 
  Wifi, 
  Cpu, 
  Calendar as CalendarIcon, 
  ArrowUpRight 
} from 'lucide-react';

interface MorningBriefingProps {
  state: 'overview' | 'chat';
}

export const MorningBriefing: React.FC<MorningBriefingProps> = ({ state }) => {
  
  const isOverview = state === 'overview';

  return (
    <motion.div 
      className={`
        w-full h-full flex flex-col
        ${isOverview ? 'items-center justify-center p-12' : 'items-start justify-start p-6'}
      `}
      layout
    >
      
      {/* WRAPPER: Limits width in overview, full width in sidebar */}
      <motion.div 
        className={`w-full ${isOverview ? 'max-w-5xl' : 'max-w-full'}`}
        layout
      >
        
        {/* HEADER SECTION */}
        <motion.div className="mb-12" layout>
          <motion.h1 
            className={`font-sans font-light tracking-tight text-white ${isOverview ? 'text-6xl mb-4' : 'text-3xl mb-2'}`}
            layout
          >
            Good Morning, <span className="text-cream">Daniel.</span>
          </motion.h1>
          <motion.div className="flex items-center gap-3 opacity-60" layout>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-emerald-500">
              System Nominal • Online
            </span>
          </motion.div>
        </motion.div>

        {/* BENTO GRID */}
        <motion.div 
          className={`
            grid gap-4 w-full
            ${isOverview ? 'grid-cols-4 grid-rows-2 h-[400px]' : 'grid-cols-1 auto-rows-auto'}
          `}
          layout
        >
          
          {/* CARD 1: WEATHER (Large Square in Overview) */}
          <BentoCard 
            className={`${isOverview ? 'col-span-1 row-span-2' : 'col-span-1 h-32'}`}
          >
            <div className="flex flex-col h-full justify-between">
              <div className="flex justify-between items-start">
                <span className="font-mono text-[10px] text-stone-500 uppercase tracking-widest">Atmosphere</span>
                <CloudRain size={18} className="text-stone-400" />
              </div>
              <div>
                <div className="text-4xl font-light text-stone-200">62°</div>
                <div className="text-sm text-stone-500 mt-1">Heavy Rain</div>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge text="H: 65°" />
                <Badge text="L: 58°" />
              </div>
            </div>
          </BentoCard>

          {/* CARD 2: TIME (Wide Rect in Overview) */}
          <BentoCard 
            className={`${isOverview ? 'col-span-2 row-span-1' : 'col-span-1 h-32'}`}
          >
            <div className="flex flex-col h-full justify-center items-center relative overflow-hidden">
              <div className="absolute top-4 left-4 font-mono text-[10px] text-stone-500 uppercase tracking-widest">Local Time</div>
              <div className="text-6xl font-sans font-thin text-white tracking-tighter z-10">
                09:41
              </div>
              <div className="font-mono text-sm text-stone-500 mt-2 z-10">
                Thursday, January 24
              </div>
              {/* Decorative Background Blur */}
              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-cream/5 rounded-full blur-3xl" />
            </div>
          </BentoCard>

          {/* CARD 3: SYSTEM STATS (Vertical Stack) */}
          <BentoCard 
            className={`${isOverview ? 'col-span-1 row-span-2' : 'col-span-1 h-auto py-4'}`}
          >
            <div className="flex flex-col gap-6 h-full">
              <span className="font-mono text-[10px] text-stone-500 uppercase tracking-widest">Diagnostics</span>
              
              <StatRow label="CPU Load" value="12%" icon={<Cpu size={14} />} />
              <StatRow label="Memory" value="3.2GB" icon={<Wifi size={14} />} />
              <StatRow label="Battery" value="98%" icon={<Battery size={14} />} />
              
              <div className="mt-auto pt-4 border-t border-white/5">
                <div className="flex justify-between text-xs text-stone-400">
                  <span>Network</span>
                  <span className="text-emerald-500">Secure</span>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* CARD 4: AGENDA (Wide Bottom in Overview) */}
          <BentoCard 
            className={`${isOverview ? 'col-span-2 row-span-1' : 'col-span-1 h-auto min-h-[140px]'}`}
          >
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <span className="font-mono text-[10px] text-stone-500 uppercase tracking-widest">Upcoming</span>
                <CalendarIcon size={14} className="text-stone-500" />
              </div>
              <div className="flex flex-col gap-3">
                <EventItem time="10:00 AM" title="Product Sync" type="work" />
                <EventItem time="01:30 PM" title="Design Review" type="personal" />
              </div>
            </div>
          </BentoCard>

        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// --- Subcomponents for Clean Code ---

const BentoCard = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <motion.div 
    layout
    className={`bg-white/[0.03] border border-white/[0.05] rounded-3xl p-6 backdrop-blur-sm overflow-hidden hover:bg-white/[0.05] transition-colors ${className}`}
  >
    {children}
  </motion.div>
);

const Badge = ({ text }: { text: string }) => (
  <span className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-mono text-stone-400 border border-white/5">
    {text}
  </span>
);

const StatRow = ({ label, value, icon }: { label: string, value: string, icon: any }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3 text-stone-400">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <span className="font-mono text-xs text-cream">{value}</span>
  </div>
);

const EventItem = ({ time, title, type }: { time: string, title: string, type: 'work' | 'personal' }) => (
  <div className="flex items-center justify-between group cursor-pointer">
    <div className="flex items-center gap-4">
      <span className="font-mono text-xs text-stone-500">{time}</span>
      <span className="text-sm text-stone-300 group-hover:text-cream transition-colors">{title}</span>
    </div>
    <ArrowUpRight size={12} className="text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
);