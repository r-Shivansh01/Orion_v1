"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Download, CheckCircle, XCircle, Loader2, Copy } from 'lucide-react';
import api from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import AgentCanvas from '@/components/AgentCanvas';
import TerminalLog from '@/components/TerminalLog';
import QASeverityBadge from '@/components/QASeverityBadge';

export default function JobLiveView() {
  const { jobId } = useParams() as { jobId: string };
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const { messages, isConnected, error: wsError } = useWebSocket(jobId);

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const fetchJob = async () => {
    try {
      const { data } = await api.get(`/api/tasks/${jobId}`);
      setJob(data);
    } catch (err) {
      console.error('Failed to fetch job', err);
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      if (lastMessage.type === 'AGENT_ACTIVATED') {
        setActiveAgent(lastMessage.agent);
      } else if (lastMessage.type === 'STATUS_CHANGE') {
        setJob((prev: any) => ({ ...prev, status: lastMessage.new_status }));
      } else if (lastMessage.type === 'TASK_COMPLETE') {
        setJob((prev: any) => ({ 
          ...prev, 
          status: 'COMPLETED', 
          finalOutput: lastMessage.final_output,
          qaSeverity: lastMessage.qa_severity 
        }));
        setActiveAgent(null);
      } else if (lastMessage.type === 'TASK_FAILED') {
        setJob((prev: any) => ({ ...prev, status: 'FAILED' }));
        setActiveAgent(null);
      }
    }
  }, [messages]);

  const downloadCode = () => {
    if (!job?.finalOutput) return;
    const element = document.createElement("a");
    const file = new Blob([job.finalOutput], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `orion_task_${jobId.slice(0, 8)}.txt`;
    document.body.appendChild(element);
    element.click();
  };

  const copyCode = () => {
    if (!job?.finalOutput) return;
    navigator.clipboard.writeText(job.finalOutput);
    alert('Code copied to clipboard!');
  };

  if (!job) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Top Header */}
      <header className="h-16 border-b border-gray-900 flex items-center justify-between px-6 bg-gray-950/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-gray-900 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-medium text-gray-400 truncate max-w-md">Task: {job.prompt}</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-blue-500">{job.status}</span>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? 'Connected' : 'Disconnected'}></span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {job.status === 'COMPLETED' && (
            <>
              <QASeverityBadge severity={job.qaSeverity} />
              <button onClick={copyCode} className="btn btn-secondary btn-sm flex items-center gap-2">
                <Copy className="w-4 h-4" />
                Copy
              </button>
              <button onClick={downloadCode} className="btn btn-primary btn-sm flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download Artifact
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Canvas */}
        <div className="flex-[3] relative border-r border-gray-900">
          <AgentCanvas activeAgent={activeAgent} />
          
          {/* Status Overlay */}
          <div className="absolute bottom-6 left-6 p-4 card bg-gray-950/80 backdrop-blur-md max-w-xs border-gray-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">System Status</h3>
            {job.status === 'COMPLETED' ? (
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Task successful</span>
              </div>
            ) : job.status === 'FAILED' ? (
              <div className="flex items-center gap-2 text-red-500">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Task failed</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Agents are working...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Terminal & Output */}
        <div className="flex-[2] flex flex-col min-w-[400px]">
          <div className="flex-1 overflow-hidden">
            <TerminalLog logs={messages.filter(m => m.type === 'AGENT_LOG') as any} />
          </div>
          
          {job.status === 'COMPLETED' && job.finalOutput && (
            <div className="h-1/2 border-t border-gray-800 flex flex-col bg-gray-900">
              <div className="p-2 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                <span className="text-xs font-mono text-gray-500">FINAL OUTPUT</span>
              </div>
              <pre className="flex-1 p-4 overflow-auto font-mono text-sm text-gray-300">
                <code>{job.finalOutput}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
      
      {wsError && (
        <div className="absolute bottom-4 right-4 p-4 bg-red-500 text-white rounded-lg shadow-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{wsError}</span>
        </div>
      )}
    </div>
  );
}
