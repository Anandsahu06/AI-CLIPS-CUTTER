'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  Shield, ArrowLeft, Users, Video, Download, 
  Settings, Zap, RefreshCw, BarChart2, CheckCircle, 
  Clock, AlertTriangle 
} from 'lucide-react'

interface Metrics {
  totalUsers: number
  totalProjects: number
  totalClipsGenerated: number
  totalDownloads: number
  activeJobs: number
}

interface PopularClip {
  id: string
  title: string
  score: number
  downloads: number
}

interface DashboardData {
  metrics: Metrics
  projectStatusBreakdown: Record<string, number>
  popularClips: PopularClip[]
}

export default function AdminPage() {
  const router = useRouter()
  
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      const res = await fetch(`${apiBaseUrl}/analytics/dashboard`)
      if (res.ok) {
        const result = await res.json()
        setData(result)
      } else {
        setError('Failed to fetch admin telemetry.')
      }
    } catch (err) {
      setError('Could not connect to the analytics microservice.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mr-3" />
        <span>Loading admin metrics...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-4">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm font-semibold">{error || 'Access Denied.'}</p>
        <Link href="/dashboard" className="px-4 py-2 bg-slate-900 border border-slate-800 text-xs font-bold text-white rounded-xl">
          Return to Dashboard
        </Link>
      </div>
    )
  }

  const { metrics, projectStatusBreakdown, popularClips } = data

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard" 
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4.5 h-4.5" />
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center space-x-2 text-indigo-400">
              <Shield className="w-4.5 h-4.5" />
              <span className="text-sm font-display font-bold text-white">System Admin Console</span>
            </div>
          </div>
          
          <button 
            onClick={fetchDashboardData}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-850 rounded-lg transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Stats</span>
          </button>
        </div>
      </header>

      {/* Admin Panel Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-10 z-10">
        
        {/* Row 1: Metrics Grid */}
        <section>
          <h2 className="text-lg font-display font-bold text-white mb-5 flex items-center gap-2">
            <BarChart2 className="w-4.5 h-4.5 text-indigo-400" />
            <span>System Performance Metrics</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {/* Card 1 */}
            <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Total Users</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-display font-extrabold text-white">{metrics.totalUsers}</div>
              <div className="text-[10px] text-slate-500 mt-1">Registered accounts</div>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Videos Submitted</span>
                <Video className="w-4 h-4 text-violet-400" />
              </div>
              <div className="text-2xl font-display font-extrabold text-white">{metrics.totalProjects}</div>
              <div className="text-[10px] text-slate-500 mt-1">Processed pipelines</div>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Shorts Generated</span>
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-display font-extrabold text-white">{metrics.totalClipsGenerated}</div>
              <div className="text-[10px] text-slate-500 mt-1">Cut & captioned</div>
            </div>

            {/* Card 4 */}
            <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Downloads logged</span>
                <Download className="w-4 h-4 text-pink-400" />
              </div>
              <div className="text-2xl font-display font-extrabold text-white">{metrics.totalDownloads}</div>
              <div className="text-[10px] text-slate-500 mt-1">Exports to social channels</div>
            </div>

            {/* Card 5 */}
            <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-3 text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Active Workers</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-display font-extrabold text-white">{metrics.activeJobs}</div>
              <div className="text-[10px] text-slate-500 mt-1">Processing queues</div>
            </div>
          </div>
        </section>

        {/* Row 2: Status breakdown and Popular clips split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Status Breakdown card */}
          <section className="bg-slate-900/30 border border-slate-900 p-6 rounded-3xl backdrop-blur-xl text-left">
            <h3 className="text-base font-display font-bold text-white mb-5 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-indigo-400" />
              <span>Job Status Distribution</span>
            </h3>
            
            <div className="space-y-4">
              {['COMPLETED', 'FAILED', 'PROCESSING', 'DOWNLOADING', 'TRANSCRIBING'].map((status) => {
                const count = projectStatusBreakdown[status] || 0
                const percent = metrics.totalProjects > 0 ? (count / metrics.totalProjects) * 100 : 0
                
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>{status}</span>
                      <span className="text-slate-450">{count} ({Math.round(percent)}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          status === 'COMPLETED' ? 'bg-emerald-500' :
                          status === 'FAILED' ? 'bg-red-500' :
                          'bg-indigo-500'
                        }`} 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Popular Clips table */}
          <section className="bg-slate-900/30 border border-slate-900 p-6 rounded-3xl backdrop-blur-xl text-left">
            <h3 className="text-base font-display font-bold text-white mb-5 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              <span>Trending Shorts Export Leaderboard</span>
            </h3>

            {popularClips.length === 0 ? (
              <div className="text-slate-600 text-xs py-10 text-center">No downloads logged yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-900 pb-2">
                      <th className="text-left font-semibold pb-2.5">Short Clip Title</th>
                      <th className="text-center font-semibold pb-2.5">Virality Rating</th>
                      <th className="text-right font-semibold pb-2.5">Downloads Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    {popularClips.map((clip) => (
                      <tr key={clip.id} className="text-slate-300 hover:bg-slate-900/20">
                        <td className="py-3 font-semibold text-slate-200 truncate max-w-[180px]">{clip.title}</td>
                        <td className="py-3 text-center">
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-450 font-bold">
                            {clip.score}%
                          </span>
                        </td>
                        <td className="py-3 text-right font-bold text-white">{clip.downloads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}
