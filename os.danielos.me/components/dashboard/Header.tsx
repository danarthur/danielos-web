'use client';

import { useEffect, useState } from 'react';

export function Header() {
  const [greeting, setGreeting] = useState('System Online');
  
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning, Daniel');
    else if (hour < 18) setGreeting('Good Afternoon, Daniel');
    else setGreeting('Good Evening, Daniel');
  }, []);

  return (
    <div className="pt-20 pb-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-2">
        {/* Dynamic Greeting */}
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-[#e5e0d8]">
          {greeting}
        </h1>
        
        {/* System Meta Data */}
        <div className="flex items-center space-x-3 text-xs tracking-widest uppercase text-white/30 font-mono">
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span className="text-emerald-500/80">System Status: Nominal</span>
        </div>
      </div>
    </div>
  );
}

