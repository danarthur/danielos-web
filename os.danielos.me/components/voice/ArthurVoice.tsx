'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Volume2, AlertCircle } from 'lucide-react';

export default function ArthurVoice() {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'playing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = sendAudioToArthur;
      mediaRecorder.start();
      setStatus('recording');
      setErrorMessage('');
    } catch (error) {
      console.error('Mic Error:', error);
      setStatus('error');
      setErrorMessage('Mic blocked');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); // Release mic
      setStatus('processing');
    }
  };

  const sendAudioToArthur = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    if (audioBlob.size < 100) {
      setStatus('error');
      setErrorMessage('No sound detected');
      return;
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    try {
      // ⚠️ YOUR N8N URL HERE
      const webhookUrl = 'https://n8n.danielos.me/webhook/arthur-voice'; 

      const response = await fetch(webhookUrl, { method: 'POST', body: formData });

      // If n8n sends an error (non-200 status)
      if (!response.ok) {
        setStatus('error');
        setErrorMessage(`Server Error: ${response.status}`);
        return;
      }

      // Check if response is actually audio
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('audio')) {
        const text = await response.text();
        console.error('Arthur sent text instead of audio:', text);
        setStatus('error');
        setErrorMessage('Arthur sent text (Check n8n)');
        return;
      }

      const audioBlobResponse = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlobResponse);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(e => {
            console.error("Playback failed:", e);
            setStatus('error');
            setErrorMessage('Playback failed');
        });
        setStatus('playing');
        
        audioRef.current.onended = () => {
          setStatus('idle');
          URL.revokeObjectURL(audioUrl);
        };
      }
    } catch (error) {
      console.error('Fetch Error:', error);
      setStatus('error');
      setErrorMessage('Connection failed');
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-4">
      <audio ref={audioRef} className="hidden" />

      {/* Status Label */}
      <AnimatePresence>
        {(status !== 'idle') && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`
              text-xs px-3 py-1 rounded-full border font-mono backdrop-blur-md
              ${status === 'error' ? 'bg-red-900/80 border-red-500 text-red-200' : 'bg-black/80 border-white/10 text-white'}
            `}
          >
            {status === 'recording' && "LISTENING..."}
            {status === 'processing' && "THINKING..."}
            {status === 'playing' && "SPEAKING"}
            {status === 'error' && errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={status === 'recording' ? stopRecording : startRecording}
        disabled={status === 'processing' || status === 'playing'}
        className={`
          h-16 w-16 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-lg border transition-all duration-300
          ${status === 'recording' ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' :
            status === 'processing' ? 'bg-amber-500/20 border-amber-500 text-amber-500' :
            status === 'playing' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' :
            status === 'error' ? 'bg-red-900/50 border-red-500 text-red-500' :
            'bg-zinc-900/80 border-zinc-700 text-white hover:border-white/50'}
        `}
      >
        {status === 'recording' ? <Square className="w-6 h-6 fill-current" /> :
         status === 'processing' ? <Loader2 className="w-6 h-6 animate-spin" /> :
         status === 'playing' ? <Volume2 className="w-6 h-6 animate-bounce" /> :
         status === 'error' ? <AlertCircle className="w-6 h-6" /> :
         <Mic className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}