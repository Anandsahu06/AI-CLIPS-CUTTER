'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { 
  Zap, ArrowLeft, Download, RefreshCw, AlertCircle, Image as ImageIcon
} from 'lucide-react'
import { downloadFile } from '@/lib/download'

interface Clip {
  id: string
  projectId: string
  title: string
  start: number
  end: number
  duration: number
  score: number
  videoPath: string | null
  thumbnailPath: string | null
  status: string
}

interface Project {
  id: string
  name: string
  videoUrl: string | null
  videoPath: string | null
  originalDuration: number | null
  status: string
  clips: Clip[]
}

export default function ProjectWorkspacePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null)
  const videoPlayerRef = useRef<HTMLVideoElement>(null)
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null)

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const fetchProjectData = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data)
        
        // Auto-select first clip if none selected
        if (data.clips && data.clips.length > 0) {
          if (!selectedClip) {
            setSelectedClip(data.clips[0])
          } else {
            const updated = data.clips.find((c: Clip) => c.id === selectedClip.id)
            if (updated) {
              setSelectedClip(updated)
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load project details:', err)
    }
  }

  useEffect(() => {
    fetchProjectData()
  }, [projectId])

  // Poll project details if any clips are rendering/processing
  useEffect(() => {
    if (!project?.clips) return
    const hasRenderingClips = project.clips.some(c => c.status === 'PENDING' || c.status === 'PROCESSING')
    
    if (hasRenderingClips) {
      const interval = setInterval(() => {
        fetchProjectData()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [project])

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mr-3" />
        <span>Loading workspace data...</span>
      </div>
    )
  }

  const selectClip = (clip: Clip) => {
    setSelectedClip(clip)
  }

  const handleDownloadClip = async (clipId: string, format: string) => {
    if (!selectedClip) return
    try {
      await fetch(`${apiBaseUrl}/analytics/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId, platform: format })
      })
    } catch (err) {
      console.error(err)
    }

    const sanitizedTitle = selectedClip.title.replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/\s+/g, '_')

    downloadFile({
      url: `${apiBaseUrl}/clips/${clipId}/download`,
      defaultName: sanitizedTitle || 'vertical_short_clip',
      fileType: 'video',
      extension: 'mp4',
      onStart: () => setDownloadingClipId(clipId),
      onEnd: () => setDownloadingClipId(null),
      onError: (err) => {
        console.error(err)
        alert('Failed to download vertical short clip.')
        setDownloadingClipId(null)
      }
    })
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md h-14 shrink-0 flex items-center justify-between px-6 z-20">
        <div className="flex items-center space-x-4">
          <Link 
            href="/dashboard" 
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <h1 className="font-display font-bold text-white text-sm truncate max-w-sm">
            {project.name}
          </h1>
        </div>
        
        <div className="flex items-center space-x-3 text-xs text-slate-400">
          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-850 font-semibold">
            {project.clips.length} Short Clip{project.clips.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* Workspace Split-Pane */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Clip Selection list (Only shown if more than 1 clip exists) */}
        {project.clips && project.clips.length > 1 && (
          <aside className="w-80 border-r border-slate-900 flex flex-col bg-slate-950 shrink-0">
            <div className="p-4 border-b border-slate-900">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suggested Clips</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {project.clips.map((clip) => {
                const isSelected = selectedClip?.id === clip.id
                return (
                  <div
                    key={clip.id}
                    onClick={() => selectClip(clip)}
                    className={`p-3.5 rounded-2xl cursor-pointer transition-all border text-left ${
                      isSelected 
                        ? 'bg-indigo-600/10 border-indigo-500/50 shadow-md shadow-indigo-500/5' 
                        : 'bg-slate-900/20 border-slate-900/60 hover:bg-slate-900/40 hover:border-slate-850'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className="font-bold text-slate-200 text-sm line-clamp-1 flex-1 leading-snug">
                        {clip.title}
                      </h4>
                    </div>
                    
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Duration: {Math.round(clip.duration)}s</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                        clip.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                        clip.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                        'bg-indigo-500/10 text-indigo-400 animate-pulse'
                      }`}>
                        {clip.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </aside>
        )}

        {/* Center: Video Preview and Downloads */}
        <section className="flex-grow bg-slate-950/60 flex flex-col items-center p-6 overflow-y-auto justify-start py-8">
          {selectedClip ? (
            <div className="w-full max-w-md flex flex-col items-center justify-center space-y-6">
              
              {/* Vertical 9:16 Video Box */}
              <div className="w-[270px] h-[40vh] min-h-[340px] max-h-[480px] aspect-[9/16] bg-slate-900 border border-slate-900 rounded-3xl overflow-hidden shadow-2xl relative">
                {selectedClip.status === 'COMPLETED' && selectedClip.videoPath ? (
                  <video
                    ref={videoPlayerRef}
                    src={`${apiBaseUrl}/media/clips/${selectedClip.id}.mp4`}
                    controls
                    className="w-full h-full object-cover"
                  />
                ) : selectedClip.status === 'FAILED' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-2">
                    <AlertCircle className="w-10 h-10 text-red-400" />
                    <h5 className="font-bold text-white text-sm">Rendering Failed</h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Something went wrong while reframing this clip. Check backend console logs.
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-900/80 backdrop-blur-sm">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                    <h5 className="font-bold text-white text-sm">Rendering Short...</h5>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-[200px]">
                      Smart face tracking and vertical editing process is active. Takes about 1-2 minutes.
                    </p>
                  </div>
                )}
              </div>

              {/* Exports / Download Panel */}
              <div className="w-full space-y-3 bg-slate-900/50 border border-slate-900 p-4 rounded-2xl backdrop-blur-xl">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 text-left">Export Clip</h3>
                
                <button
                  type="button"
                  onClick={() => handleDownloadClip(selectedClip.id, 'shorts')}
                  disabled={selectedClip.status !== 'COMPLETED' || downloadingClipId === selectedClip.id}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    {downloadingClipId === selectedClip.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{downloadingClipId === selectedClip.id ? 'Downloading Clip...' : 'Download Vertical MP4 (1080p)'}</span>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">Short Video</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedClip) return
                    const sanitizedTitle = selectedClip.title.replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/\s+/g, '_')
                    downloadFile({
                      url: `${apiBaseUrl}/clips/${selectedClip.id}/thumbnail`,
                      defaultName: `${sanitizedTitle}_thumbnail`,
                      fileType: 'image',
                      extension: 'png',
                      onError: (err) => {
                        console.error(err)
                        alert('Failed to download thumbnail image.')
                      }
                    })
                  }}
                  disabled={selectedClip.status !== 'COMPLETED'}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 border border-slate-850 hover:border-slate-800 text-xs font-bold text-slate-350 hover:text-white rounded-xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4" />
                    <span>Download Thumbnail PNG</span>
                  </div>
                  <span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded text-slate-500">Image</span>
                </button>
              </div>

            </div>
          ) : (
            <div className="text-slate-550 text-sm font-semibold">
              No clips generated for this project.
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
