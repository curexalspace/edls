import React, { useState, useContext } from 'react'
import { AuthContext } from '../App'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { 
  Building, Users, Key, Calendar, ListChecks, Phone,
  Plus, Trash2, LogOut, Copy, Check, RefreshCw, BarChart2
} from 'lucide-react'
import KPIManager from '../components/KPIManager'

export default function AdminDashboard() {
  const { authState, refreshAuth } = useContext(AuthContext)
  const [activeTab, setActiveTab] = useState('cycles')
  const [loading, setLoading] = useState(false)
  const [copiedCodeId, setCopiedCodeId] = useState(null)

  // Form states
  const [newCycleName, setNewCycleName] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptCompanyId, setNewDeptCompanyId] = useState('')
  const [newEmpName, setNewEmpName] = useState('')
  const [newEmpDeptId, setNewEmpDeptId] = useState('')
  const [batchEmpNames, setBatchEmpNames] = useState('')
  const [batchEmpDeptId, setBatchEmpDeptId] = useState('')
  const [genKeyCodeDeptId, setGenKeyCodeDeptId] = useState('')
  const [genKeyCodePeriodId, setGenKeyCodePeriodId] = useState('')

  // React Query Fetchers
  const { data: stats, refetch: fetchStats } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return await res.json()
    }
  })

  const { data: periods = [], refetch: fetchCycles, isLoading: cyclesLoading } = useQuery({
    queryKey: ['adminCycles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/periods')
      if (!res.ok) throw new Error('Failed to fetch periods')
      return await res.json()
    },
    enabled: activeTab === 'cycles'
  })

  const { data: departmentsData = { companies: [], departments: [] }, refetch: fetchDepartments, isLoading: deptsLoading } = useQuery({
    queryKey: ['adminDepartments'],
    queryFn: async () => {
      const res = await fetch('/api/admin/departments')
      if (!res.ok) throw new Error('Failed to fetch departments')
      return await res.json()
    },
    enabled: activeTab === 'departments'
  })

  const { data: employeesData = { departments: [], employees: [] }, refetch: fetchEmployees, isLoading: employeesLoading } = useQuery({
    queryKey: ['adminEmployees'],
    queryFn: async () => {
      const res = await fetch('/api/admin/employees')
      if (!res.ok) throw new Error('Failed to fetch employees')
      return await res.json()
    },
    enabled: activeTab === 'roster'
  })

  const { data: codesData = { departments: [], periods: [], codes: [] }, refetch: fetchCodes, isLoading: codesLoading } = useQuery({
    queryKey: ['adminCodes'],
    queryFn: async () => {
      const res = await fetch('/api/admin/codes')
      if (!res.ok) throw new Error('Failed to fetch codes')
      return await res.json()
    },
    enabled: activeTab === 'keys'
  })

  const pageLoading = 
    (activeTab === 'cycles' && cyclesLoading) ||
    (activeTab === 'departments' && deptsLoading) ||
    (activeTab === 'roster' && employeesLoading) ||
    (activeTab === 'keys' && codesLoading);


  // --- HANDLERS ---

  // Auth logout
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/logout', { method: 'POST' })
      if (res.ok) await refreshAuth()
    } catch (err) { console.error(err) }
  }

  // Cycles CRUD
  const handleCreateCycle = async (e) => {
    e.preventDefault()
    if (!newCycleName.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/period/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCycleName })
      })
      if (res.ok) {
        setNewCycleName('')
        toast.success('Appraisal cycle created and activated successfully')
        fetchCycles()
        fetchStats()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create cycle')
      }
    } catch (err) {
      toast.error('Network error')
    } finally { setLoading(false) }
  }

  const handleCloseCycle = async (id) => {
    try {
      const res = await fetch('/api/admin/period/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        toast.success('Cycle closed successfully')
        fetchCycles()
        fetchStats()
      }
    } catch (err) { console.error(err) }
  }

  const handleActivateCycle = async (id) => {
    try {
      const res = await fetch('/api/admin/period/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        toast.success('Selected cycle activated successfully')
        fetchCycles()
        fetchStats()
      }
    } catch (err) { console.error(err) }
  }

  // Companies & Depts CRUD
  const handleCreateCompany = async (e) => {
    e.preventDefault()
    if (!newCompanyName.trim()) return
    try {
      const res = await fetch('/api/admin/company/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCompanyName })
      })
      if (res.ok) {
        setNewCompanyName('')
        toast.success('Company added successfully')
        fetchDepartments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create company')
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteCompany = async (id) => {
    if (!confirm('Are you sure you want to delete this company? Doing so deletes all linked departments.')) return
    try {
      const res = await fetch('/api/admin/company/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        toast.success('Company deleted successfully')
        fetchDepartments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete company')
      }
    } catch (err) { console.error(err) }
  }

  const handleCreateDept = async (e) => {
    e.preventDefault()
    if (!newDeptName.trim() || !newDeptCompanyId) return
    try {
      const res = await fetch('/api/admin/department/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: parseInt(newDeptCompanyId), name: newDeptName })
      })
      if (res.ok) {
        setNewDeptName('')
        toast.success('Department added successfully')
        fetchDepartments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create department')
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteDept = async (id) => {
    if (!confirm('Are you sure you want to delete this department? All employee records inside will be deleted.')) return
    try {
      const res = await fetch('/api/admin/department/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        toast.success('Department deleted successfully')
        fetchDepartments()
      }
    } catch (err) { console.error(err) }
  }

  // Employees CRUD
  const handleCreateEmployee = async (e) => {
    e.preventDefault()
    if (!newEmpName.trim() || !newEmpDeptId) return
    try {
      const res = await fetch('/api/admin/employee/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: parseInt(newEmpDeptId), name: newEmpName })
      })
      if (res.ok) {
        setNewEmpName('')
        toast.success(`Employee '${newEmpName}' added successfully`)
        fetchEmployees()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create employee')
      }
    } catch (err) { console.error(err) }
  }

  const handleBatchEmployees = async (e) => {
    e.preventDefault()
    if (!batchEmpNames.trim() || !batchEmpDeptId) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/employee/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: parseInt(batchEmpDeptId), names: batchEmpNames })
      })
      if (res.ok) {
        const data = await res.json()
        setBatchEmpNames('')
        toast.success(`Imported ${data.imported_count} employees (${data.ignored_count} duplicates skipped)`)
        fetchEmployees()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to import roster')
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const handleDeleteEmployee = async (id) => {
    if (!confirm('Are you sure you want to delete this employee?')) return
    try {
      const res = await fetch('/api/admin/employee/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        toast.success('Employee deleted successfully')
        fetchEmployees()
      }
    } catch (err) { console.error(err) }
  }

  // Access Keys CRUD
  const handleGenerateKey = async (e) => {
    e.preventDefault()
    if (!genKeyCodeDeptId || !genKeyCodePeriodId) return
    try {
      const res = await fetch('/api/admin/code/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: parseInt(genKeyCodeDeptId), period_id: parseInt(genKeyCodePeriodId) })
      })
      if (res.ok) {
        toast.success('Department login key generated successfully')
        fetchCodes()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to generate key')
      }
    } catch (err) { console.error(err) }
  }

  const handleDeleteKey = async (id) => {
    try {
      const res = await fetch('/api/admin/code/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        toast.success('Login code deleted successfully')
        fetchCodes()
      }
    } catch (err) { console.error(err) }
  }

  // Copy code utility
  const handleCopyCode = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedCodeId(id)
    toast.success('Code copied to clipboard!')
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  if (pageLoading) {
    return (
      <div className="flex-1 min-h-screen bg-slate-950 flex flex-col justify-center items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium animate-pulse">Loading Admin Console...</p>
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
            <BarChart2 className="w-6 h-6 text-brand-500" />
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white">System Admin Portal</h1>
              <p className="text-xs text-slate-400">
                <span className="hidden sm:inline">Staff Administrator: </span>
                <strong className="text-slate-300">{authState.username}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/hr/dashboard" className="px-2.5 py-1.5 sm:px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all">
              HR <span className="hidden sm:inline">Reports</span>
            </a>
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

      {/* Main layout */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        

        {/* Stats Grid cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
            <div className="bg-brand-500/10 p-3 rounded-xl text-brand-400 border border-brand-500/20">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Total Entities</p>
              <h4 className="text-xl font-bold text-white mt-0.5">{stats?.total_companies || 0}</h4>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
            <div className="bg-violet-500/10 p-3 rounded-xl text-violet-400 border border-violet-500/20">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Total Departments</p>
              <h4 className="text-xl font-bold text-white mt-0.5">{stats?.total_departments || 0}</h4>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
            <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase">Total Employees</p>
              <h4 className="text-xl font-bold text-white mt-0.5">{stats?.total_employees || 0}</h4>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
            <div className="bg-brand-500/10 p-3 rounded-xl text-brand-400 border border-brand-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-semibold uppercase">Active Cycle</p>
              <h4 className="text-sm font-bold text-white mt-1 truncate">{stats?.active_period_name || 'None'}</h4>
            </div>
          </div>
        </section>

        {/* Tab navigation */}
        <nav className="flex border-b border-slate-800 gap-6 text-sm font-semibold overflow-x-auto scrollbar-none whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: 'cycles', label: 'Appraisal Cycles', icon: Calendar },
            { id: 'departments', label: 'Entities & Departments', icon: Building },
            { id: 'roster', label: 'Employee Roster', icon: Users },
            { id: 'keys', label: 'Access keys', icon: Key },
            { id: 'kpis', label: 'KPI Settings', icon: ListChecks },
          ].map(tab => {
            const Icon = tab.icon
            const isSelected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

        {/* Dynamic Panels */}
        <main className="mt-2">
          
          {/* TAB 1: CYCLES */}
          {activeTab === 'cycles' && (
            <div className="grid md:grid-cols-3 gap-8">
              {/* Form Create */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg h-fit">
                <h3 className="text-md font-bold text-white mb-4">Create New Cycle</h3>
                <form onSubmit={handleCreateCycle} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase">Cycle Name</label>
                    <input
                      type="text"
                      required
                      value={newCycleName}
                      onChange={(e) => setNewCycleName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                      placeholder="e.g. Q2 2026 Peer Review"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Create and Activate Cycle
                  </button>
                </form>
              </div>

              {/* Cycle List */}
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <h3 className="text-md font-bold text-white mb-4">Appraisal Cycles Log</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(periods || []).map(p => (
                        <tr key={p.id} className="hover:bg-slate-950/20">
                          <td className="py-3 font-medium text-slate-200">{p.name}</td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              p.status === 'active' 
                                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-slate-950 text-slate-400 border border-slate-800'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            {p.status === 'active' ? (
                              <button
                                onClick={() => handleCloseCycle(p.id)}
                                className="text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                              >
                                Close Cycle
                              </button>
                            ) : (
                              <button
                                onClick={() => handleActivateCycle(p.id)}
                                className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                              >
                                Reactivate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {periods.length === 0 && (
                    <p className="text-center text-slate-500 text-xs py-8">No cycles recorded.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ENTITIES & DEPARTMENTS */}
          {activeTab === 'departments' && (
            <div className="grid md:grid-cols-2 gap-8">
              
              {/* Companies Panel */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <h3 className="text-md font-bold text-white mb-4">Manage Entities / Companies</h3>
                
                <form onSubmit={handleCreateCompany} className="flex gap-2 mb-6">
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                    placeholder="Enter new company name..."
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </form>

                {/* List */}
                <div className="divide-y divide-slate-800/60 max-h-[300px] overflow-y-auto pr-1">
                  {(departmentsData?.companies || []).map(comp => (
                    <div key={comp.id} className="py-3 flex justify-between items-center group">
                      <span className="text-sm font-medium text-slate-300">{comp.name}</span>
                      <button
                        onClick={() => handleDeleteCompany(comp.id)}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-400 hover:text-red-300 p-1.5 transition-all rounded-lg hover:bg-red-950/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(departmentsData?.companies || []).length === 0 && (
                    <p className="text-center text-slate-500 text-xs py-8">No companies registered.</p>
                  )}
                </div>
              </div>

              {/* Departments Panel */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <h3 className="text-md font-bold text-white mb-4">Manage Departments</h3>

                <form onSubmit={handleCreateDept} className="space-y-3 mb-6 bg-slate-950/40 p-4 border border-slate-800 rounded-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      required
                      value={newDeptCompanyId}
                      onChange={(e) => setNewDeptCompanyId(e.target.value)}
                      className="px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs w-full"
                    >
                      <option value="">Select Company...</option>
                      {(departmentsData?.companies || []).map(comp => (
                        <option key={comp.id} value={comp.id}>{comp.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      className="px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-xs w-full"
                      placeholder="Department name..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs transition-all inline-flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Department
                  </button>
                </form>

                {/* List */}
                <div className="divide-y divide-slate-800/60 max-h-[300px] overflow-y-auto pr-1">
                  {(departmentsData?.departments || []).map(dept => (
                    <div key={dept.id} className="py-3 flex justify-between items-center group">
                      <div>
                        <span className="text-sm font-medium text-slate-300">{dept.name}</span>
                        <span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800/80 ml-2">
                          {dept.company_name}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteDept(dept.id)}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-400 hover:text-red-300 p-1.5 transition-all rounded-lg hover:bg-red-950/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {departmentsData.departments.length === 0 && (
                    <p className="text-center text-slate-500 text-xs py-8">No departments registered.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ROSTER */}
          {activeTab === 'roster' && (
            <div className="grid md:grid-cols-3 gap-8">
              {/* Creator Forms (Single + Batch) */}
              <div className="space-y-6">
                
                {/* Single Add */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                  <h3 className="text-sm font-bold text-white mb-3">Add Single Employee</h3>
                  <form onSubmit={handleCreateEmployee} className="space-y-3">
                    <select
                      required
                      value={newEmpDeptId}
                      onChange={(e) => setNewEmpDeptId(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs"
                    >
                      <option value="">Choose Department...</option>
                      {(employeesData?.departments || []).map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.company_name})</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      required
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-xs"
                      placeholder="e.g. Dr. John Doe"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Save Employee
                    </button>
                  </form>
                </div>

                {/* Batch Import */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                  <h3 className="text-sm font-bold text-white mb-2">Batch Import Roster</h3>
                  <p className="text-[10px] text-slate-400 mb-3">
                    Paste one name per line to bulk import employees into a department.
                  </p>
                  <form onSubmit={handleBatchEmployees} className="space-y-3">
                    <select
                      required
                      value={batchEmpDeptId}
                      onChange={(e) => setBatchEmpDeptId(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs"
                    >
                      <option value="">Choose Department...</option>
                      {(employeesData?.departments || []).map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.company_name})</option>
                      ))}
                    </select>
                    <textarea
                      required
                      rows={5}
                      value={batchEmpNames}
                      onChange={(e) => setBatchEmpNames(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs font-mono"
                      placeholder="Alice Smith&#10;Bob Jones&#10;Charlie Vance"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      {loading ? 'Processing...' : 'Bulk Import Roster'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Roster list */}
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <h3 className="text-md font-bold text-white mb-4">Roster Directory</h3>
                
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-1">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="pb-3 font-semibold">Name</th>
                        <th className="pb-3 font-semibold">Department</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(employeesData?.employees || []).map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-950/20 group">
                          <td className="py-3 font-medium text-slate-200">{emp.name}</td>
                          <td className="py-3 text-slate-400">{emp.department_name}</td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-400 hover:text-red-300 p-1.5 transition-all rounded-lg hover:bg-red-950/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(employeesData?.employees || []).length === 0 && (
                    <p className="text-center text-slate-500 text-xs py-8">Roster is empty.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ACCESS KEYS */}
          {activeTab === 'keys' && (
            <div className="grid md:grid-cols-3 gap-8">
              {/* Form Generate */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg h-fit">
                <h3 className="text-md font-bold text-white mb-4">Generate Access Key</h3>
                
                <form onSubmit={handleGenerateKey} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase">Appraisal Period</label>
                    <select
                      required
                      value={genKeyCodePeriodId}
                      onChange={(e) => setGenKeyCodePeriodId(e.target.value)}
                      className="mt-1 block w-full px-3 py-2.5 border border-slate-700 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs"
                    >
                      <option value="">Select Cycle...</option>
                      {(codesData?.periods || []).map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase">Target Department</label>
                    <select
                      required
                      value={genKeyCodeDeptId}
                      onChange={(e) => setGenKeyCodeDeptId(e.target.value)}
                      className="mt-1 block w-full px-3 py-2.5 border border-slate-700 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs"
                    >
                      <option value="">Select Department...</option>
                      {(codesData?.departments || []).map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.company_name})</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Generate Key PIN
                  </button>
                </form>
              </div>

              {/* Key PIN Roster */}
              <div className="md:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
                <h3 className="text-md font-bold text-white mb-4">Active Access Keys</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="pb-3 font-semibold">Department</th>
                        <th className="pb-3 font-semibold">Cycle</th>
                        <th className="pb-3 font-semibold">Access Key PIN</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(codesData?.codes || []).map(c => {
                        const isCopied = copiedCodeId === c.id
                        return (
                          <tr key={c.id} className="hover:bg-slate-950/20 group">
                            <td className="py-3 font-medium text-slate-200">{c.department_name}</td>
                            <td className="py-3 text-slate-400">{c.period_name}</td>
                            <td className="py-3">
                              <div className="inline-flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 font-mono text-xs">
                                <span className="text-brand-400 font-bold">{c.code}</span>
                                <button
                                  onClick={() => handleCopyCode(c.id, c.code)}
                                  className="text-slate-500 hover:text-slate-200 transition-colors p-0.5"
                                >
                                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => handleDeleteKey(c.id)}
                                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-400 hover:text-red-300 p-1.5 transition-all rounded-lg hover:bg-red-950/20"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {(codesData?.codes || []).length === 0 && (
                    <p className="text-center text-slate-500 text-xs py-8">No keys generated yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: KPI SETTINGS */}
          {activeTab === 'kpis' && (
            <KPIManager />
          )}

        </main>
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
