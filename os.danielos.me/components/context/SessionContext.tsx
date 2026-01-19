'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define the shape of a message
export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
};

interface SessionContextType {
  messages: Message[];
  addMessage: (role: 'user' | 'assistant', content: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: "Session context initialized.", timestamp: '09:41' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, newMessage]);
  };

  return (
    <SessionContext.Provider value={{ messages, addMessage, isLoading, setIsLoading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}