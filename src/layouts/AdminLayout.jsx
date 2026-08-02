import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { Clock } from 'lucide-react'
import Modal from '../components/Modal'

const INACTIVITY_TIMEOUT = 15 * 60 * 1000 // 15 Minutes
const WARNING_TIMEOUT = 60 * 1000 // 60 Seconds warning countdown

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const { logout } = useAuth()
  const { addAuditEntry } = useData()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [showWarning, setShowWarning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)

  const lastActivityRef = useRef(Date.now())
  const countdownIntervalRef = useRef(null)
  const activityTimeoutRef = useRef(null)

  // Reset inactivity timer
  const resetInactivityTimer = () => {
    if (showWarning) return // Do not reset if warning is already showing
    lastActivityRef.current = Date.now()

    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)

    // Set timeout to show warning
    activityTimeoutRef.current = setTimeout(() => {
      setShowWarning(true)
      setTimeLeft(60)
    }, INACTIVITY_TIMEOUT - WARNING_TIMEOUT)
  }

  // Extend session
  const extendSession = () => {
    setShowWarning(false)
    resetInactivityTimer()
  }

  // Force log out
  const handleAutoLogout = async () => {
    setShowWarning(false)
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

    addAuditEntry('Auto Logout due to Session Inactivity Limit', { color: 'red' })
    await logout()
    showToast('Naka-sign out ka na dahil sa session limit / inactivity.', 'info')
    navigate('/login')
  }

  // Listen to user interactions
  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll']

    const handleActivity = () => {
      resetInactivityTimer()
    }

    events.forEach((event) => {
      window.addEventListener(event, handleActivity)
    })

    // Initial start
    resetInactivityTimer()

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [showWarning])

  // Handle warning countdown
  useEffect(() => {
    if (showWarning) {
      // Start 1-second countdown interval
      countdownIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current)
            handleAutoLogout()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [showWarning])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Session Timeout Warning Modal */}
      <Modal open={showWarning} onClose={() => {}} title="Session Limit Warning" maxWidth="max-w-md">
        <div className="flex flex-col items-center p-2 text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-500 animate-pulse">
            <Clock size={32} />
            <span className="absolute -right-1 -top-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500"></span>
            </span>
          </div>

          <h3 className="text-lg font-bold text-gray-900">
            Dahil sa kawalan ng aktibidad, ikaw ay mai-o-log out
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Para sa seguridad ng Barangay, ang iyong session ay may limitasyon. Awtomatiko kang mai-o-log out sa loob ng:
          </p>

          <div className="my-5 rounded-2xl border border-amber-200/50 bg-amber-50 px-6 py-4">
            <span className="text-4xl font-extrabold tracking-tight text-amber-600">
              {timeLeft} segundo
            </span>
          </div>

          <div className="mt-4 flex w-full gap-3">
            <button
              onClick={extendSession}
              className="flex-1 rounded-lg bg-gradient-to-b from-bb-blue to-bb-blue/90 border border-bb-blue/10 shadow-sm hover:shadow hover:from-bb-blue-dark hover:to-bb-blue-dark py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
            >
              Manatiling Naka-log in
            </button>
            <button
              onClick={handleAutoLogout}
              className="rounded-lg bg-gradient-to-b from-gray-200 to-gray-300/80 border border-gray-200/20 shadow-sm hover:shadow hover:from-gray-300 hover:to-gray-400 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all active:scale-[0.98]"
            >
              Mag-log out
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
