import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import StellarLogo from './StellarLogo'

const APP_VERSION = '1.0.0'

export default function Footer() {
  const { t } = useTranslation()
  
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              {t('footer.terms') || 'Términos y Condiciones'}
            </Link>
            <span className="hidden md:inline">|</span>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              {t('footer.privacy') || 'Política de Privacidad'}
            </Link>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-2 text-center md:text-right">
            <p>
              &copy; {new Date().getFullYear()} {t('footer.copyright') || 'Peranto SSI NA, LLC & Web3 Chile. Todos los derechos reservados.'}
            </p>
            <span className="hidden md:inline text-muted-foreground/50">|</span>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground/80">
                Lumo by Peranto v{APP_VERSION}
              </p>
              <span className="hidden md:inline text-muted-foreground/50">|</span>
              <div className="flex items-center gap-1.5 text-muted-foreground/60">
                <span className="text-xs">Powered by</span>
                <StellarLogo size={16} variant="monochrome" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

