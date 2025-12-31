import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import Layout from '@/components/layout/Layout'
import Home from '@/pages/Home'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import PassengerDashboard from '@/pages/passenger/Dashboard'
import RequestTrip from '@/pages/passenger/RequestTrip'
import PassengerTrips from '@/pages/passenger/Trips'
import TripDetails from '@/pages/passenger/TripDetails'
import PassengerTripTracking from '@/pages/passenger/TripTracking'
import Favorites from '@/pages/passenger/Favorites'
import PassengerProfile from '@/pages/passenger/Profile'
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminUsers from '@/pages/admin/Users'
import AdminTrips from '@/pages/admin/Trips'
import AdminVehicles from '@/pages/admin/Vehicles'
import AdminOnboarding from '@/pages/admin/Onboarding'
import AdminProfile from '@/pages/admin/Profile'
import DriverDashboard from '@/pages/driver/Dashboard'
import AvailableTrips from '@/pages/driver/AvailableTrips'
import DriverTrips from '@/pages/driver/Trips'
import DriverTripTracking from '@/pages/driver/TripTracking'
import DriverVehicles from '@/pages/driver/Vehicles'
import DriverOnboarding from '@/pages/driver/Onboarding'
import DriverProfile from '@/pages/driver/Profile'
import HostProfile from '@/pages/host/Profile'
import DispatcherProfile from '@/pages/dispatcher/Profile'
import SupportProfile from '@/pages/support/Profile'
import ModeratorProfile from '@/pages/moderator/Profile'
import Settings from '@/pages/Settings'
import MobileWalletConnect from '@/pages/MobileWalletConnect'
import Terms from '@/pages/Terms'
import Privacy from '@/pages/Privacy'
import { DriverAlertManager } from '@/components/alerts/DriverAlertManager'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { InstallPWAButton } from '@/components/pwa/InstallPWAButton'

// Componente para rutas públicas (redirige si ya está autenticado)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Componente para rutas protegidas que requieren rol específico
function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode
  requiredRole?: string | string[]
}) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Verificar rol si se especifica (soporta múltiples roles)
  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    // Obtener todos los roles del usuario (principal + adicionales)
    const userRoles = user.roles || [user.role]
    // Verificar si el usuario tiene al menos uno de los roles permitidos
    const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role))
    
    if (!hasRequiredRole) {
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route
          path="login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="forgot-password"
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          }
        />
        {/* Rutas públicas legales */}
        <Route path="terms" element={<Terms />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="wallet/connect-mobile" element={<MobileWalletConnect />} />
        {/* Rutas de Pasajero */}
        <Route path="passenger">
          <Route 
            index 
            element={
              <ProtectedRoute>
                <Navigate to="/passenger/dashboard" replace />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="dashboard" 
            element={
              <ProtectedRoute>
                <PassengerDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="request-trip" 
            element={
              <ProtectedRoute>
                <RequestTrip />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="trips" 
            element={
              <ProtectedRoute>
                <PassengerTrips />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="trips/:id" 
            element={
              <ProtectedRoute>
                <TripDetails />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="trips/:id/track" 
            element={
              <ProtectedRoute>
                <PassengerTripTracking />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="favorites" 
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="profile" 
            element={
              <ProtectedRoute>
                <PassengerProfile />
              </ProtectedRoute>
            } 
          />
        </Route>
        {/* Rutas de Conductor */}
        <Route path="driver">
          <Route 
            index 
            element={
              <ProtectedRoute requiredRole="DRIVER">
                <Navigate to="/driver/dashboard" replace />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="dashboard" 
            element={
              <ProtectedRoute requiredRole="DRIVER">
                <DriverDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="trips/available" 
            element={
              <ProtectedRoute requiredRole="DRIVER">
                <AvailableTrips />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="trips" 
            element={
              <ProtectedRoute requiredRole="DRIVER">
                <DriverTrips />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="trips/:id" 
            element={
              <ProtectedRoute requiredRole="DRIVER">
                <DriverTrips />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="trips/:id/track" 
            element={
              <ProtectedRoute requiredRole="DRIVER">
                <DriverTripTracking />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="vehicles" 
            element={
              <ProtectedRoute requiredRole="DRIVER">
                <DriverVehicles />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="onboarding" 
            element={
              <ProtectedRoute>
                <DriverOnboarding />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="profile" 
            element={
              <ProtectedRoute requiredRole="DRIVER">
                <DriverProfile />
              </ProtectedRoute>
            } 
          />
        </Route>
        {/* Rutas de Configuración */}
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        {/* Rutas de Administrador */}
        <Route path="admin">
          <Route 
            index 
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="dashboard" 
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="users" 
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminUsers />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="trips" 
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminTrips />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="vehicles" 
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminVehicles />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="onboarding" 
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminOnboarding />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="profile" 
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminProfile />
              </ProtectedRoute>
            } 
          />
        </Route>
        {/* Rutas de Host */}
        <Route path="host">
          <Route 
            path="profile" 
            element={
              <ProtectedRoute requiredRole="HOST">
                <HostProfile />
              </ProtectedRoute>
            } 
          />
        </Route>
        {/* Rutas de Despachador */}
        <Route path="dispatcher">
          <Route 
            path="profile" 
            element={
              <ProtectedRoute requiredRole="DISPATCHER">
                <DispatcherProfile />
              </ProtectedRoute>
            } 
          />
        </Route>
        {/* Rutas de Soporte */}
        <Route path="support">
          <Route 
            path="profile" 
            element={
              <ProtectedRoute requiredRole="SUPPORT">
                <SupportProfile />
              </ProtectedRoute>
            } 
          />
        </Route>
        {/* Rutas de Moderador */}
        <Route path="moderator">
          <Route 
            path="profile" 
            element={
              <ProtectedRoute requiredRole="MODERATOR">
                <ModeratorProfile />
              </ProtectedRoute>
            } 
          />
        </Route>
      </Route>
    </Routes>
  )
}

function AppContent() {
  // Inicializar notificaciones push
  usePushNotifications()

  return (
    <>
      <AppRoutes />
      <DriverAlertManager />
      <InstallPWAButton />
      <Toaster />
    </>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
