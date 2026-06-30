import React, { useState, useEffect, useContext } from 'react'
import { AuthContext } from '../App'
import { useQuery } from '@tanstack/react-query'
import { 
  Users, BarChart3, TrendingUp, Calendar, ListChecks, Phone,
  LogOut, ShieldCheck, ChevronRight, Info, PieChart
} from 'lucide-react'
import KPIManager from '../components/KPIManager'

export default function HRDashboard() {
  const { authState, refreshAuth } = useContext(AuthContext)
  
  // Dashboard parameters
  const [hrTab, setHrTab] = useState('reports')
  const [selectedPeriodId, setSelectedPeriodId] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')

  // Fetch initial select filter lists
  const { data: filterData, isLoading: pageLoading } = useQuery({
    queryKey: ['hrFilters'],
    queryFn: async () => {
      const res = await fetch('/api/hr/dashboard')
      if (!res.ok) throw new Error('Failed to load HR filters')
      return await res.json()
    }
  })

  // Auto-select active cycle
  useEffect(() => {
    if (filterData?.selected_period_id && !selectedPeriodId) {
      setSelectedPeriodId(filterData.selected_period_id.toString())
    }
  }, [filterData, selectedPeriodId])

  // Fetch full aggregate metrics based on selections
  const { data: dashboardData, isLoading: metricsLoading } = useQuery({
    queryKey: ['hrMetrics', selectedPeriodId, selectedDeptId, selectedEmployeeId],
    queryFn: async () => {
      let url = `/api/hr/dashboard?period_id=${selectedPeriodId}&department_id=${selectedDeptId}`
      if (selectedEmployeeId) {
        url += `&employee_id=${selectedEmployeeId}`
      }
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load HR metrics')
      return await res.json()
    },
    enabled: !!selectedPeriodId && !!selectedDeptId
  })

  const periods = filterData?.periods || []
  const departments = filterData?.departments || []

  // Auth logout
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/logout', { method: 'POST' })
      if (res.ok) await refreshAuth()
    } catch (err) { console.error(err) }
  }

  // Handle department changes (resets selected employee)
  const handleDeptChange = (deptId) => {
    setSelectedDeptId(deptId)
    setSelectedEmployeeId('')
  }

  if (pageLoading) {
    return (
      <div className="flex-grow min-h-screen bg-slate-950 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium animate-pulse">Loading HR Statistics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-h-screen pb-16">
      {/* Top Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-brand-500" />
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white">HR Appraisal Reports</h1>
              <p className="text-xs text-slate-400">
                <span className="hidden sm:inline">Authorized Personnel: </span>
                <strong className="text-slate-300">{authState.username}</strong> ({authState.role})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {authState.role === 'admin' && (
              <a href="/admin/dashboard" className="px-2.5 py-1.5 sm:px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all">
                Admin <span className="hidden sm:inline">Panel</span>
              </a>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 border border-red-500/20 bg-red-950/20 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-950/40 hover:border-red-500/40 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1.5">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Workspace */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">

        {/* Tab Navigation */}
        <nav className="flex border-b border-slate-800 gap-6 text-sm font-semibold overflow-x-auto scrollbar-none whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: 'reports', label: 'Appraisal Reports', icon: BarChart3 },
            { id: 'kpis', label: 'KPI Settings', icon: ListChecks },
          ].map(tab => {
            const Icon = tab.icon
            const isSelected = hrTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setHrTab(tab.id)}
                className={`flex items-center gap-2 pb-4 border-b-2 transition-all shrink-0 ${
                  isSelected ? 'border-brand-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* TAB: KPI SETTINGS */}
        {hrTab === 'kpis' && (
          <KPIManager />
        )}

        {/* TAB: REPORTS */}
        {hrTab === 'reports' && (
        <>
        
        {/* Filters Top Bar */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 shrink-0">
            <Info className="w-4 h-4 text-brand-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Report Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <div>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              >
                <option value="">Choose Appraisal Cycle...</option>
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={selectedDeptId}
                onChange={(e) => handleDeptChange(e.target.value)}
                className="block w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              >
                <option value="">Choose Department...</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.company_name})</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div className="relative">
          {metricsLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-30 bg-slate-950/20 backdrop-blur-sm rounded-2xl">
              <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          <div className={metricsLoading ? 'opacity-40 pointer-events-none' : ''}>
            {dashboardData ? (
          <>
            {/* Top aggregate metric cards */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                <div className="bg-brand-500/10 p-3 rounded-xl text-brand-400 border border-brand-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Participation Ratio</p>
                  <h4 className="text-xl font-bold text-white mt-0.5">
                    {dashboardData.participation_count} / {dashboardData.total_employees} Voted
                  </h4>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-400 border border-emerald-500/20">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Participation Rate</p>
                  <h4 className="text-xl font-bold text-white mt-0.5">{dashboardData.participation_percent}%</h4>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
                <div className="bg-violet-500/10 p-3 rounded-xl text-violet-400 border border-violet-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase">Dept Overall Average</p>
                  <h4 className="text-xl font-bold text-white mt-0.5">{dashboardData.overall_dept_average}</h4>
                </div>
              </div>
            </section>

            {/* Results Grid split */}
            <div className="grid lg:grid-cols-5 gap-8">
              
              {/* Left Column: Rankings Table */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg h-fit">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-brand-400" />
                  Employee Rank list
                </h3>

                <div className="overflow-x-auto max-h-[450px] overflow-y-auto pr-1">
                  <table className="min-w-full text-left text-xs">
                    <thead className="text-[10px] text-slate-400 border-b border-slate-800 uppercase">
                      <tr>
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold text-center">Avg Score</th>
                        <th className="pb-3 font-semibold text-center">Reviews</th>
                        <th className="pb-3 font-semibold text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {dashboardData.employee_stats?.map(emp => {
                        const isSelected = selectedEmployeeId === emp.id.toString()
                        return (
                          <tr 
                            key={emp.id} 
                            onClick={() => setSelectedEmployeeId(emp.id.toString())}
                            className={`cursor-pointer transition-all hover:bg-slate-950/20 ${
                              isSelected ? 'bg-brand-600/10 text-white' : 'text-slate-300'
                            }`}
                          >
                            <td className="py-3 font-medium truncate max-w-[120px]">{emp.name}</td>
                            <td className="py-3 text-center font-bold">
                              {emp.average_score > 0 ? emp.average_score.toFixed(2) : '0.00'}
                            </td>
                            <td className="py-3 text-center text-slate-400">{emp.reviews_count}</td>
                            <td className="py-3 text-right">
                              <ChevronRight className="w-4 h-4 text-slate-500 inline-block" />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {(!dashboardData.employee_stats || dashboardData.employee_stats.length === 0) && (
                    <p className="text-center text-slate-500 py-8">Roster is empty.</p>
                  )}
                </div>
              </div>

              {/* Right Column: Detailed KPIs Inspector */}
              <div className="lg:col-span-3">
                {dashboardData.selected_employee ? (
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg relative">
                    {/* Header */}
                    <div className="border-b border-slate-800 pb-4 mb-6">
                      <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">Detail Inspector</span>
                      <h2 className="text-xl font-bold text-white mt-0.5">
                        {dashboardData.selected_employee.name}
                      </h2>
                      <div className="flex gap-4 mt-2 text-xs text-slate-400 font-medium">
                        <span>Overall average: <strong className="text-slate-200">
                          {dashboardData.selected_employee.average_score > 0 
                            ? `${dashboardData.selected_employee.average_score.toFixed(2)} / 5.0`
                            : 'N/A'
                          }
                        </strong></span>
                        <span>Evaluators: <strong className="text-slate-200">{dashboardData.selected_employee.reviews_count}</strong></span>
                      </div>
                    </div>

                    {/* Progress bars list */}
                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                      {dashboardData.selected_employee.kpi_averages?.map((kpi, idx) => {
                        const scoreStr = kpi.average_score > 0 ? kpi.average_score.toFixed(2) : '0.00'
                        return (
                          <div key={kpi.id} className="p-3.5 bg-slate-950/40 border border-slate-800/80 rounded-xl">
                            <div className="flex justify-between items-start mb-1 text-xs">
                              <div className="pr-4">
                                <span className="text-[10px] text-slate-500 font-semibold">KPI #{idx + 1}</span>
                                <h4 className="font-semibold text-slate-200 leading-tight">{kpi.kpi_name}</h4>
                              </div>
                              <div className="shrink-0 text-right font-semibold text-slate-200">
                                <span>{scoreStr} / 5.0</span>
                                <span className="block text-[10px] font-normal text-slate-500">{kpi.reviews_count} reviews</span>
                              </div>
                            </div>

                            {/* Slider bar */}
                            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                              <div 
                                className="bg-brand-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${(kpi.average_score / 5.0) * 100}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                    <TrendingUp className="w-12 h-12 text-slate-600 mb-3" />
                    <h3 className="text-sm font-bold text-white mb-1">Select employee to inspect</h3>
                    <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
                      Click "Inspect Details" or select a row on the rank table to drill down into their specific KPI score averages.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
            <Calendar className="w-16 h-16 text-slate-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Filter Selection Required</h3>
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              Please choose both an appraisal cycle and a department in the filter selectors above to generate reports.
            </p>
          </div>
        )}
          </div>
        </div>
        </>
        )}

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
