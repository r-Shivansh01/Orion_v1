import { useState, useEffect, useRef } from "react";

export interface AgentEvent {
  type: string;
  agent?: string;
  message?: string;
  timestamp: string;
  old_status?: string;
  new_status?: string;
  final_output?: string;
  language?: string;
  reason?: string;
  retry_count?: number;
  feedback?: string;
  stream?: boolean;
  [key: string]: any;
}

export function useReplay(eventLog: AgentEvent[], speed: number = 1) {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const BASE_INTERVAL_MS = 300; // base delay between events at 1× speed

  useEffect(() => {
    if (!isPlaying || currentIndex >= eventLog.length - 1) {
      if (currentIndex >= eventLog.length - 1) setIsPlaying(false);
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => prev + 1);
    }, BASE_INTERVAL_MS / speed);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, currentIndex, speed, eventLog.length]);

  const play = () => { 
    if (currentIndex >= eventLog.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(true); 
  };
  const pause = () => setIsPlaying(false);
  const reset = () => { setCurrentIndex(-1); setIsPlaying(false); };
  const seek = (index: number) => {
    setCurrentIndex(index);
  };

  // Current event to dispatch to AgentCanvas / TerminalLog
  const currentEvent = currentIndex >= 0 ? eventLog[currentIndex] : null;

  return { currentEvent, currentIndex, total: eventLog.length, isPlaying, play, pause, reset, seek };
}
