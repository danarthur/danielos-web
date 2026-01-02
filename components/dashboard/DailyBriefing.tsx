'use client';

import { DailyBriefingClient } from './DailyBriefingClient';

interface TimelineItem {
  id: string;
  time: string;
  text: string;
  source: 'ai' | 'user';
  timestamp: Date;
  type?: string;
  processed?: boolean;
  isRawInput?: boolean;
}

/**
 * Mock Daily Briefing component with static data
 * TODO: Replace with actual Supabase integration when ready
 */
function getMockTimeline(): TimelineItem[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return [
    {
      id: 'mock-1',
      time: '9:00 AM',
      text: 'System status nominal. 3 active tasks.',
      source: 'ai',
      timestamp: new Date(today.getTime() + 9 * 60 * 60 * 1000),
      type: 'task',
      isRawInput: false,
    },
    {
      id: 'mock-2',
      time: '10:30 AM',
      text: 'Review project documentation',
      source: 'ai',
      timestamp: new Date(today.getTime() + 10.5 * 60 * 60 * 1000),
      type: 'task',
      isRawInput: false,
    },
    {
      id: 'mock-3',
      time: '2:00 PM',
      text: 'Team sync meeting',
      source: 'ai',
      timestamp: new Date(today.getTime() + 14 * 60 * 60 * 1000),
      type: 'event',
      isRawInput: false,
    },
  ];
}

export function DailyBriefing() {
  const items = getMockTimeline();

  return <DailyBriefingClient items={items} />;
}

