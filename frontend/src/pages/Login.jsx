import React, { useState, useContext } from 'react'
import { AuthContext } from '../App'
import { Lock, User, ShieldAlert, Phone } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { refreshAuth } = useContext(AuthContext)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Please fill in all fields')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (res.ok) {
        toast.success('Logged in successfully!')
        await refreshAuth()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Invalid credentials. Please try again.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Connection failed. Please ensure the server is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 min-h-screen bg-slate-950 flex flex-col relative overflow-hidden pb-16">
      {/* Background radial effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="flex-grow flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
          <div className="flex justify-center">
            <div className="bg-brand-500/10 p-3 rounded-2xl border border-brand-500/20">
              <ShieldAlert className="w-10 h-10 text-brand-400" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
            Staff Console Login
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Access HR KPI statistics & system administration
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
          <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-4 border border-slate-800 shadow-2xl rounded-2xl sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-300">
                  Username
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    name="username"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-xl bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                    placeholder="admin"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    name="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-xl bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Verifying...' : 'Sign In'}
                </button>
              </div>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-6 text-center">
              <a href="/" className="text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors">
                &larr; Back to Appraisal Portal
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Developer Contact Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/60 backdrop-blur-md border-t border-slate-800/80 shadow-[0_-8px_30px_rgba(0,0,0,0.3)] py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p className="font-semibold text-slate-300">Contact me for your software</p>
          <div className="flex items-center gap-4">
            <a href="tel:07014704943" className="inline-flex items-center gap-1.5 hover:text-brand-400 transition-colors font-medium">
              <Phone className="w-3.5 h-3.5 text-brand-500" />
              07014704943
            </a>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <a href="https://x.com/NijaDeveloper" target="_blank" rel="noopener noreferrer" className="hover:text-brand-400 transition-colors font-medium">
              NijaDeveloper
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
