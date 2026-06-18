'use client'

import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { 
  Zap, Video, Youtube, UploadCloud, 
  Trash2, PlayCircle, AlertTriangle, Clock, 
  ArrowRight, Shield, RefreshCw, Download, 
  Image as ImageIcon, Scissors, Info, Sparkles, HelpCircle 
} from 'lucide-react'
import { downloadFile } from '@/lib/download'

interface Project {
  id: string
  name: string
  videoUrl: string | null
  videoPath: string | null
  originalDuration: number | null
  status: string
  error: string | null
  progress: number
  createdAt: string
}

export default function DashboardPage() {
  const router = useRouter()
  
  const [projects, setProjects] = useState<Project[]>([])
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  
  // YouTube Info and Download states
  const [youtubeInfo, setYoutubeInfo] = useState<any>(null)
  const [fetchingInfo, setFetchingInfo] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  
  // Short Creation Options (YouTube)
  const [clippingMode, setClippingMode] = useState<'ai' | 'manual'>('ai')
  const [manualStartInput, setManualStartInput] = useState('0')
  const [manualStartSec, setManualStartSec] = useState(0)
  const [manualDurationType, setManualDurationType] = useState<'30' | '60' | 'custom'>('30')
  const [manualCustomDuration, setManualCustomDuration] = useState(30)
  const [aiDurationType, setAiDurationType] = useState<'30' | '60' | 'custom'>('30')
  const [aiCustomDuration, setAiCustomDuration] = useState(30)
  
  // Local Upload Clip Options
  const [uploadClippingMode, setUploadClippingMode] = useState<'ai' | 'manual'>('ai')
  const [uploadStartInput, setUploadStartInput] = useState('0')
  const [uploadStartSec, setUploadStartSec] = useState(0)
  const [uploadDurationType, setUploadDurationType] = useState<'30' | '60' | 'custom'>('30')
  const [uploadCustomDuration, setUploadCustomDuration] = useState(30)
  const [uploadAiDurationType, setUploadAiDurationType] = useState<'30' | '60' | 'custom'>('30')
  const [uploadAiCustomDuration, setUploadAiCustomDuration] = useState(30)

  // Subtitle options (default enabled)
  const [burnSubtitles, setBurnSubtitles] = useState(true)
  const [uploadBurnSubtitles, setUploadBurnSubtitles] = useState(true)

  // Custom confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null)

  const triggerConfirmation = (config: {
    title: string;
    message: string;
    confirmText: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmModalConfig(config)
    setShowConfirmModal(true)
  }

  const parseTimeToSeconds = (input: string): number => {
    if (!input) return 0
    input = input.trim()
    if (input.includes(':')) {
      const parts = input.split(':')
      let seconds = 0
      if (parts.length === 2) {
        // MM:SS
        seconds = parseInt(parts[0], 10) * 60 + parseFloat(parts[1])
      } else if (parts.length === 3) {
        // HH:MM:SS
        seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2])
      }
      return isNaN(seconds) ? 0 : seconds
    } else {
      const seconds = parseFloat(input)
      return isNaN(seconds) ? 0 : seconds
    }
  }
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const { data: session, status } = useSession()
  const userId = (session?.user as any)?.id || 'default-user'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard')
    }
  }, [status, router])

  // Fetch projects from FastAPI backend
  const fetchProjects = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/projects/user/${userId}`)
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }

  // Clear all projects for user
  const handleClearHistory = () => {
    triggerConfirmation({
      title: "Clear All History",
      message: "Are you sure you want to clear your entire clip generation history? This will delete all your projects and files from disk permanently.",
      confirmText: "Clear All",
      isDestructive: true,
      onConfirm: async () => {
        setErrorMsg('')
        try {
          const res = await fetch(`${apiBaseUrl}/projects/user/${userId}/clear`, {
            method: 'DELETE'
          })
          if (res.ok) {
            setProjects([])
          } else {
            setErrorMsg('Failed to clear project history.')
          }
        } catch (err) {
          setErrorMsg('Failed to connect to backend server.')
        }
      }
    })
  }

  useEffect(() => {
    fetchProjects()
  }, [userId])

  // Poll active projects for progress updates
  useEffect(() => {
    const activeStates = ['PENDING', 'DOWNLOADING', 'TRANSCRIBING', 'ANALYZING', 'PROCESSING']
    const hasActiveProjects = projects.some(p => activeStates.includes(p.status))
    
    if (hasActiveProjects) {
      const interval = setInterval(() => {
        fetchProjects()
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [projects])

  // Get YouTube metadata (title, duration, thumbnail, formats) without downloading
  const handleGetYoutubeInfo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!youtubeUrl) return
    setFetchingInfo(true)
    setErrorMsg('')
    setYoutubeInfo(null)
    
    try {
      const res = await fetch(`${apiBaseUrl}/projects/youtube-info?url=${encodeURIComponent(youtubeUrl)}`)
      if (res.ok) {
        const data = await res.json()
        setYoutubeInfo(data)
        // Set default format selected
        if (data.formats && data.formats.length > 0) {
          setSelectedFormat(data.formats[0].format_id)
        }
      } else {
        const errorData = await res.json()
        setErrorMsg(errorData.detail || 'Failed to fetch YouTube video details.')
      }
    } catch (err) {
      setErrorMsg('Failed to connect to backend service to fetch video details.')
    } finally {
      setFetchingInfo(false)
    }
  }

  // Handle Download full video/audio format
  const handleDownloadYoutubeFormat = () => {
    if (!youtubeUrl || !selectedFormat || !youtubeInfo) return
    
    const formatObj = youtubeInfo.formats.find((f: any) => f.format_id === selectedFormat)
    if (!formatObj) return
    
    const downloadUrl = `${apiBaseUrl}/projects/youtube-download?url=${encodeURIComponent(youtubeUrl)}&format_id=${selectedFormat}&type=${formatObj.type}`
    
    const sanitizedTitle = youtubeInfo.title.replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/\s+/g, '_')
    const fileType = formatObj.type === 'audio' ? 'audio' : 'video'
    const extension = formatObj.type === 'audio' ? 'mp3' : 'mp4'

    downloadFile({
      url: downloadUrl,
      defaultName: sanitizedTitle || 'youtube_video',
      fileType,
      extension,
      onStart: () => setIsDownloading(true),
      onEnd: () => setIsDownloading(false),
      onError: (err) => {
        console.error(err)
        setErrorMsg('Failed to download YouTube format file.')
        setIsDownloading(false)
      }
    })
  }

  // Submit YouTube URL to start a short generation project
  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!youtubeUrl || !youtubeInfo) return
    setIsSubmitting(true)
    setErrorMsg('')
    
    try {
      const formData = new FormData()
      formData.append('name', youtubeInfo.title)
      formData.append('videoUrl', youtubeUrl)
      formData.append('userId', userId)
      formData.append('clippingMode', clippingMode)
      formData.append('burnSubtitles', burnSubtitles ? 'true' : 'false')
      
      if (clippingMode === 'manual') {
        const duration = manualDurationType === 'custom' ? manualCustomDuration : parseInt(manualDurationType)
        formData.append('manualStart', manualStartSec.toString())
        formData.append('manualEnd', (manualStartSec + duration).toString())
        formData.append('targetDuration', duration.toString())
      } else {
        const duration = aiDurationType === 'custom' ? aiCustomDuration : parseInt(aiDurationType)
        formData.append('targetDuration', duration.toString())
      }

      const res = await fetch(`${apiBaseUrl}/projects/`, {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        setYoutubeUrl('')
        setYoutubeInfo(null)
        fetchProjects()
      } else {
        const errorData = await res.json()
        setErrorMsg(errorData.detail || 'Failed to submit YouTube video.')
      }
    } catch (err) {
      setErrorMsg('Failed to connect to backend service.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle local video file upload with AI/Manual Options
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsSubmitting(true)
    setErrorMsg('')
    setUploadProgress(0)
    
    const formData = new FormData()
    formData.append('name', file.name.split('.')[0])
    formData.append('userId', userId)
    formData.append('file', file)
    formData.append('clippingMode', uploadClippingMode)
    formData.append('burnSubtitles', uploadBurnSubtitles ? 'true' : 'false')
    
    if (uploadClippingMode === 'manual') {
      const duration = uploadDurationType === 'custom' ? uploadCustomDuration : parseInt(uploadDurationType)
      formData.append('manualStart', uploadStartSec.toString())
      formData.append('manualEnd', (uploadStartSec + duration).toString())
      formData.append('targetDuration', duration.toString())
    } else {
      const duration = uploadAiDurationType === 'custom' ? uploadAiCustomDuration : parseInt(uploadAiDurationType)
      formData.append('targetDuration', duration.toString())
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${apiBaseUrl}/projects/upload`)
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        setUploadProgress(percent)
      }
    }

    xhr.onload = () => {
      setIsSubmitting(false)
      setUploadProgress(null)
      if (xhr.status === 200 || xhr.status === 201) {
        fetchProjects()
      } else {
        setErrorMsg('Failed to upload video file.')
      }
    }

    xhr.onerror = () => {
      setIsSubmitting(false)
      setUploadProgress(null)
      setErrorMsg('Network error occurred during file upload.')
    }

    xhr.send(formData)
  }

  const handleDeleteProject = (projectId: string) => {
    triggerConfirmation({
      title: "Delete Project",
      message: "Are you sure you want to delete this project? This will permanently wipe all generated video clips.",
      confirmText: "Delete",
      isDestructive: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`${apiBaseUrl}/projects/${projectId}`, {
            method: 'DELETE'
          })
          if (res.ok) {
            setProjects(projects.filter(p => p.id !== projectId))
          }
        } catch (err) {
          console.error('Delete failed:', err)
        }
      }
    })
  }

  const isAdmin = true

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mr-3" />
        <span>Loading session...</span>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Background radial effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center">
              <Zap className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-display font-bold text-white">
              ClipForge <span className="text-indigo-400">AI</span>
            </span>
          </Link>
          
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <div className="flex items-center space-x-2 bg-slate-900/65 border border-slate-900/80 px-3.5 py-1.5 rounded-xl backdrop-blur-md">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center text-[10px] font-bold uppercase select-none">
                    {session.user?.email?.[0] || session.user?.name?.[0] || 'U'}
                  </div>
                  <span className="text-xs font-semibold text-slate-300">
                    {session.user?.email || session.user?.name || 'Signed In'}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-900/80 border border-slate-850 hover:border-slate-800 rounded-xl active:scale-[0.97] cursor-pointer transition-all duration-200"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:-translate-y-0.5 active:translate-y-0 rounded-xl shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/30 transition-all duration-200"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-10 z-10">
        
        {/* Left / Input column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl backdrop-blur-xl space-y-6">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Create New Short</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Paste a link to view options or slice vertical shorts instantly.
              </p>
            </div>
            
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {/* YouTube input form */}
            {!youtubeInfo && (
              <form onSubmit={handleGetYoutubeInfo} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    YouTube Video Link
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <Youtube className="w-4 h-4 text-red-500" />
                    </span>
                    <input
                      type="url"
                      required
                      value={youtubeUrl}
                      onChange={(e) => {
                        setYoutubeUrl(e.target.value)
                        setYoutubeInfo(null)
                      }}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-slate-950/80 border border-slate-850 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={fetchingInfo || !youtubeUrl}
                  className="w-full flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] active:translate-y-[0.5px] cursor-pointer text-sm font-bold text-white rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fetchingInfo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Fetching Video Info...</span>
                    </>
                  ) : (
                    <>
                      <Youtube className="w-4 h-4" />
                      <span>Get YouTube Video</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* YouTube Video Info Preview and Controls */}
            {youtubeInfo && (
              <div className="space-y-6 text-left">
                {/* Preview Card */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/40">
                  <img 
                    src={youtubeInfo.thumbnail} 
                    alt={youtubeInfo.title}
                    className="w-full h-44 object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-slate-350">
                    {Math.floor(youtubeInfo.duration / 60)}m {youtubeInfo.duration % 60}s
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-sm text-slate-200 line-clamp-2 leading-snug">
                      {youtubeInfo.title}
                    </h3>
                  </div>
                </div>

                {/* Section 1: Downloads */}
                <div className="space-y-3 p-4 bg-slate-950/60 border border-slate-900 rounded-2xl">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">1. Download Option</span>
                  <div className="flex gap-2">
                    <select
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-850 text-slate-200 text-xs font-semibold rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500"
                    >
                      {youtubeInfo.formats.map((f: any) => (
                        <option key={f.format_id} value={f.format_id}>
                          {f.note}
                        </option>
                      ))}
                    </select>
                      <button
                        onClick={handleDownloadYoutubeFormat}
                        disabled={isDownloading}
                        className="px-3 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 active:scale-[0.95] active:translate-y-[0.5px] cursor-pointer text-slate-350 hover:text-white rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download Format"
                      >
                        {isDownloading ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" /> : <Download className="w-4 h-4" />}
                      </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!youtubeInfo) return
                      const sanitizedTitle = youtubeInfo.title.replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/\s+/g, '_')
                      downloadFile({
                        url: `${apiBaseUrl}/projects/youtube-thumbnail?videoId=${youtubeInfo.id}`,
                        defaultName: `${sanitizedTitle}_thumbnail`,
                        fileType: 'image',
                        extension: 'jpg',
                        onError: (err) => {
                          console.error(err)
                          setErrorMsg('Failed to download YouTube thumbnail image.')
                        }
                      })
                    }}
                    className="w-full flex items-center justify-center space-x-1.5 py-2 bg-slate-900 border border-slate-850 hover:border-slate-800 text-[11px] font-bold text-slate-350 hover:text-white rounded-xl transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Download HD Thumbnail (.jpg)</span>
                  </button>
                </div>

                {/* Section 2: Get Short options */}
                <div className="space-y-4 p-4 bg-slate-950/60 border border-slate-900 rounded-2xl">
                  <div className="flex items-center justify-between border-b border-slate-905 pb-2">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">2. Get Short / Clip</span>
                    <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-850">
                        <button
                          onClick={() => setClippingMode('ai')}
                          className={`text-[9px] font-bold px-2.5 py-1 rounded-md transition-all active:scale-[0.95] cursor-pointer ${
                            clippingMode === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-450 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          AI Auto
                        </button>
                        <button
                          onClick={() => setClippingMode('manual')}
                          className={`text-[9px] font-bold px-2.5 py-1 rounded-md transition-all active:scale-[0.95] cursor-pointer ${
                            clippingMode === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-450 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          Manual
                        </button>
                    </div>
                  </div>

                  {clippingMode === 'ai' ? (
                    <div className="space-y-3 text-left">
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        AI will analyze the audio transcript using Gemini to extract the most engaging shorts automatically.
                      </p>
                      <div className="grid grid-cols-1 gap-2.5">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Target Short Duration</label>
                          <select
                            value={aiDurationType}
                            onChange={(e) => setAiDurationType(e.target.value as any)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl py-1.5 px-3 focus:outline-none"
                          >
                            <option value="30">30 seconds</option>
                            <option value="60">60 seconds</option>
                            <option value="custom">Custom...</option>
                          </select>
                        </div>
                        {aiDurationType === 'custom' && (
                          <div>
                            <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Custom Duration (sec)</label>
                            <input
                              type="number"
                              min="5"
                              max="180"
                              value={aiCustomDuration}
                              onChange={(e) => setAiCustomDuration(Math.max(1, parseInt(e.target.value) || 0))}
                              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs text-white"
                            />
                          </div>
                        )}
                      </div>

                      {/* Burn Subtitles Toggle */}
                      <div className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          id="burnSubtitlesAI"
                          checked={burnSubtitles}
                          onChange={(e) => setBurnSubtitles(e.target.checked)}
                          className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                        />
                        <label htmlFor="burnSubtitlesAI" className="text-xs font-semibold text-slate-300 select-none cursor-pointer">
                          Auto Subtitles / Captions
                        </label>
                      </div>

                        <button
                          onClick={handleYoutubeSubmit}
                          disabled={isSubmitting}
                          className="w-full flex items-center justify-center space-x-2 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] active:translate-y-[0.5px] cursor-pointer text-xs font-bold text-white rounded-xl shadow-lg hover:shadow-indigo-600/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>Generate AI Suggested Shorts</span>
                        </button>
                    </div>
                  ) : (
                    <div className="space-y-3 text-left">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Start Time (e.g. 1:30 or 90)</label>
                          <input
                            type="text"
                            placeholder="e.g. 1:30 or 90"
                            value={manualStartInput}
                            onChange={(e) => {
                              const val = e.target.value
                              setManualStartInput(val)
                              setManualStartSec(parseTimeToSeconds(val))
                            }}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Duration</label>
                          <select
                            value={manualDurationType}
                            onChange={(e) => setManualDurationType(e.target.value as any)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl py-1.5 px-3 focus:outline-none"
                          >
                            <option value="30">30 seconds</option>
                            <option value="60">60 seconds</option>
                            <option value="custom">Custom...</option>
                          </select>
                        </div>
                      </div>

                      {manualDurationType === 'custom' && (
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Custom Duration (sec)</label>
                          <input
                            type="number"
                            min="5"
                            max="180"
                            value={manualCustomDuration}
                            onChange={(e) => setManualCustomDuration(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl py-1.5 px-3 text-xs text-white"
                          />
                        </div>
                      )}

                      {/* Burn Subtitles Toggle */}
                      <div className="flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          id="burnSubtitlesManual"
                          checked={burnSubtitles}
                          onChange={(e) => setBurnSubtitles(e.target.checked)}
                          className="w-4 h-4 rounded bg-slate-950 border-slate-805 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                        />
                        <label htmlFor="burnSubtitlesManual" className="text-xs font-semibold text-slate-300 select-none cursor-pointer">
                          Auto Subtitles / Captions
                        </label>
                      </div>

                        <button
                          onClick={handleYoutubeSubmit}
                          disabled={isSubmitting || manualStartSec >= youtubeInfo.duration}
                          className="w-full flex items-center justify-center space-x-2 py-2.5 bg-violet-600 hover:bg-violet-500 active:scale-[0.98] active:translate-y-[0.5px] cursor-pointer text-xs font-bold text-white rounded-xl shadow-lg hover:shadow-violet-600/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                          <span>Generate Manual Short</span>
                        </button>
                    </div>
                  )}
                </div>

                {/* Cancel / Reset Button */}
                <button
                  onClick={() => setYoutubeInfo(null)}
                  className="w-full text-center text-slate-500 hover:text-slate-400 active:scale-[0.98] cursor-pointer text-xs font-semibold hover:underline transition-colors duration-200"
                >
                  Change Video Link
                </button>
              </div>
            )}

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-900"></div>
              <span className="flex-shrink mx-4 text-slate-550 text-[10px] font-bold uppercase tracking-wider">Or Upload File</span>
              <div className="flex-grow border-t border-slate-900"></div>
            </div>

            {/* Direct video file upload with AI/Manual controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">File Processing Option</span>
                <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-850">
                  <button
                    onClick={() => setUploadClippingMode('ai')}
                    className={`text-[9px] font-bold px-2 py-1 rounded-md transition-all active:scale-[0.95] cursor-pointer ${
                      uploadClippingMode === 'ai' ? 'bg-indigo-600 text-white' : 'text-slate-450 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    AI Suggested
                  </button>
                  <button
                    onClick={() => setUploadClippingMode('manual')}
                    className={`text-[9px] font-bold px-2 py-1 rounded-md transition-all active:scale-[0.95] cursor-pointer ${
                      uploadClippingMode === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-450 hover:text-slate-200 hover:bg-slate-800/40'
                    }`}
                  >
                    Manual Slice
                  </button>
                </div>
              </div>

              {uploadClippingMode === 'ai' && (
                <div className="grid grid-cols-1 gap-2 text-left bg-slate-950/40 p-3 rounded-2xl border border-slate-900">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">AI Shorts Duration</label>
                    <select
                      value={uploadAiDurationType}
                      onChange={(e) => setUploadAiDurationType(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-850 text-slate-200 text-xs rounded-lg py-1 px-2 focus:outline-none"
                    >
                      <option value="30">30 seconds</option>
                      <option value="60">60 seconds</option>
                      <option value="custom">Custom...</option>
                    </select>
                  </div>
                  {uploadAiDurationType === 'custom' && (
                    <div className="mt-2">
                      <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Custom Duration (sec)</label>
                      <input
                        type="number"
                        min="1"
                        value={uploadAiCustomDuration}
                        onChange={(e) => setUploadAiCustomDuration(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-slate-850 rounded-lg py-1 px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {uploadClippingMode === 'manual' && (
                <div className="grid grid-cols-2 gap-2 text-left bg-slate-950/40 p-3 rounded-2xl border border-slate-900">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Start (e.g. 1:30 or 90)</label>
                    <input
                      type="text"
                      placeholder="e.g. 1:30 or 90"
                      value={uploadStartInput}
                      onChange={(e) => {
                        const val = e.target.value
                        setUploadStartInput(val)
                        setUploadStartSec(parseTimeToSeconds(val))
                      }}
                      className="w-full bg-slate-900 border border-slate-850 rounded-lg py-1 px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Duration</label>
                    <select
                      value={uploadDurationType}
                      onChange={(e) => setUploadDurationType(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-850 text-slate-200 text-xs rounded-lg py-1 px-2 focus:outline-none"
                    >
                      <option value="30">30s</option>
                      <option value="60">60s</option>
                      <option value="custom">Custom...</option>
                    </select>
                  </div>
                  {uploadDurationType === 'custom' && (
                    <div className="col-span-2 mt-2">
                      <label className="block text-[9px] font-bold text-slate-450 uppercase mb-1">Custom Duration (sec)</label>
                      <input
                        type="number"
                        min="1"
                        value={uploadCustomDuration}
                        onChange={(e) => setUploadCustomDuration(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-slate-850 rounded-lg py-1 px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Local File Subtitle Toggle */}
              <div className="flex items-center space-x-2 py-1.5 bg-slate-950/40 px-3.5 py-2.5 rounded-2xl border border-slate-900 text-left mb-3">
                <input
                  type="checkbox"
                  id="uploadBurnSubtitles"
                  checked={uploadBurnSubtitles}
                  onChange={(e) => setUploadBurnSubtitles(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                />
                <label htmlFor="uploadBurnSubtitles" className="text-xs font-semibold text-slate-300 select-none cursor-pointer ml-2">
                  Auto Subtitles / Captions
                </label>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="video/mp4,video/x-m4v,video/*"
                className="hidden"
              />
              
              {uploadProgress !== null ? (
                <div className="border border-dashed border-indigo-500/30 bg-indigo-500/5 rounded-2xl p-6 text-center space-y-3">
                  <UploadCloud className="w-8 h-8 mx-auto text-indigo-400 animate-bounce" />
                  <div className="text-sm font-semibold text-slate-300">Uploading File...</div>
                  <div className="w-full bg-slate-950 rounded-full h-2">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-400">{uploadProgress}% uploaded</div>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/20 cursor-pointer rounded-2xl p-6 text-center transition-all duration-300 group"
                >
                  <UploadCloud className="w-8 h-8 mx-auto text-slate-500 group-hover:text-indigo-400 transition-colors mb-2" />
                  <div className="text-sm font-semibold text-slate-300 group-hover:text-white">Choose video file</div>
                  <div className="text-xs text-slate-500 mt-1">MP4 or standard formats up to 200MB</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right / Projects List column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-display font-bold text-white">Your Projects</h2>
            <div className="flex items-center space-x-2">
              {projects.length > 0 && (
                <button 
                  onClick={handleClearHistory}
                  className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-xl active:scale-[0.97] cursor-pointer transition-all duration-200"
                  title="Clear all project history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear History</span>
                </button>
              )}
              
              <button 
                onClick={fetchProjects}
                className="p-2.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl active:scale-[0.95] cursor-pointer transition-all duration-200"
                title="Refresh projects list"
              >
                <RefreshCw className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="bg-slate-900/20 border border-slate-900/60 rounded-3xl p-12 text-center space-y-4">
              <Video className="w-12 h-12 mx-auto text-slate-700" />
              <h3 className="text-lg font-bold text-slate-400">No projects generated yet</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Paste a YouTube video link or upload a local clip in the sidebar to start extracting viral vertical shorts!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {projects.map((project) => {
                const isActive = ['PENDING', 'DOWNLOADING', 'TRANSCRIBING', 'ANALYZING', 'PROCESSING'].includes(project.status)
                
                return (
                  <div 
                    key={project.id}
                    className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 hover:border-slate-850 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-2.5">
                        <h3 className="font-bold text-white text-base leading-snug">{project.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          project.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                          project.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                          'bg-indigo-500/10 text-indigo-400 animate-pulse'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                      
                      {project.videoUrl && (
                        <div className="text-xs text-slate-500 truncate max-w-md">
                          {project.videoUrl}
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 text-xs text-slate-400">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{project.originalDuration ? `${Math.round(project.originalDuration)}s` : 'Unknown duration'}</span>
                        </div>
                        <div>
                          {(() => {
                            const dateStr = project.createdAt.endsWith('Z') || project.createdAt.includes('+')
                              ? project.createdAt
                              : `${project.createdAt}Z`;
                            return new Date(dateStr).toLocaleDateString(undefined, { 
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                            });
                          })()}
                        </div>
                      </div>

                      {/* Display Progress Bar for Active Jobs */}
                      {isActive && (
                        <div className="w-full space-y-1.5 pt-1">
                          <div className="w-full bg-slate-950 h-1.5 rounded-full">
                            <div 
                              className="bg-gradient-to-r from-indigo-500 to-violet-500 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                            <span>Processing video...</span>
                            <span>{project.progress}%</span>
                          </div>
                        </div>
                      )}

                      {/* Display Error Message for Failed Jobs */}
                      {project.status === 'FAILED' && project.error && (
                        <div className="flex items-start space-x-1 text-xs text-red-400/90 pt-1">
                          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          <span>Error: {project.error}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end space-x-2">
                      {project.status === 'COMPLETED' ? (
                        <Link
                          href={`/projects/${project.id}`}
                          className="flex items-center space-x-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97] cursor-pointer text-sm font-bold text-white rounded-xl transition-all duration-200 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25"
                        >
                          <span>Open Editor</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="px-4 py-2 bg-slate-900 border border-slate-950 text-sm font-bold text-slate-600 rounded-xl cursor-not-allowed"
                        >
                          Processing
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="p-2.5 text-slate-500 hover:text-red-400 bg-slate-950 hover:bg-red-500/10 rounded-xl border border-slate-900 hover:border-red-500/20 active:scale-[0.95] cursor-pointer transition-all duration-200"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Custom Confirmation Modal */}
      {showConfirmModal && confirmModalConfig && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl scale-100 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-display font-bold text-white">
                {confirmModalConfig.title}
              </h3>
            </div>
            
            <p className="text-xs text-slate-450 leading-relaxed">
              {confirmModalConfig.message}
            </p>
            
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false)
                  setConfirmModalConfig(null)
                }}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-950/50 hover:bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModalConfig.onConfirm()
                  setShowConfirmModal(false)
                  setConfirmModalConfig(null)
                }}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all cursor-pointer ${
                  confirmModalConfig.isDestructive
                    ? 'bg-red-600 hover:bg-red-500 shadow-md shadow-red-600/10'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/10'
                }`}
              >
                {confirmModalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
