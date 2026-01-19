'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, Volume2, AlertCircle } from 'lucide-react';
import { useSession } from '../context/SessionContext';

export default function ArthurVoice() {
  const { addMessage, setViewState } = useSession();
  
  // UI STATE
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle');
  const [volume, setVolume] = useState(0);

  // REFS
  const isSessionActiveRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const hasSpokenRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  // CONFIG
  const SILENCE_THRESHOLD = 2000; // 2.0s silence
  const MIN_VOLUME = 10; 

  const startSession = async () => {
    console.log("🔵 Starting Session...");
    isSessionActiveRef.current = true;
    setStatus('listening');
    startListening();
  };

  const stopSession = () => {
    console.log("🔴 Ending Session manually.");
    isSessionActiveRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    stopListening(false);
    setStatus('idle');
    setVolume(0);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const startListening = async () => {
    try {
      if (!isSessionActiveRef.current) return;

      console.log("🎤 Initializing Mic...");
      
      // --- FIX 1: FORCE MAC MIC ---
      // We look for a device that has 'internal' or 'macbook' in the name
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      const macMic = audioDevices.find(d => 
        d.label.toLowerCase().includes('internal') || 
        d.label.toLowerCase().includes('macbook')
      );
      
      const constraints = {
        audio: macMic ? { deviceId: { exact: macMic.deviceId } } : true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // -----------------------------
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      await audioContext.resume(); 
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      hasSpokenRef.current = false;
      
      const checkVolume = () => {
        if (!isSessionActiveRef.current || !analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) { sum += dataArray[i]; }
        const currentVol = sum / bufferLength;
        setVolume(currentVol);

        if (currentVol > MIN_VOLUME) {
          if (!hasSpokenRef.current) {
              console.log("🗣️ Speech Detected!");
              hasSpokenRef.current = true;
          }
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
             console.log("🤫 Silence Detected -> Sending...");
             stopListening(true); 
          }, SILENCE_THRESHOLD);
        }
        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      mediaRecorder.start();
      checkVolume();

    } catch (error) {
      console.error('❌ Mic Error:', error);
      setStatus('error');
      isSessionActiveRef.current = false; // Stop the session on error
    }
  };

  const stopListening = (shouldSend: boolean) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      if (shouldSend) {
        setTimeout(() => sendAudioToArthur(), 200);
      }
    }
  };

  const sendAudioToArthur = async () => {
    if (!isSessionActiveRef.current) return;
    setStatus('processing');
    
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    if (audioBlob.size < 1000) {
       console.warn("⚠️ Audio too short. Listening again...");
       if (isSessionActiveRef.current) startListening();
       return;
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    try {
      const webhookUrl = 'https://n8n.danielos.me/webhook/arthur-voice'; 
      const response = await fetch(webhookUrl, { method: 'POST', body: formData });
      
      const textResponse = await response.text();
      if (!textResponse) throw new Error("Empty Response");
      
      let data;
      try { data = JSON.parse(textResponse); } catch(e) { throw new Error("Invalid JSON"); }

      setViewState('chat');
      if (data.user_transcript) addMessage('user', data.user_transcript);
      if (data.ai_response) addMessage('assistant', data.ai_response);

      if (data.audio) {
        const audioSrc = `data:audio/mp3;base64,${data.audio}`;
        if (audioRef.current) {
          audioRef.current.src = audioSrc;
          setStatus('speaking');
          audioRef.current.play();
          audioRef.current.onended = () => {
            if (isSessionActiveRef.current) {
                setStatus('listening');
                startListening();
            } else {
                setStatus('idle');
            }
          };
        }
      } else {
        if (isSessionActiveRef.current) startListening();
      }

    } catch (error) {
      console.error('❌ Error:', error);
      setStatus('error');
      // --- FIX 2: STOP LOOP ON ERROR ---
      isSessionActiveRef.current = false; // Kill the session so it doesn't retry forever
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-center gap-4">
      <audio ref={audioRef} className="hidden" />

      <AnimatePresence>
        {(status !== 'idle') && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`
              text-xs px-3 py-1 rounded-full border font-mono backdrop-blur-md flex items-center gap-2
              ${status === 'error' ? 'bg-red-900/80 border-red-500 text-red-200' : 'bg-black/80 border-white/10 text-white'}
            `}
          >
            {status === 'listening' && <>LISTENING ({Math.round(volume)})</>}
            {status === 'processing' && <><Loader2 className="w-3 h-3 animate-spin" /> THINKING</>}
            {status === 'speaking' && <><Volume2 className="w-3 h-3 animate-bounce" /> SPEAKING</>}
            {status === 'error' && "ERROR"}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={status === 'idle' ? startSession : stopSession}
        className={`
          h-16 w-16 rounded-full flex items-center justify-center shadow-2xl backdrop-blur-lg border transition-all duration-300
          ${status !== 'idle' ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-zinc-900/80 border-zinc-700 text-white'}
        `}
      >
        {status !== 'idle' ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}