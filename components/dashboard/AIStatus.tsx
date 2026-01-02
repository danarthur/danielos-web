'use client';

/**
 * AI Status component - Presentational component showing system status
 * TODO: Replace with dynamic data when Supabase integration is ready
 */
export function AIStatus() {
  const status = 'OPERATIONAL';
  const uptime = '99.9%';
  const latency = '12ms';

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      <div className="p-4 rounded-lg bg-white/5 border border-stone-800/50">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-2 h-2 bg-emerald-500/30 rounded-full animate-ping" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-stone-400 text-[10px] font-mono uppercase tracking-widest">
                Status
              </span>
              <span className="text-stone-200 text-xs font-mono font-medium">
                {status}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-stone-500 text-[10px] font-mono uppercase tracking-widest">
                Uptime
              </span>
              <span className="text-stone-300 text-xs font-mono">
                {uptime}
              </span>
            </div>
            
            <div className="flex flex-col gap-0.5">
              <span className="text-stone-500 text-[10px] font-mono uppercase tracking-widest">
                Latency
              </span>
              <span className="text-stone-300 text-xs font-mono">
                {latency}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

