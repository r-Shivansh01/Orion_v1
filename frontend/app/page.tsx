"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Layers } from 'lucide-react';
import api from '@/lib/api';

export default function LandingPage() {
  const [isLogin, setIsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('orion_token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const { data } = await api.post(endpoint, { email, password });
      
      localStorage.setItem('orion_token', data.token);
      localStorage.setItem('orion_user', JSON.stringify(data.user));
      
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-gray-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Orion_v1</span>
        </div>
        <button 
          onClick={() => setIsLogin(!isLogin)}
          className="text-sm font-medium hover:text-blue-400 transition-colors"
        >
          {isLogin ? "Need an account? Register" : "Already have an account? Login"}
        </button>
      </header>

      <main className="flex-1 flex flex-col md:flex-row">
        {/* Left Side: Hero */}
        <div className="flex-1 p-12 flex flex-col justify-center bg-gradient-to-br from-gray-950 to-blue-950/20">
          <div className="max-w-xl">
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Autonomous Agent Swarms <span className="text-blue-500">for Modern Software.</span>
            </h1>
            <p className="text-xl text-gray-400 mb-10 leading-relaxed">
              Orion orchestrates specialized LLM agents — Alnitak, Alnilam, and Mintaka — to plan, code, and review your tasks end-to-end.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Event-Driven</h3>
                  <p className="text-sm text-gray-500">Asynchronous processing via RabbitMQ for high reliability.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-600/10 flex items-center justify-center border border-purple-500/20">
                  <ShieldCheck className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">QA Verified</h3>
                  <p className="text-sm text-gray-500">Every line of code is reviewed by a specialized QA agent.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-green-600/10 flex items-center justify-center border border-green-500/20">
                  <Layers className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Live Observability</h3>
                  <p className="text-sm text-gray-500">Watch agent thoughts stream in real-time via WebSockets.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-orange-600/10 flex items-center justify-center border border-orange-500/20">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Replay Mode</h3>
                  <p className="text-sm text-gray-500">Playback past executions with detailed event logs.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-full md:w-[450px] p-12 flex flex-col justify-center border-l border-gray-900 bg-gray-950">
          <div className="card w-full max-w-sm mx-auto p-8 border-gray-800">
            <h2 className="text-2xl font-bold mb-6">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input" 
                  placeholder="name@company.com" 
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input" 
                  placeholder="••••••••" 
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-md text-red-500 text-sm">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                {loading ? <span className="animate-spin text-xl">◌</span> : (
                  <>
                    {isLogin ? 'Sign In' : 'Get Started'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
          
          <p className="text-center mt-8 text-gray-500 text-sm">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </main>
    </div>
  );
}
