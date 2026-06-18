'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Zap, Mail, Lock, RefreshCw, AlertCircle, Eye, EyeOff } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
        callbackUrl,
      })

      if (res?.error) {
        setError('Invalid login credentials.')
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-[#1E293B]/40 border border-slate-800/80 rounded-2xl p-8 md:p-10 backdrop-blur-md w-full max-w-[420px] shadow-2xl shadow-slate-950/40 relative">
      <div className="flex flex-col items-center mb-8">
        <Link href="/" className="flex items-center space-x-2.5 mb-6 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-display font-extrabold text-white tracking-wide">
            ClipForge <span className="text-indigo-400">AI</span>
          </span>
        </Link>
        <h2 className="text-2xl font-bold text-white text-center tracking-tight">Welcome</h2>
        <p className="text-sm text-slate-400 mt-1.5 text-center">
          Sign up to your account
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider pl-0.5">
            Email Address
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
              <Mail className="w-4 h-4 text-slate-500" />
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#0F172A]/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg h-12 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all duration-200"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider pl-0.5">
              Password
            </label>
            <Link href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 pointer-events-none">
              <Lock className="w-4 h-4 text-slate-500" />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-[#0F172A]/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg h-12 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none transition-all duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-355 transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center pt-1">
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-slate-800 bg-[#0F172A] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-1 cursor-pointer"
          />
          <label htmlFor="remember-me" className="ml-2 text-xs text-slate-400 select-none cursor-pointer hover:text-slate-300 transition-colors">
            Remember me
          </label>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 h-12 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-sm font-semibold text-white rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.99] transition-all duration-150 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Signing up...</span>
              </>
            ) : (
              <span>Sign Up</span>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800/60 text-center">
        <p className="text-[11px] text-slate-500">
          <span className="font-semibold text-indigo-400/80">Demo Mode:</span> Any email/password will create an account automatically.
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
          &larr; Back to Landing Page
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-[#0F172A] text-slate-100 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background radial gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <Suspense fallback={
        <div className="bg-[#1E293B]/40 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-md w-full max-w-[420px] shadow-2xl flex items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
