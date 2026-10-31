import Services from './pages/Services'
import BotWorkspace from './pages/BotWorkspace'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import FirstLoginPasswordChange from './pages/FirstLoginPasswordChange'
import TwoFactorAuth from './pages/TwoFactorAuth'
import AdminLayout from './layouts/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import RoleGuard from './components/RoleGuard'
import Dashboard from './pages/Dashboard'
import GISCommandCenter from './pages/GISCommandCenter'
import DigitalBlotter from './pages/DigitalBlotter'
import UserAccounts from './pages/UserAccounts'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import AuditLogs from './pages/AuditLogs'
import Profile from './pages/Profile'
import EmergencyDirectory from './pages/EmergencyDirectory'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/2fa"
        element={
          <ProtectedRoute>
            <TwoFactorAuth />
          </ProtectedRoute>
        }
      />
      <Route
        path="/first-login"
        element={
          <ProtectedRoute>
            <FirstLoginPasswordChange />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <RoleGuard module="dashboard">
              <Dashboard />
            </RoleGuard>
          }
        />
        <Route
          path="/gis"
          element={
            <RoleGuard module="gis">
              <GISCommandCenter />
            </RoleGuard>
          }
        />
        <Route
          path="/complaints"
          element={
            <RoleGuard module="blotter">
              <DigitalBlotter reportType="service_complaint" />
            </RoleGuard>
          }
        />
        <Route
          path="/blotter"
          element={
            <RoleGuard module="blotter">
              <DigitalBlotter reportType="blotter" />
            </RoleGuard>
          }
        />
        <Route
          path="/accounts"
          element={
            <RoleGuard module="userAccounts">
              <UserAccounts />
            </RoleGuard>
          }
        />
        <Route path="/services" element={<RoleGuard module="knowledgeBase"><Services /></RoleGuard>} />
        <Route path="/chatbot-settings" element={<RoleGuard module="knowledgeBase"><Navigate to="/knowledge-base?view=chat" replace /></RoleGuard>} />
        <Route
          path="/knowledge-base"
          element={
            <RoleGuard module="knowledgeBase">
              <BotWorkspace />
            </RoleGuard>
          }
        />
        <Route
          path="/directory"
          element={
            <RoleGuard module="directory">
              <EmergencyDirectory />
            </RoleGuard>
          }
        />
        <Route
          path="/alerts"
          element={
            <RoleGuard module="alerts">
              <Alerts />
            </RoleGuard>
          }
        />
        <Route
          path="/reports"
          element={
            <RoleGuard module="reports">
              <Reports />
            </RoleGuard>
          }
        />
        <Route
          path="/audit"
          element={
            <RoleGuard module="auditLogs">
              <AuditLogs />
            </RoleGuard>
          }
        />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
