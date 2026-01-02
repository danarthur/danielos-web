import React from 'react';
import { Calendar, Activity } from 'lucide-react';

interface MorningBriefingProps {
  state: 'overview' | 'chat';
}

export const MorningBriefing: React.FC<MorningBriefingProps> = ({ state }) => {
  return (
    <div className={`
      flex flex-col gap-8 p-8 transition-all duration-700 ease-in-out
      ${state === 'overview' ? 'opacity-100 translate-y-0 delay-100' : 'opacity-100 translate-y-0'}
    `}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calendar size={14} className="text-stone-400" />
        <span className="font-mono text-[10px] tracking-[0.2em] text-stone-400 uppercase">
          {state === 'overview' ? "Thursday, January 1" : "Brief"}
        </span>
      </div>

      {/* Grid */}
      <div className={`
        grid gap-8 transition-all duration-700
        ${state === 'overview' ? 'grid-cols-1 md:grid-cols-3 w-full max-w-5xl' : 'grid-cols-1 w-full'}
      `}>
        {/* Block 1 */}
        <div className="flex flex-col gap-3 group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.04] transition-all">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-semibold text-stone-200 tracking-wide">09:00 AM</h3>
            <span className="w-1.5 h-1.5 rounded-full bg-stone-500/50" />
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            <span className="text-stone-300">Architecture Review</span><br />
            <span className="text-stone-600 font-mono text-[10px] uppercase mt-1 block">Core Team Sync</span>
          </p>
        </div>
        
        {/* Block 2 */}
        <div className="flex flex-col gap-3 group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.04] transition-all">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-semibold text-stone-200 tracking-wide">System Health</h3>
            <Activity size={12} className="text-emerald-500" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
              <div className="h-full w-[98%] bg-emerald-500" />
            </div>
            <span className="text-xs text-emerald-500 font-mono">98%</span>
          </div>
        </div>

        {/* Block 3 */}
        <div className="flex flex-col gap-3 group p-5 rounded-2xl bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.04] transition-all">
          <div className="flex items-center justify-between">
            <h3 className="font-sans text-sm font-semibold text-stone-200 tracking-wide">Atmosphere</h3>
            <span className="text-[10px] font-mono text-stone-600">ACTIVE</span>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Notifications muted.<br />
            <span className="text-stone-400 mt-1 block">Creative Focus</span>
          </p>
        </div>
      </div>
    </div>
  );
};

