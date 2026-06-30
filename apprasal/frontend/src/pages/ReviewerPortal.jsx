import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../App'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { 
  Key, UserCheck, Users, Shield, 
  CheckCircle2, ChevronRight, ChevronLeft,
  HelpCircle, LogOut, Award, CheckSquare, Info 
} from 'lucide-react'

export default function ReviewerPortal() {
  const { authState, refreshAuth } = useContext(AuthContext)
  const navigate = useNavigate()

  // General States
  const [code, setCode] = useState('')
  const [voterId, setVoterId] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [loading, setLoading] = useState(false)

  // Evaluation States
  const [selectedColleagueId, setSelectedColleagueId] = useState(null)
  const [ratings, setRatings] = useState({}) // { colleagueId: { kpiId: score } }
  const [activeKpiIndex, setActiveKpiIndex] = useState(0)
  const [submittingAppraisal, setSubmittingAppraisal] = useState(false)
  const [successSubmitted, setSuccessSubmitted] = useState(false)

  // SCREEN 2 QUERY: Fetch department name, period name, and pending employees roster.
  // Only needs the access code — runs before the voter selects their identity.
  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ['reviewerRoster', authState.is_reviewer],
    queryFn: async () => {
      const res = await fetch('/api/reviewer/roster')
      if (!res.ok) throw new Error('Failed to fetch roster')
      return await res.json()
    },
    enabled: authState.is_reviewer && authState.voter_id === 0,
  })

  // SCREEN 3 QUERY: Fetch colleagues + KPIs for the evaluation console.
  // Requires both the access code AND a selected voter identity.
  const { data: sessionData, isLoading: pageLoading } = useQuery({
    queryKey: ['reviewerData', authState.voter_id],
    queryFn: async () => {
      const res = await fetch('/api/reviewer/data')
      if (!res.ok) throw new Error('Failed to fetch reviewer data')
      return await res.json()
    },
    enabled: authState.is_reviewer && authState.voter_id > 0,
  })

  useEffect(() => {
    if (sessionData?.colleagues?.length > 0 && !selectedColleagueId) {
      setSelectedColleagueId(sessionData.colleagues[0].id)
    }
    // Reset KPI carousel to first slide when switching peer
    setActiveKpiIndex(0)
  }, [sessionData, selectedColleagueId])

  // 1. Submit Access Code
  const handleVerifyCode = async (e) => {
    e.preventDefault()
    if (!code.trim()) {
      toast.error('Please enter your department access code')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/reviewer/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      })

      if (res.ok) {
        await refreshAuth()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Invalid department access code.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Connection failed. Please verify your server connection.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Select Name (Voter Identify)
  const handleReviewerLogin = async (e) => {
    e.preventDefault()
    if (!voterId) {
      toast.error('Please select your name from the roster')
      return
    }
    if (!agreeTerms) {
      toast.error('You must check the box to confirm you understand the anonymity policy')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/reviewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter_id: parseInt(voterId) })
      })

      if (res.ok) {
        await refreshAuth()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to select reviewer name.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // 3. Logout review session
  const handleReviewerLogout = async () => {
    try {
      await fetch('/api/reviewer/logout', { method: 'POST' })
      setRatings({})
      setSelectedColleagueId(null)
      await refreshAuth()
    } catch (err) {
      console.error(err)
    }
  }

  // Handle Score Updates in Local State
  const handleSetScore = (colleagueId, kpiId, score) => {
    setRatings(prev => ({
      ...prev,
      [colleagueId]: {
        ...(prev[colleagueId] || {}),
        [kpiId]: score // score is number 1-5 or null (for N/A)
      }
    }))
  }

  // Check if a colleague is fully rated (all KPIs have a score or N/A)
  const isColleagueFullyRated = (colleagueId) => {
    if (!sessionData || !sessionData.kpis) return false
    const colleagueRatings = ratings[colleagueId] || {}
    return sessionData.kpis.every(kpi => kpi.id in colleagueRatings)
  }

  // Get count of rated colleagues
  const getRatedCount = () => {
    if (!sessionData || !sessionData.colleagues) return 0
    return sessionData.colleagues.filter(c => isColleagueFullyRated(c.id)).length
  }

  // 4. Submit Bulk Ratings Payload to Server
  const handleSubmitAppraisal = async () => {
    if (!sessionData || !sessionData.colleagues) return

    // Verify all colleagues are rated
    const unrated = (sessionData?.colleagues || []).filter(c => !isColleagueFullyRated(c.id))
    if (unrated.length > 0) {
      toast.error(`Please complete ratings for all colleagues first. Unrated: ${unrated.map(u => u.name).join(', ')}`)
      return
    }

    setSubmittingAppraisal(true)

    // Format payload
    const payloadColleagues = (sessionData?.colleagues || []).map(c => {
      const colleagueRatings = ratings[c.id] || {}
      const scores = Object.keys(colleagueRatings).map(kpiId => ({
        kpi_id: parseInt(kpiId),
        score: colleagueRatings[kpiId]
      }))
      return {
        employee_id: c.id,
        scores: scores
      }
    })

    const payload = {
      period_id: authState.period_id,
      voter_id: authState.voter_id,
      colleagues: payloadColleagues
    }

    try {
      const res = await fetch('/api/reviewer/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        setSuccessSubmitted(true)
        // Clear reviewer session
        await fetch('/api/reviewer/logout', { method: 'POST' })
        await refreshAuth()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to submit appraisal cycle.')
      }
    } catch (err) {
      console.error(err)
      toast.error('Network communication failed during submission.')
    } finally {
      setSubmittingAppraisal(false)
    }
  }

  // --- RENDERING VIEWS ---

  // PAGE LOADING STATE
  if (pageLoading) {
    return (
      <div className="flex-1 min-h-screen bg-slate-950 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium animate-pulse">Loading Appraisal Portal...</p>
        </div>
      </div>
    )
  }

  // SUCCESS SUBMISSION
  if (successSubmitted) {
    return (
      <div className="flex-1 min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl text-center relative z-10">
          <div className="inline-flex items-center justify-center bg-emerald-500/10 p-3 rounded-full border border-emerald-500/20 text-emerald-400 mb-5">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Appraisal Completed!</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Thank you. Your peer evaluations have been recorded successfully. Ratings are stored anonymously and cannot be traced back to your identity.
          </p>
          <button
            onClick={() => {
              setSuccessSubmitted(false)
              navigate('/')
            }}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition-all"
          >
            Start New Session
          </button>
        </div>
      </div>
    )
  }

  // SCREEN 1: VERIFY CODE
  if (!authState.is_reviewer) {
    return (
      <div className="flex-1 min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Everight Peer Appraisals
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            A strictly anonymous feedback environment for professional development
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
          <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-6 border border-slate-800 shadow-2xl rounded-2xl sm:px-10">
            <div className="flex items-center gap-3 bg-slate-950/40 p-4 border border-slate-800 rounded-xl mb-6 text-sm text-slate-300">
              <Shield className="w-5 h-5 text-brand-400 shrink-0" />
              <span>We never link your voting credentials to the scores you submit.</span>
            </div>

            <form className="space-y-5" onSubmit={handleVerifyCode}>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Department Access Key
                </label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-700 rounded-xl bg-slate-950/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all uppercase"
                    placeholder="e.g. PATH-CURR-E3A2"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-brand-500 disabled:opacity-50 transition-all"
              >
                {loading ? 'Verifying Key...' : 'Access Portal'}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-6 text-center">
              <a href="/login" className="text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors">
                Staff Admin Login &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // SCREEN 2: SELECT IDENTITY
  if (authState.is_reviewer && authState.voter_id === 0) {
    const pendingEmployees = rosterData?.pending_employees || []

    return (
      <div className="flex-1 min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Identify Yourself
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Select your name to sign into the <strong className="text-slate-300 font-semibold">{rosterData?.department_name || 'Department'}</strong> appraisal cycle <strong className="text-slate-300 font-semibold">({rosterData?.period_name || 'Active Cycle'})</strong>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
          <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-6 border border-slate-800 shadow-2xl rounded-2xl sm:px-10">
            <form className="space-y-5" onSubmit={handleReviewerLogin}>

              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Select Your Name
                </label>
                {rosterLoading ? (
                  <div className="mt-1 flex items-center gap-2 text-slate-400 text-sm py-2.5">
                    <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading roster...
                  </div>
                ) : (
                  <select
                    value={voterId}
                    onChange={(e) => setVoterId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2.5 border border-slate-700 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all"
                  >
                    <option value="">-- Choose employee name --</option>
                    {pendingEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                )}
                {!rosterLoading && pendingEmployees.length === 0 && (
                  <p className="text-xs text-red-400 mt-2">
                    All employees in this department have completed their evaluations for this cycle.
                  </p>
                )}
              </div>

              <div className="relative flex items-start bg-slate-950/40 border border-slate-800/80 p-4 rounded-xl">
                <div className="flex h-5 items-center">
                  <input
                    id="agree"
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-brand-600 focus:ring-brand-500 focus:ring-offset-slate-900"
                  />
                </div>
                <div className="ml-3 text-xs leading-5 text-slate-300">
                  <label htmlFor="agree" className="font-medium cursor-pointer">
                    I confirm that I am selecting my own name. I understand that my scores will be recorded anonymously and cannot be traced back to me, but that my participation in this cycle will be logged.
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleReviewerLogout}
                  className="flex-1 py-2.5 px-4 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-all"
                >
                  Change Code
                </button>
                <button
                  type="submit"
                  disabled={loading || rosterLoading || pendingEmployees.length === 0}
                  className="flex-1 py-2.5 px-4 border border-transparent rounded-xl text-white bg-brand-600 hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold text-sm disabled:opacity-50 transition-all"
                >
                  {loading ? 'Entering...' : 'Start Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // SCREEN 3: APPRAISAL RATING WORKSPACE
  const currentColleague = sessionData?.colleagues?.find(c => c.id === selectedColleagueId)

  return (
    <div className="flex-1 flex flex-col bg-slate-950">
      {/* Header bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-brand-400" />
            <div>
              <h1 className="text-lg font-bold text-white">Peer appraisal console</h1>
              <p className="text-xs text-slate-400">
                Department: <strong className="text-slate-300">{sessionData?.department_name}</strong> | Cycle: <strong className="text-slate-300">{sessionData?.period_name}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400 hidden sm:inline">
              Voter: <strong className="text-slate-200">{authState.voter_name}</strong>
            </span>
            <button
              onClick={handleReviewerLogout}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Exit Session
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Left Sidebar: Colleague Roster */}
        <aside className="w-full md:w-80 shrink-0 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
              <span>Colleagues to Evaluate</span>
              <span className="text-xs font-normal text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                {getRatedCount()} / {sessionData?.colleagues?.length || 0} Rated
              </span>
            </h3>
            
            {/* List */}
            <div className="space-y-2 max-h-[350px] md:max-h-[500px] overflow-y-auto pr-1">
              {sessionData?.colleagues?.map(colleague => {
                const isRated = isColleagueFullyRated(colleague.id)
                const isSelected = colleague.id === selectedColleagueId
                return (
                  <button
                    key={colleague.id}
                    onClick={() => {
                      setSelectedColleagueId(colleague.id)
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-brand-600/10 border-brand-500/40 text-white font-medium'
                        : isRated
                          ? 'bg-emerald-950/10 border-emerald-950/20 text-emerald-200 hover:bg-slate-800/40'
                          : 'bg-slate-950 border-slate-800/60 text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${
                        isRated ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-amber-400/60'
                      }`} />
                      <span className="text-sm truncate max-w-[180px]">{colleague.name}</span>
                    </div>
                    {isRated && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                )
              })}
            </div>

            {/* Submission card */}
            <div className="mt-5 border-t border-slate-800 pt-5">
              <button
                onClick={handleSubmitAppraisal}
                disabled={submittingAppraisal || getRatedCount() !== (sessionData?.colleagues?.length || 0)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-lg transition-all"
              >
                {submittingAppraisal ? 'Submitting...' : 'Submit All Evaluations'}
              </button>
              <p className="text-[10px] text-slate-400 mt-2 text-center leading-relaxed">
                Appraisals can only be submitted once. Ensure all colleague ratings are completed.
              </p>
            </div>
          </div>
        </aside>

        {/* Center: Rating Console */}
        <main className="flex-1 min-w-0">

          {currentColleague ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-lg relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-5 mb-6 gap-3">
                <div>
                  <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Evaluating Peer</span>
                  <h2 className="text-2xl font-bold text-white">{currentColleague.name}</h2>
                </div>
                <div className="inline-flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                  <Info className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400">Score 1 (Poor) to 5 (Outstanding)</span>
                </div>
              </div>
              {(() => {
                const kpis = sessionData?.kpis || []
                const kpi = kpis[activeKpiIndex]
                if (!kpi) return null

                const colleagueRatings = ratings[selectedColleagueId] || {}
                const selectedScore = colleagueRatings[kpi.id] // 1, 2, 3, 4, 5, or undefined
                const isNA = selectedScore === null

                // Verbal rating helper
                const getVerbalLabel = (score) => {
                  switch (score) {
                    case 1: return '1 - Poor'
                    case 2: return '2 - Needs Improvement'
                    case 3: return '3 - Satisfactory'
                    case 4: return '4 - Good'
                    case 5: return '5 - Outstanding'
                    default: return 'Not Rated Yet'
                  }
                }

                // Handler to proceed to next slide
                const handleNextKpi = () => {
                  // If we are not on the last KPI, go to next index
                  if (activeKpiIndex < kpis.length - 1) {
                    setActiveKpiIndex(prev => prev + 1)
                  } else {
                    // We completed the last KPI for this colleague.
                    // Let's check if there is another colleague in the roster to switch to.
                    const currentIndex = sessionData.colleagues.findIndex(c => c.id === selectedColleagueId)
                    const nextColleague = sessionData.colleagues[currentIndex + 1]
                    if (nextColleague) {
                      setSelectedColleagueId(nextColleague.id)
                      toast.success(`Evaluated ${currentColleague.name}. Loading ${nextColleague.name}...`)
                    } else {
                      toast.success(`Completed all KPIs for ${currentColleague.name}! You can now submit appraisals.`)
                    }
                  }
                }

                return (
                  <div className="space-y-6">
                    {/* Visual Progress Steps Bar */}
                    <div className="flex items-center justify-between bg-slate-950/40 px-4 py-3 border border-slate-800 rounded-xl">
                      <span className="text-xs font-semibold text-slate-400">
                        KPI Evaluation: <strong className="text-white">{activeKpiIndex + 1}</strong> of <strong className="text-slate-300">{kpis.length}</strong>
                      </span>
                      {/* Interactive skip dots */}
                      <div className="flex gap-1.5 overflow-x-auto max-w-[200px] sm:max-w-none pr-1">
                        {kpis.map((item, dotIdx) => {
                          const isDotActive = dotIdx === activeKpiIndex
                          const hasScore = colleagueRatings[item.id] !== undefined
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveKpiIndex(dotIdx)}
                              className={`w-3.5 h-3.5 rounded-full text-[8px] font-black flex items-center justify-center border transition-all ${
                                isDotActive
                                  ? 'bg-brand-600 border-brand-400 text-white scale-110'
                                  : hasScore
                                    ? 'bg-emerald-950 border-emerald-500/40 text-emerald-400'
                                    : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700'
                              }`}
                              title={item.name}
                            >
                              {dotIdx + 1}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Active KPI Slide Card */}
                    <div className="p-5 bg-slate-950/40 border border-slate-800/80 rounded-2xl hover:border-slate-800 transition-colors shadow-inner">
                      <div className="flex flex-col gap-5">
                        
                        {/* KPI Info header */}
                        <div className="max-w-3xl">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">KPI Description</span>
                          <h4 className="text-base font-bold text-white mt-0.5">{kpi.name}</h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{kpi.description}</p>
                        </div>
                        
                        {/* Slider rating control */}
                        <div className="bg-slate-900/60 border border-slate-800/40 p-4 rounded-xl flex flex-col md:flex-row md:items-center gap-6">
                          
                          {/* Slider Track (Desktop & Mobile optimized) */}
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-semibold text-slate-400">Rate this skill</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md transition-all ${
                                isNA 
                                  ? 'bg-slate-800 text-slate-500 border border-slate-700/50' 
                                  : selectedScore 
                                    ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20' 
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              }`}>
                                {isNA ? 'N/A' : getVerbalLabel(selectedScore)}
                              </span>
                            </div>

                            <div className="relative mt-4 mb-2 px-1">
                              {/* Range input slider */}
                              <input
                                type="range"
                                min="1"
                                max="5"
                                step="1"
                                disabled={isNA}
                                value={selectedScore || 3}
                                onChange={(e) => handleSetScore(selectedColleagueId, kpi.id, parseInt(e.target.value))}
                                className={`w-full h-2 rounded-lg appearance-none cursor-pointer focus:outline-none transition-all ${
                                  isNA 
                                    ? 'bg-slate-800/50 opacity-40' 
                                    : 'bg-gradient-to-r from-brand-600 to-indigo-600'
                                }`}
                                style={{
                                  WebkitAppearance: 'none'
                                }}
                              />

                              {/* Custom slider ticks */}
                              <div className="flex justify-between mt-2.5 px-0.5 text-[10px] font-bold text-slate-500">
                                {[1, 2, 3, 4, 5].map((tick) => {
                                  const isSelected = selectedScore === tick && !isNA
                                  return (
                                    <button
                                      key={tick}
                                      type="button"
                                      onClick={() => handleSetScore(selectedColleagueId, kpi.id, tick)}
                                      className={`transition-all hover:text-slate-200 ${
                                        isSelected ? 'text-brand-400 scale-110 font-black' : ''
                                      }`}
                                    >
                                      {tick}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Quick N/A Toggle Selector Button */}
                          <div className="shrink-0 flex md:flex-col justify-end">
                            <button
                              type="button"
                              onClick={() => handleSetScore(selectedColleagueId, kpi.id, isNA ? 3 : null)}
                              className={`w-full md:w-20 py-2.5 px-4 border font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                isNA
                                  ? 'bg-slate-800 border-slate-700 text-white shadow-lg'
                                  : 'bg-slate-950 border-slate-800/80 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isNA ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}></span>
                              N/A
                            </button>
                          </div>

                        </div>
                      </div>
                    </div>

                    {/* Carousel navigation slide controls */}
                    <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-slate-800 rounded-2xl">
                      <button
                        type="button"
                        disabled={activeKpiIndex === 0}
                        onClick={() => setActiveKpiIndex(prev => prev - 1)}
                        className="inline-flex items-center gap-2 py-2 px-4 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent text-xs font-semibold transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous KPI
                      </button>

                      <button
                        type="button"
                        onClick={handleNextKpi}
                        className="inline-flex items-center gap-2 py-2 px-5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-brand-900/20"
                      >
                        {activeKpiIndex < kpis.length - 1 ? 'Next KPI' : 'Finish Rating'}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                )
              })()}

            {/* Roster traversal buttons */}
            <div className="flex justify-between border-t border-slate-800 pt-6 mt-8">
              <div>
                {isColleagueFullyRated(selectedColleagueId) && (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 py-2">
                    <CheckCircle2 className="w-4 h-4" /> Evaluated
                  </span>
                )}
              </div>
              
              <div className="flex gap-3">
                {/* Next colleague quick switcher */}
                {(() => {
                  const currentIndex = sessionData.colleagues.findIndex(c => c.id === selectedColleagueId)
                  const nextColleague = sessionData.colleagues[currentIndex + 1]
                  if (nextColleague) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedColleagueId(nextColleague.id)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-all"
                      >
                        Next Peer ({nextColleague.name})
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )
                  }
                  return null
                })()}
              </div>
            </div>
          </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
              <Users className="w-16 h-16 text-slate-600 mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">No peers found</h3>
              <p className="text-slate-400 text-sm max-w-sm">
                There are no other employees registered in your department for this cycle. Contact administration.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
