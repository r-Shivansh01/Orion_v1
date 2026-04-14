"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface LogEntry {
  agent: string;
  message: string;
  timestamp: string;
  stream?: boolean;
}

interface TerminalLogProps {
  logs: LogEntry[];
  replayEvent?: any;
}

const TerminalLog: React.FC<TerminalLogProps> = ({ logs: initialLogs, replayEvent }) => {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [currentStreamLine, setCurrentStreamLine] = useState<{ agent: string, message: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  useEffect(() => {
    if (replayEvent && replayEvent.type === 'AGENT_LOG') {
      handleLogEvent(replayEvent);
    }
  }, [replayEvent]);

  const handleLogEvent = (event: any) => {
    if (event.stream) {
      setCurrentStreamLine(prev => {
        if (prev && prev.agent === event.agent) {
          return { ...prev, message: prev.message + event.message };
        }
        return { agent: event.agent, message: event.message };
      });
    } else {
      setLogs(prev => [...prev, {
        agent: event.agent,
        message: event.message,
        timestamp: event.timestamp || new Date().toISOString()
      }]);
      setCurrentStreamLine(null);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, currentStreamLine]);

  const getAgentColor = (agent: string) => {
    switch (agent.toLowerCase()) {
      case 'alnitak': return 'text-purple-400';
      case 'alnilam': return 'text-blue-400';
      case 'mintaka': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black border-l border-gray-800 font-mono text-sm overflow-hidden">
      <div className="flex items-center gap-2 p-2 bg-gray-900 border-b border-gray-800 text-gray-400">
        <Terminal className="w-4 h-4" />
        <span>Agent Logs</span>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-800"
      >
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-gray-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            <span className={`font-bold ${getAgentColor(log.agent)}`}>{log.agent}:</span>
            <span className="text-gray-300 break-words whitespace-pre-wrap">{log.message}</span>
          </div>
        ))}
        {currentStreamLine && (
          <div className="flex gap-2">
            <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span>
            <span className={`font-bold ${getAgentColor(currentStreamLine.agent)}`}>{currentStreamLine.agent}:</span>
            <span className="text-gray-300 break-words whitespace-pre-wrap">{currentStreamLine.message}<span className="inline-block w-2 h-4 bg-gray-500 animate-pulse ml-0.5"></span></span>
          </div>
        )}
        {logs.length === 0 && !currentStreamLine && (
          <div className="text-gray-600 italic">Awaiting agent thoughts...</div>
        )}
      </div>
    </div>
  );
};

export default TerminalLog;
