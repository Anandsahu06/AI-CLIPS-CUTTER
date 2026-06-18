import Link from "next/link";
import { Sparkles, Video, Languages, Target, Layers, Zap, ArrowRight, ArrowDown } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Background aesthetic blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-display font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              ClipForge <span className="text-indigo-400">AI</span>
            </span>
          </div>
          <nav className="flex items-center space-x-4">
            <Link 
              href="/dashboard" 
              className="text-sm font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Workspace
            </Link>
            <Link 
              href="/dashboard" 
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center max-w-7xl mx-auto px-6 py-20 lg:py-32 z-10 text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold mb-6 mx-auto animate-pulse-slow">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Powered by Gemini 1.5 Flash & Whisper</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.1]">
          Turn Long Videos Into{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-violet-400 bg-clip-text text-transparent">
            Viral Shorts
          </span>{" "}
          In Seconds
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          ClipForge AI uses advanced face-tracking crop models and transcription analysis to cut your long YouTube uploads into engaging, vertical clips ready for TikTok, Shorts, and Reels.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link 
            href="/dashboard" 
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-white text-slate-950 font-bold hover:bg-slate-100 rounded-2xl shadow-xl shadow-white/5 transition-all duration-300 transform hover:-translate-y-0.5"
          >
            <span>Try ClipForge for Free</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a 
            href="#features" 
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-8 py-4 bg-slate-900 border border-slate-800 text-slate-300 font-semibold hover:bg-slate-850 hover:text-white rounded-2xl transition-all duration-300"
          >
            <span>Learn How It Works</span>
            <ArrowDown className="w-4 h-4" />
          </a>
        </div>

        {/* Feature Grid */}
        <section id="features" className="pt-20 border-t border-slate-900">
          <h2 className="text-3xl font-display font-bold mb-12">Professional AI Shorts Toolkit</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {/* Feature 1 */}
            <div className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 p-6 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-500/5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Smart Face-Tracking Reframe</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Automatically crops widescreen 16:9 videos into 9:16 portrait. Smoothly tracks speaker movements to keep them perfectly centered.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 p-6 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-500/5">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-4 group-hover:bg-violet-500 group-hover:text-white transition-colors duration-300">
                <Languages className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Karaoke-Style Captions</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Burn animated word-level captions natively. Choose from trending subtitle themes: TikTok Yellow, Neon Cyberpunk, or Minimalist.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 p-6 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-500/5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">AI Moment Detector</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Gemini scoring breaks down transcripts for emotional spikes, hooks, and retention to pull the 10 highest-scoring social media highlights.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 p-6 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-500/5">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-4 group-hover:bg-pink-500 group-hover:text-white transition-colors duration-300">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Viral Titles & Descriptions</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Generates exactly 20 alternative title suggestions, SEO descriptions, hooks, and tags optimized for social media algorithms.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 p-6 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-500/5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-4 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Multi-Language Captions</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Create subtitles in English, Spanish, French, German, or Hindi natively to expand reach to a global audience.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 p-6 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-500/5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:bg-cyan-500 group-hover:text-white transition-colors duration-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold mb-2">Active Batch Processing</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Offload rendering jobs to Celery queue workers to process multiple long video uploads simultaneously without lag.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} ClipForge AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
