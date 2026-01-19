'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  viewState: 'overview' | 'chat';
  setViewState: (state: 'overview' | 'chat') => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init-1', role: 'assistant', content: "Session context initialized.", timestamp: '09:41' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewState, setViewState] = useState<'overview' | 'chat'>('overview');

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    // FIX: Add Math.random() to ensure ID is unique even if created at same millisecond
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newMessage: Message = {
      id: uniqueId, 
      role,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    // Safety check: Filter out duplicates just in case
    setMessages(prev => {
      // If a message with this content already exists at the end of the array, skip it
      if (prev.length > 0 && prev[prev.length - 1].content === content && prev[prev.length - 1].role === role) {
        return prev;
      }
      return [...prev, newMessage];
    });
  };

  return (
    <SessionContext.Provider value={{ 
      messages, 
      addMessage, 
      isLoading, 
      setIsLoading,
      viewState,
      setViewState
    }}>
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