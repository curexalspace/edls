import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  ListChecks, Plus, Trash2, ChevronDown,
  FileText, Hash, AlertCircle, Loader2
} from 'lucide-react'

export default function KPIManager() {
  const queryClient = useQueryClient()
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)

  // New KPI form state
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newSeq, setNewSeq] = useState('')

  // Fetch departments list (reuse admin departments endpoint)
  const { data: deptsPayload } = useQuery({
    queryKey: ['adminDepartments'],
    queryFn: async () => {
      const res = await fetch('/api/admin/departments')
      if (!res.ok) throw new Error('Failed to fetch departments')
      return await res.json()
    }
  })

  const departments = deptsPayload?.departments || []

  // Fetch KPIs for selected department
  const { data: kpis = [], isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['deptKpis', selectedDeptId],
    queryFn: async () => {
      const res = await fetch(`/api/kpis/?department_id=${selectedDeptId}`)
      if (!res.ok) throw new Error('Failed to fetch KPIs')
      return await res.json()
    },
    enabled: !!selectedDeptId
  })

  // Auto-generate order number (sequence) based on the last KPI sequence
  useEffect(() => {
    if (showForm) {
      const maxSeq = kpis.reduce((max, k) => (k.sequence > max ? k.sequence : max), 0)
      setNewSeq((maxSeq + 1).toString())
    }
  }, [showForm, kpis])

  // Handlers
  const handleCreateKPI = async (e) => {
    e.preventDefault()
    if (!selectedDeptId || !newName.trim() || !newDesc.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/kpis/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_id: parseInt(selectedDeptId),
          name: newName.trim(),
          description: newDesc.trim(),
          sequence: parseInt(newSeq) || 1
        })
      })
      if (res.ok) {
        toast.success(`KPI "${newName.trim()}" created successfully`)
        setNewName('')
        setNewDesc('')
        setNewSeq('')
        setShowForm(false)
        refetchKpis()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create KPI')
      }
    } catch {
      toast.error('Network error creating KPI')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteKPI = async (kpi) => {
    if (!confirm(`Delete KPI "${kpi.name}"? This will also remove all associated ratings.`)) return

    setDeleting(kpi.id)
    try {
      const res = await fetch('/api/kpis/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kpi.id })
      })
      if (res.ok) {
        toast.success(`KPI "${kpi.name}" deleted`)
        refetchKpis()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete KPI')
      }
    } catch {
      toast.error('Network error deleting KPI')
    } finally {
      setDeleting(null)
    }
  }

  const selectedDeptName = departments.find(d => d.id === parseInt(selectedDeptId))?.name || ''

  return (
    <div className="space-y-6">

      {/* Department Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-brand-500/10 p-2 rounded-lg text-brand-400 border border-brand-500/20">
            <ListChecks className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-md font-bold text-white">KPI Configuration</h3>
            <p className="text-xs text-slate-400">Select a department to view and manage its Key Performance Indicators</p>
          </div>
        </div>

        <div className="relative w-full md:w-96">
          <select
            value={selectedDeptId}
            onChange={(e) => {
              setSelectedDeptId(e.target.value)
              setShowForm(false)
            }}
            className="block w-full px-4 py-2.5 pr-10 border border-slate-700 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm appearance-none cursor-pointer"
          >
            <option value="">Choose a Department...</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.company_name})</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* KPI List Panel */}
      {selectedDeptId && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg overflow-hidden">
          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">
                KPIs for <span className="text-brand-400">{selectedDeptName}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {kpisLoading ? 'Loading...' : `${kpis.length} indicator${kpis.length !== 1 ? 's' : ''} configured`}
              </p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                showForm
                  ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                  : 'bg-brand-600 hover:bg-brand-500 text-white'
              }`}
            >
              <Plus className={`w-3.5 h-3.5 transition-transform ${showForm ? 'rotate-45' : ''}`} />
              {showForm ? 'Cancel' : 'Add KPI'}
            </button>
          </div>

          {/* Create KPI Form (Collapsible) */}
          {showForm && (
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <form onSubmit={handleCreateKPI} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_80px] gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">KPI Name *</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                        placeholder="e.g. Customer Service Skills"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Order</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="number"
                        min="1"
                        value={newSeq}
                        onChange={(e) => setNewSeq(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                        placeholder="#"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Description *</label>
                  <textarea
                    required
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-950 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm resize-none"
                    placeholder="Describe what this KPI measures..."
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all"
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    {creating ? 'Creating...' : 'Create KPI'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* KPI List */}
          <div className="divide-y divide-slate-800/60">
            {kpisLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                <p className="text-slate-500 text-xs">Loading KPIs...</p>
              </div>
            ) : kpis.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-8 h-8 text-slate-600" />
                <p className="text-slate-500 text-sm font-medium">No KPIs configured for this department</p>
                <p className="text-slate-600 text-xs">Click "Add KPI" above to create one</p>
              </div>
            ) : (
              kpis.map((kpi, index) => (
                <div
                  key={kpi.id}
                  className="px-5 py-4 flex items-start gap-4 group hover:bg-slate-800/30 transition-colors"
                >
                  {/* Sequence Badge */}
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold mt-0.5">
                    {kpi.sequence || index + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white leading-tight">{kpi.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{kpi.description}</p>
                  </div>

                  {/* Delete Action */}
                  <button
                    onClick={() => handleDeleteKPI(kpi)}
                    disabled={deleting === kpi.id}
                    className="shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-red-400 hover:text-red-300 p-2 rounded-lg hover:bg-red-950/20 transition-all disabled:opacity-50"
                    title="Delete this KPI"
                  >
                    {deleting === kpi.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedDeptId && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[280px]">
          <ListChecks className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Select a Department</h3>
          <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
            Choose a department from the dropdown above to view, add, or remove its Key Performance Indicators.
          </p>
        </div>
      )}
    </div>
  )
}
