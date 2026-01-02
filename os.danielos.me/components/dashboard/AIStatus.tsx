'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface AIStatusProps {
  status: 'idle' | 'processing';
  message: string;
}

export function AIStatus({ status, message }: AIStatusProps) {
  return (
    <div className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-[#e5e5e5]/10 bg-[#0a0908]/40 backdrop-blur-sm">
          {/* Status Dot */}
      <div>
        <div className={`w-2 h-2 rounded-full ${status === 'processing' ? 'bg-[#e5e5e5] animate-pulse' : 'bg-[#e5e5e5]/20'}`} />
          </div>

          {/* Arthur's Voice */}
      <div className="font-mono text-xs leading-relaxed text-[#e5e5e5]/70">
            <AnimatePresence mode="wait">
          <motion.span
                key={message}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {message || "Awaiting input..."}
          </motion.span>
            </AnimatePresence>
      </div>
    </div>
  );
}

