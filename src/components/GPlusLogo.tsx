import React from 'react'

export interface GPlusLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  /**
   * 'icon': Apenas o símbolo (casa de traço cinza + G estilizado laranja)
   * 'horizontal': Símbolo à esquerda + G+ ENGENHARIA (+ slogan opcional)
   * 'vertical': Símbolo no topo + ENGENHARIA + slogan (formato da marca oficial)
   * 'compact': Símbolo + 'GESTÃO G+' em linha para headers enxutos
   */
  variant?: 'icon' | 'horizontal' | 'vertical' | 'compact'
  /** Tema de cor para textos institucionais (navy no claro, branco no escuro) */
  theme?: 'dark' | 'light' | 'auto'
  dark?: boolean
  showSlogan?: boolean
  size?: number | string
}

/**
 * Cores oficiais da G+ Engenharia
 * - Laranja G+: #E35D2F / #D95A2B
 * - Navy Institucional: #1E2A4A
 * - Cinza Estrutural: #737373 (light) / #C9CBD3 (dark)
 */
export const G_PLUS_COLORS = {
  orange: '#E35D2F',
  orangeHover: '#C44E22',
  navy: '#1E2A4A',
  navyDark: '#141D34',
  navyLight: '#2C3B63',
  gray: '#737373',
  grayDark: '#C9CBD3',
}

/**
 * Símbolo oficial da G+ Engenharia (viewBox 444 509 526 632):
 * - Primeiro path (telhado/estrutura externa): #737373 (ou #C9CBD3 no dark)
 * - Segundo path (G estilizado + cruz): #E35D2F
 */
export const GPlusSymbol: React.FC<{
  size?: number | string
  className?: string
  grayColor?: string
  orangeColor?: string
  dark?: boolean
}> = ({ size = 40, className = '', grayColor, orangeColor = '#E35D2F', dark = false }) => {
  const resolvedGray = grayColor || (dark ? '#C9CBD3' : '#737373')

  return (
    <svg
      role="img"
      viewBox="444 509 526 632"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="G+ ENGENHARIA"
    >
      <title>G+ ENGENHARIA</title>
      <path
        fill={resolvedGray}
        d="M696.5 513.0L448.2 762.2L460.2 773.8L689.2 544.8L690.5 544.8L945.2 799.8L947.8 800.2L948.8 1136.0L965.2 1136.2L965.5 781.0Z"
      />
      <path
        fill={orangeColor}
        d="M686.5 613.5L481.0 822.0L480.5 1136.5L733.2 1136.5L733.8 923.2L912.2 922.2L911.5 905.8L734.5 905.8L733.8 833.2L703.2 833.0L703.0 905.2L643.2 906.5L643.8 922.8L703.0 923.2L703.0 1105.0L511.0 1105.2L512.2 834.5L708.2 635.5Z"
      />
    </svg>
  )
}

/**
 * Componente completo de Logo G+ Engenharia
 */
export const GPlusLogo: React.FC<GPlusLogoProps> = ({
  variant = 'horizontal',
  theme = 'auto',
  dark,
  showSlogan = true,
  size,
  className = '',
}) => {
  const isDark = dark !== undefined ? dark : theme === 'dark'
  const textColor = isDark ? '#FFFFFF' : '#1E2A4A'
  const sloganColor = isDark ? '#CBD5E1' : '#1E2A4A'
  const grayColor = isDark ? '#C9CBD3' : '#737373'

  if (variant === 'icon') {
    return (
      <GPlusSymbol
        size={size || 36}
        className={className}
        grayColor={grayColor}
        orangeColor={G_PLUS_COLORS.orange}
        dark={isDark}
      />
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <GPlusSymbol
          size={size || 32}
          grayColor={grayColor}
          orangeColor={G_PLUS_COLORS.orange}
          dark={isDark}
        />
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1 font-black tracking-tight text-sm">
            <span style={{ color: G_PLUS_COLORS.orange }}>GESTÃO G+</span>
          </div>
          <span
            className="text-[9px] font-bold tracking-widest uppercase mt-0.5"
            style={{ color: sloganColor, letterSpacing: '0.18em' }}
          >
            ENGENHARIA
          </span>
        </div>
      </div>
    )
  }

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <GPlusSymbol
          size={size || 72}
          grayColor={grayColor}
          orangeColor={G_PLUS_COLORS.orange}
          dark={isDark}
        />
        <div className="mt-3">
          <h2
            className="font-black text-xl tracking-[0.28em] uppercase leading-tight font-sans pl-1"
            style={{ color: textColor }}
          >
            ENGENHARIA
          </h2>
          {showSlogan && (
            <p
              className="text-[10px] font-semibold tracking-wider uppercase mt-1"
              style={{ color: sloganColor, letterSpacing: '0.12em' }}
            >
              Conectando ideias, somando resultados
            </p>
          )}
        </div>
      </div>
    )
  }

  // Variant horizontal (padrão)
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <GPlusSymbol
        size={size || 40}
        grayColor={grayColor}
        orangeColor={G_PLUS_COLORS.orange}
        dark={isDark}
      />
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-black text-base tracking-tight leading-none"
            style={{ color: G_PLUS_COLORS.orange }}
          >
            G+
          </span>
          <span
            className="font-black text-sm tracking-[0.22em] uppercase leading-none"
            style={{ color: textColor }}
          >
            ENGENHARIA
          </span>
        </div>
        {showSlogan && (
          <span
            className="text-[9px] font-medium tracking-wide uppercase mt-1 leading-none"
            style={{ color: sloganColor, letterSpacing: '0.08em' }}
          >
            Conectando ideias, somando resultados
          </span>
        )}
      </div>
    </div>
  )
}

export default GPlusLogo
