"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Play, Pause, RotateCcw, Link as LinkIcon, Share2 } from "lucide-react";
import api from "@/lib/api";
import { useReplay, AgentEvent } from "@/hooks/useReplay";
import AgentCanvas from "@/components/AgentCanvas";
import TerminalLog from "@/components/TerminalLog";

export default function ReplayPage() {
  const { jobId } = useParams() as { jobId: string };
  const router = useRouter();
  const [eventLog, setEventLog] = useState<AgentEvent[]>([]);
  const [job, setJob] = useState<any>(null);
  const [speed, setSpeed] = useState(1);
  const { currentEvent, currentIndex, total, isPlaying, play, pause, reset, seek } = useReplay(eventLog, speed);

  useEffect(() => {
    api.get(`/api/tasks/${jobId}/replay`)
      .then(res => {
        setEventLog(res.data.event_log);
        setJob(res.data);
      })
      .catch(err => console.error("Failed to fetch replay", err));
  }, [jobId]);

  const copyReplayLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("Replay link copied!");
  };

  if (!job) return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Replay Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-800 bg-gray-900/50">
        <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div>
          <h1 className="text-sm font-medium text-gray-300">Agent Replay</h1>
          <p className="text-xs text-gray-500 truncate max-w-md">{job.prompt}</p>
        </div>

        <div className="flex items-center gap-2 ml-8 px-4 py-1.5 bg-black rounded-lg border border-gray-800">
          <button 
            onClick={isPlaying ? pause : play} 
            className={`p-1 rounded ${isPlaying ? 'text-yellow-500' : 'text-green-500'} hover:bg-gray-800`}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button onClick={reset} className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded">
            <RotateCcw className="w-5 h-5" />
          </button>
          
          <div className="h-4 w-[1px] bg-gray-800 mx-2"></div>
          
          <select 
            value={speed} 
            onChange={e => setSpeed(Number(e.target.value))}
            className="bg-transparent text-xs font-mono focus:outline-none cursor-pointer"
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1.0×</option>
            <option value={2}>2.0×</option>
            <option value={4}>4.0×</option>
          </select>
        </div>

        <div className="flex-1 max-w-xs mx-4">
          <input 
            type="range" 
            min="-1" 
            max={total - 1} 
            value={currentIndex} 
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-blue-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <span className="text-gray-500 text-xs font-mono">
          {Math.max(0, currentIndex + 1)} / {total}
        </span>

        <button onClick={copyReplayLink} className="btn btn-secondary btn-sm flex items-center gap-2 ml-auto">
          <LinkIcon className="w-4 h-4" />
          Share Replay
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[3] border-r border-gray-900 relative">
          <AgentCanvas replayEvent={currentEvent} />
        </div>
        <div className="flex-[2] min-w-[400px]">
          <TerminalLog logs={[]} replayEvent={currentEvent} />
        </div>
      </div>
    </div>
  );
}
