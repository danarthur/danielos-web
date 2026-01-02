'use client';

import { motion } from 'framer-motion';
import { Circle, Clock } from 'lucide-react';

export function DailyBriefing() {
  // Placeholder data - we will connect this to Supabase later
  const timeline = [
    { time: '09:00', title: 'Deep Work Block', type: 'focus', completed: true },
    { time: '14:00', title: 'System Architecture Review', type: 'meeting', completed: false },
    { time: '19:00', title: 'Evening Reflection', type: 'personal', completed: false },
  ];

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="h-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <h2 className="text-xs font-mono tracking-widest text-[#e5e5e5]/40 uppercase mb-4">
          Daily Briefing
      </h2>
        <p className="font-serif text-[#e5e5e5]/80 text-lg mb-8 leading-relaxed">
          {dateStr}
        </p>
      </motion.div>
      
      <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-0 before:w-px before:bg-[#e5e5e5]/10">
        {timeline.map((item, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-start group"
          >
            {/* Timeline Node */}
            <div className="relative z-10 flex items-center justify-center w-10 h-10 -ml-[2px]">
              <div className={`w-2.5 h-2.5 rounded-full border-2 transition-colors duration-500 ${
                item.completed 
                  ? 'bg-[#e5e5e5]/20 border-[#e5e5e5]/60' 
                  : 'bg-[#0a0908] border-[#e5e5e5]/20 group-hover:border-[#e5e5e5]/40'
              }`} />
            </div>

            {/* Content */}
            <div className="ml-4 pt-2">
              <div className="flex items-baseline space-x-3">
                <span className="font-mono text-xs text-[#e5e5e5]/30">{item.time}</span>
                <h3 className={`text-sm font-medium transition-colors ${
                  item.completed ? 'text-[#e5e5e5]/30 line-through' : 'text-[#e5e5e5]/70'
                }`}>
                  {item.title}
                </h3>
              </div>
            </div>
          </motion.div>
        ))}
        
        {/* Empty State / End of Line */}
        <div className="ml-12 pt-8 text-xs text-[#e5e5e5]/20 italic font-mono">
          No further critical tasks pending.
        </div>
      </div>
    </div>
  );
}

