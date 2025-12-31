/**
 * Componente para mostrar el logo de Stellar
 * Logo oficial de Stellar Network
 */

interface StellarLogoProps {
  className?: string
  size?: number
  showText?: boolean
  variant?: 'default' | 'monochrome'
}

export default function StellarLogo({ 
  className = '', 
  size = 24, 
  showText = false,
  variant = 'default'
}: StellarLogoProps) {
  const fillColor = variant === 'monochrome' ? 'currentColor' : '#7D00FF'
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo SVG de Stellar - diseño basado en el logo oficial */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="inline-block"
        aria-label="Stellar"
      >
        {/* Símbolo de Stellar - forma S estilizada con líneas horizontales */}
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
          fill={variant === 'monochrome' ? 'none' : fillColor}
          opacity={variant === 'monochrome' ? 0 : 0.1}
        />
        {/* Líneas horizontales características de Stellar */}
        <line x1="4" y1="12" x2="20" y2="12" stroke={fillColor} strokeWidth="2" strokeLinecap="round"/>
        <line x1="4" y1="10" x2="20" y2="10" stroke={fillColor} strokeWidth="2" strokeLinecap="round"/>
        {/* Forma S superior */}
        <path
          d="M8 6c0 2 2 4 4 4s4-2 4-4"
          stroke={fillColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Forma S inferior */}
        <path
          d="M8 18c0-2 2-4 4-4s4 2 4 4"
          stroke={fillColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Curva central */}
        <path
          d="M12 10c-2 0-4 2-4 4s2 4 4 4"
          stroke={fillColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {showText && (
        <span className="text-sm font-semibold" style={{ color: variant === 'monochrome' ? 'inherit' : fillColor }}>
          Stellar
        </span>
      )}
    </div>
  )
}
