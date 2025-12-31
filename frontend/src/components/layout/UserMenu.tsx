import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useCallback } from 'react'
import { Globe, Settings, MapPin, Moon, Sun, Monitor, UserCircle, Wallet, CheckCircle, LogOut } from 'lucide-react'
import { getCountryName } from '@/services/locationService'
import { useTheme } from '@/contexts/ThemeContext'
import { UserRole } from '@/types'
import { ConnectWalletModal } from '@/components/wallet/ConnectWalletModal'
import { getFreighterConnectionStatus } from '@/services/freighterService'
import { api } from '@/services/api'
import { toast } from 'sonner'

export default function UserMenu() {
  const { user, logout, changeActiveRole, setUser } = useAuth()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [walletStatus, setWalletStatus] = useState<{
    isAvailable: boolean
    isConnected: boolean
    publicKey: string | null
  } | null>(null)

  const checkWalletStatus = useCallback(async () => {
    const status = await getFreighterConnectionStatus()
    
    // Si el usuario ha desconectado manualmente (no tiene stellarAddress en su perfil),
    // NO mostrar como conectado aunque Freighter esté conectado en la extensión
    const userStellarAddress = user?.stellarAddress 
      ? (typeof user.stellarAddress === 'string' ? user.stellarAddress : String(user.stellarAddress))
      : ''
    
    if (!userStellarAddress) {
      // Usuario desconectado manualmente - mostrar como desconectado
      setWalletStatus({
        isAvailable: status.isAvailable,
        isConnected: false,
        publicKey: null,
      })
      return
    }
    
    // Usuario tiene dirección Stellar - mostrar como conectado
    // Si Freighter está conectado y la dirección coincide, usar el estado de Freighter
    // Si no coincide o Freighter no está conectado, mostrar como conectado basado en stellarAddress
    if (status.isConnected && status.publicKey === userStellarAddress) {
      // Estado coincide - usar estado completo de Freighter
      setWalletStatus({
        isAvailable: status.isAvailable,
        isConnected: true,
        publicKey: status.publicKey,
      })
    } else {
      // Mostrar como conectado basado en stellarAddress del usuario
      setWalletStatus({
        isAvailable: status.isAvailable,
        isConnected: true,
        publicKey: userStellarAddress,
      })
    }
  }, [user?.stellarAddress])

  useEffect(() => {
    // Si el usuario tiene stellarAddress, mostrar como conectado inmediatamente
    const userStellarAddress = user?.stellarAddress 
      ? (typeof user.stellarAddress === 'string' ? user.stellarAddress : String(user.stellarAddress))
      : ''
    
    if (userStellarAddress) {
      setWalletStatus({
        isAvailable: true,
        isConnected: true,
        publicKey: userStellarAddress,
      })
    } else {
      // Si no tiene stellarAddress, verificar estado real de Freighter
      checkWalletStatus()
    }
    
    // Escuchar eventos de cambio de foco de ventana para verificar estado cuando el usuario vuelve
    const handleFocus = () => {
      if (!userStellarAddress) {
        checkWalletStatus()
      }
    }
    
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [checkWalletStatus, user?.stellarAddress]) // Actualizar cuando cambia checkWalletStatus o user.stellarAddress

  const handleDisconnectWallet = async () => {
    try {
      // Limpiar dirección Stellar del perfil
      const updatedUser = await api.updateProfile({ stellarAddress: '' })
      
      // Actualizar el usuario en el contexto
      if (updatedUser) {
        setUser(updatedUser)
      }
      
      // Forzar estado de wallet a desconectado (NO verificar después)
      setWalletStatus({
        isAvailable: true,
        isConnected: false,
        publicKey: null,
      })
      
      // NO llamar a checkWalletStatus() aquí porque volvería a detectar la conexión
      // La extensión de Freighter puede seguir conectada, pero nosotros la desconectamos del perfil
      
      toast.success(t('wallet.disconnected') || 'Wallet desconectada exitosamente')
    } catch (error: any) {
      console.error('Error disconnecting wallet:', error)
      toast.error(error.message || t('wallet.disconnectionError') || 'Error al desconectar wallet')
    }
  }

  if (!user) return null

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang)
  }

  const getRoleLabel = (role: string) => {
    return t(`roles.${role.toLowerCase()}`)
  }

  // Obtener todos los roles disponibles del usuario
  // Construir la lista de roles desde userRoles si está disponible, sino desde roles
  let allUserRoles: UserRole[] = []
  
  if (user.userRoles && user.userRoles.length > 0) {
    // Si tenemos userRoles del backend, construir la lista completa
    allUserRoles = [
      user.role,
      ...user.userRoles.map(ur => ur.role)
    ]
  } else if (user.roles && user.roles.length > 0) {
    // Si tenemos roles calculados, usarlos
    allUserRoles = user.roles
  } else {
    // Fallback: solo el rol principal
    allUserRoles = user.role ? [user.role] : []
  }
  
  // Eliminar duplicados
  const availableRoles = Array.from(new Set(allUserRoles))
  const currentActiveRole = user.activeRole || user.role

  const handleRoleChange = async (newRole: UserRole) => {
    try {
      await changeActiveRole(newRole)
      // El usuario se actualizará automáticamente en el contexto
      // Navegar al dashboard correspondiente al nuevo rol
      const dashboardRoutes: Record<UserRole, string> = {
        PASSENGER: '/passenger/dashboard',
        DRIVER: '/driver/dashboard',
        HOST: '/host/dashboard',
        DISPATCHER: '/dispatcher/dashboard',
        SUPPORT: '/support/dashboard',
        MODERATOR: '/moderator/dashboard',
        ADMIN: '/admin/dashboard',
        OPERATOR: '/admin/dashboard',
      }
      
      const dashboardRoute = dashboardRoutes[newRole] || '/'
      navigate(dashboardRoute)
    } catch (error) {
      console.error('Error cambiando rol:', error)
      alert('Error al cambiar el rol. Por favor, intenta nuevamente.')
    }
  }


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="relative h-10 w-10 rounded-full touch-manipulation"
          style={{ touchAction: 'manipulation' }}
        >
          <Avatar className="h-10 w-10 cursor-pointer">
            <AvatarImage src={user.avatar || undefined} alt={user.name} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-56 z-50" 
        align="end" 
        sideOffset={5}
        side="bottom"
        alignOffset={0}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            <div className="pt-1 flex gap-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {getRoleLabel(currentActiveRole)}
              </Badge>
              {availableRoles.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  {availableRoles.length} roles
                </Badge>
              )}
              {user.country && (
                <Badge variant="outline" className="text-xs">
                  <MapPin className="h-3 w-3 mr-1" />
                  {getCountryName(user.country || '')}
                </Badge>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Botón Conectar/Desconectar Wallet */}
        {walletStatus?.isConnected ? (
          <>
            <DropdownMenuItem 
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowWalletModal(true)
              }}
              className="cursor-pointer hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center gap-2 w-full">
                <div className="p-1.5 rounded-md bg-green-500/20">
                  <Wallet className="h-4 w-4 text-green-500" />
                </div>
                <span className="flex-1 font-medium">
                  {t('wallet.connected') || 'Wallet Conectada'}
                </span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </DropdownMenuItem>
            {walletStatus.publicKey && (
              <div className="px-2 py-1 text-xs text-muted-foreground font-mono break-all">
                {walletStatus.publicKey.slice(0, 8)}...{walletStatus.publicKey.slice(-6)}
              </div>
            )}
            <DropdownMenuItem 
              onClick={async (e) => {
                e.preventDefault()
                e.stopPropagation()
                await handleDisconnectWallet()
              }}
              className="cursor-pointer hover:bg-red-500/10 transition-colors text-red-600"
            >
              <div className="flex items-center gap-2 w-full">
                <div className="p-1.5 rounded-md bg-red-500/20">
                  <LogOut className="h-4 w-4 text-red-500" />
                </div>
                <span className="flex-1 font-medium">
                  {t('wallet.disconnect') || 'Desconectar Wallet'}
                </span>
              </div>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem 
            onClick={async (e) => {
              e.preventDefault()
              e.stopPropagation()
              
              // Conectar directamente - mostrará pop-up nativo de Freighter
              try {
                const { connectFreighter } = await import('@/services/freighterService')
                
                // Esto mostrará el pop-up nativo de Freighter
                const account = await connectFreighter()
                
                // Actualizar perfil del usuario con la dirección Stellar
                try {
                  const updatedUser = await api.updateProfile({ stellarAddress: account.publicKey })
                  // Actualizar el usuario en el contexto inmediatamente
                  if (updatedUser) {
                    setUser(updatedUser)
                  }
                } catch (profileError) {
                  console.error('Error updating profile:', profileError)
                  throw profileError
                }
                
                // Actualizar estado local inmediatamente con la información de la conexión
                setWalletStatus({
                  isAvailable: true,
                  isConnected: true,
                  publicKey: account.publicKey,
                })
                
                toast.success(t('wallet.connected') || 'Wallet conectada exitosamente')
                
                // NO llamar a checkWalletStatus aquí porque puede sobrescribir el estado
                // El useEffect que depende de user?.stellarAddress se encargará de mantener el estado
                
                // No recargar la página - el estado ya se actualizó
                // El componente se actualizará automáticamente con el nuevo estado
              } catch (error: any) {
                console.error('Error connecting wallet:', error)
                console.error('Error details:', {
                  message: error.message,
                  stack: error.stack,
                  name: error.name
                })
                
                // Solo mostrar modal si realmente no está instalado
                const errorMessage = error.message?.toLowerCase() || ''
                if (errorMessage.includes('no está instalada') || 
                    errorMessage.includes('not installed') ||
                    errorMessage.includes('extension not detected') ||
                    errorMessage.includes('freighter is not installed')) {
                  setShowWalletModal(true)
                } else if (errorMessage.includes('cancelado') || 
                           errorMessage.includes('rejected') ||
                           errorMessage.includes('cancelled') ||
                           errorMessage.includes('user rejected')) {
                  // Usuario canceló la conexión - no mostrar error
                  return
                } else {
                  // Otros errores - mostrar mensaje pero no el modal
                  toast.error(error.message || t('wallet.connectionError') || 'Error al conectar wallet')
                }
              }
            }}
            className="cursor-pointer hover:bg-primary/10 transition-colors"
          >
            <div className="flex items-center gap-2 w-full">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <span className="flex-1 font-medium">
                CONNECT WALLET
              </span>
            </div>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {availableRoles.length > 1 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <UserCircle className="h-4 w-4" />
              <span className="text-xs">{t('common.role') || 'Rol Activo'}</span>
            </DropdownMenuLabel>
            {availableRoles.map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => handleRoleChange(role)}
                className={currentActiveRole === role ? 'bg-accent' : ''}
              >
                {getRoleLabel(role)}
                {currentActiveRole === role && ' ✓'}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-xs">{t('common.language') || 'Idioma'}</span>
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => changeLanguage('es')}>
          Español
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('en')}>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLanguage('pt')}>
          Português
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sun className="h-4 w-4" />
          <span className="text-xs">{t('common.theme') || 'Tema'}</span>
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="h-4 w-4 mr-2" />
          {t('theme.light') || 'Claro'}
          {theme === 'light' && ' ✓'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="h-4 w-4 mr-2" />
          {t('theme.dark') || 'Oscuro'}
          {theme === 'dark' && ' ✓'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="h-4 w-4 mr-2" />
          {t('theme.system') || 'Sistema'}
          {theme === 'system' && ' ✓'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => {
          const role = currentActiveRole
          const profileRoutes: Record<string, string> = {
            PASSENGER: '/passenger/profile',
            DRIVER: '/driver/profile',
            HOST: '/host/profile',
            DISPATCHER: '/dispatcher/profile',
            SUPPORT: '/support/profile',
            MODERATOR: '/moderator/profile',
            ADMIN: '/admin/profile',
          }
          const profileRoute = profileRoutes[role] || '/settings'
          navigate(profileRoute)
        }}>
          <UserCircle className="h-4 w-4 mr-2" />
          {t('profile.title') || 'Mi Perfil'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/settings')}>
          <Settings className="h-4 w-4 mr-2" />
          {t('navigation.settings') || 'Configuración'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
      
      {/* Modal de conexión de wallet */}
      <ConnectWalletModal
        open={showWalletModal}
        onOpenChange={setShowWalletModal}
        onConnected={async (publicKey) => {
          await checkWalletStatus()
          // Actualizar perfil del usuario con la dirección Stellar
          try {
            await api.updateProfile({ stellarAddress: publicKey })
            // Actualizar el usuario en el contexto si es necesario
            window.location.reload() // Recargar para actualizar el estado
          } catch (error) {
            console.error('Error updating profile:', error)
          }
        }}
      />
    </DropdownMenu>
  )
}

