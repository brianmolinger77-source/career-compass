import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import MenteeView from './pages/MenteeView'
import MentorDashboard from './pages/MentorDashboard'
import MentorMenteeView from './pages/MentorMenteeView'
import MentorLogin from './pages/MentorLogin'
import { checkAuth } from './utils/api'

function ProtectedRoute({ children }) {
  const [authState, setAuthState] = useState('loading') // 'loading' | 'authenticated' | 'unauthenticated'
  const location = useLocation()

  useEffect(() => {
    checkAuth()
      .then(data => {
        setAuthState(data.authenticated ? 'authenticated' : 'unauthenticated')
      })
      .catch(() => {
        setAuthState('unauthenticated')
      })
  }, [])

  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <Navigate to="/mentor/login" state={{ from: location }} replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/mentor" replace />} />
        <Route path="/mentor/login" element={<MentorLogin />} />
        <Route
          path="/mentor"
          element={
            <ProtectedRoute>
              <MentorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mentor/mentee/:id"
          element={
            <ProtectedRoute>
              <MentorMenteeView />
            </ProtectedRoute>
          }
        />
        <Route path="/mentee/:menteeId" element={<MenteeView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
