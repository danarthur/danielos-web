'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // We point to the file we just made
import { ShieldAlert, Clock, Terminal } from 'lucide-react';

export default function InboxPage() {
  interface Email {
    id: number;
    subject: string;
    ai_summary: string;
    ai_urgency: string;
    ai_action_items: string;
    received_at: string;
  }

  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch data from Supabase
      const { data, error } = await supabase
        .from('inbox')
        .select('*')
        .order('received_at', { ascending: false });

      if (error) console.error('Error:', error);
      if (data) setEmails(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-8 selection:bg-green-900">
      {/* Header */}
      <header className="flex items-center gap-4 mb-10 border-b border-green-900 pb-4">
        <ShieldAlert className="w-10 h-10 text-green-400" />
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">ARTHUR // MEMORY_CORE</h1>
          <p className="text-xs text-green-700">SECURE CONNECTION ESTABLISHED</p>
        </div>
      </header>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-green-600 animate-pulse">
          <Terminal className="w-4 h-4" />
          <span>DECRYPTING DATA STREAMS...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {emails.map((email) => (
            <div 
              key={email.id} 
              className="group relative border border-green-900/40 bg-gray-950/50 p-6 rounded-lg 
                         hover:border-green-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,255,0,0.1)]"
            >
              {/* Urgency Badge */}
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${
                  email.ai_urgency === 'High' ? 'bg-red-950 text-red-500 border-red-900' : 
                  email.ai_urgency === 'Medium' ? 'bg-yellow-950 text-yellow-500 border-yellow-900' :
                  'bg-green-950 text-green-500 border-green-900'
                }`}>
                  {email.ai_urgency || 'NORMAL'}
                </span>
                <Clock className="w-3 h-3 text-green-800" />
              </div>
              
              {/* Content */}
              <h2 className="text-lg font-bold mb-3 text-gray-100 leading-tight group-hover:text-green-400 transition-colors">
                {email.subject}
              </h2>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed border-l-2 border-gray-800 pl-3">
                {email.ai_summary}
              </p>
              
              {/* Action Protocol */}
              <div className="mt-auto bg-black/40 p-3 rounded border border-green-900/30">
                 <h3 className="text-[10px] text-green-600 mb-2 uppercase tracking-widest font-bold flex items-center gap-2">
                   <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                   Directives
                 </h3>
                 <div className="text-xs text-gray-300 font-sans whitespace-pre-wrap">
                   {email.ai_action_items}
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}