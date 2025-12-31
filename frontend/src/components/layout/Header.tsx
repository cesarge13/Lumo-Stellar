import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import UserMenu from './UserMenu'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import StarIcon from './StarIcon'
import StellarLogo from './StellarLogo'

export default function Header() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <header className="border-b sticky top-0 z-40 bg-background">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl md:text-2xl font-bold flex items-center gap-2 hover:opacity-80 transition-opacity">
          <StarIcon />
          <span>Lumo</span>
          <span className="hidden md:inline-flex items-center gap-1 text-sm font-normal text-muted-foreground ml-2">
            <span className="text-xs">powered by</span>
            <StellarLogo size={16} variant="monochrome" />
          </span>
        </Link>
        <nav className="flex items-center gap-2 md:gap-4">
          <Link to="/">
            <Button variant="ghost">{t('navigation.home')}</Button>
          </Link>
          {user ? (
            <>
              {(() => {
                const currentRole = user.activeRole || user.role
                return (
                  <>
                    {currentRole === 'PASSENGER' && (
                      <Link to="/passenger/dashboard">
                        <Button variant="ghost">{t('navigation.trips')}</Button>
                      </Link>
                    )}
                    {currentRole === 'DRIVER' && (
                      <Link to="/driver/dashboard">
                        <Button variant="ghost">{t('navigation.driver') || 'Conductor'}</Button>
                      </Link>
                    )}
                    {currentRole === 'ADMIN' && (
                      <Link to="/admin/dashboard">
                        <Button variant="ghost">{t('navigation.admin') || 'Administración'}</Button>
                      </Link>
                    )}
                  </>
                )
              })()}
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="outline">{t('auth.login')}</Button>
              </Link>
              <Link to="/register">
                <Button>{t('auth.register')}</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

