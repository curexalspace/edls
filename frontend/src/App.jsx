import React, { createContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import Login from './pages/Login'
import ReviewerPortal from './pages/ReviewerPortal'
import AdminDashboard from './pages/AdminDashboard'
import HRDashboard from './pages/HRDashboard'

export const AuthContext = createContext(null)

const defaultAuth = {
  authenticated: false,
  user_id: 0,
  role: '',
  username: '',
  is_reviewer: false,
  voter_id: 0,
  voter_name: '',
  dept_name: '',
  dept_id: 0,
  period_id: 0,
}

export default function App() {
  const { data: authState = defaultAuth, refetch: refreshAuth, isLoading } = useQuery({
    queryKey: ['authMe'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          return await res.json()
        }
      } catch (err) {
        console.error("Auth check failed:", err)
      }
      return defaultAuth
    }
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-sm font-medium animate-pulse">Initializing Everight Appraisals...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ authState, refreshAuth }}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
            borderRadius: '12px',
            fontSize: '0.875rem',
            boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#1e293b' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1e293b' },
            duration: 5000,
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          {/* Staff Login */}
          <Route path="/login" element={
            authState.authenticated ? (
              authState.role === 'admin' ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/hr/dashboard" replace />
            ) : (
              <Login />
            )
          } />

          {/* Admin Dashboard */}
          <Route path="/admin/dashboard" element={
            authState.authenticated && authState.role === 'admin' ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/login" replace />
            )
          } />

          {/* HR Reports Dashboard */}
          <Route path="/hr/dashboard" element={
            authState.authenticated && (authState.role === 'admin' || authState.role === 'hr') ? (
              <HRDashboard />
            ) : (
              <Navigate to="/login" replace />
            )
          } />

          {/* Reviewer Portal captures standard welcome and rates layout */}
          <Route path="/*" element={<ReviewerPortal />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
