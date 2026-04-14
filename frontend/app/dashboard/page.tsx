"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, LogOut, LayoutDashboard, History, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import JobCard from '@/components/JobCard';

export default function Dashboard() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [failedJobs, setFailedJobs] = useState<any[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'failed'>('active');
  const router = useRouter();

  useEffect(() => {
    fetchJobs();
    fetchFailedJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/tasks');
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFailedJobs = async () => {
    try {
      const { data } = await api.get('/api/tasks/failed');
      setFailedJobs(data);
    } catch (err) {
      console.error('Failed to fetch failed jobs', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setSubmitting(true);
    try {
      const { data } = await api.post('/api/tasks', { prompt });
      router.push(`/jobs/${data.job_id}`);
    } catch (err) {
      console.error('Failed to submit task', err);
      alert('Failed to submit task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('orion_token');
    localStorage.removeItem('orion_user');
    router.push('/');
  };

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-900 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Orion_v1</span>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('active')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-gray-900 text-blue-500' : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Recent Jobs
            </button>
            <button 
              onClick={() => setActiveTab('failed')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'failed' ? 'bg-gray-900 text-red-500' : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
            >
              <AlertCircle className="w-4 h-4" />
              Failed Tasks
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-gray-900">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:bg-gray-900 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-gray-900 flex items-center justify-between px-8 bg-gray-950/50 backdrop-blur-sm z-10">
          <h1 className="text-lg font-semibold">
            {activeTab === 'active' ? 'Recent Jobs' : 'Failed Tasks (DLQ)'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search jobs..." 
                className="bg-gray-900 border border-gray-800 rounded-full pl-10 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {/* Submit Task Form */}
          <div className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">Start a New Task</h2>
            <form onSubmit={handleSubmit} className="flex gap-4">
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Write a Python script to scrape Hacker News titles and save to CSV" 
                className="input py-3"
                disabled={submitting}
              />
              <button 
                type="submit" 
                disabled={submitting || !prompt.trim()}
                className="btn btn-primary px-8 flex items-center gap-2 whitespace-nowrap"
              >
                {submitting ? <span className="animate-spin text-xl">◌</span> : (
                  <>
                    <Plus className="w-5 h-5" />
                    Launch Agents
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Job List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTab === 'active' ? (
              <>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="card h-40 animate-pulse bg-gray-900/50" />
                  ))
                ) : jobs.length > 0 ? (
                  jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No jobs found. Launch your first agent swarm above!</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {failedJobs.length > 0 ? (
                  failedJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center text-gray-500">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No failed tasks found. All systems operational.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
