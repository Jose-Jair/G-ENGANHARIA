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
  showSlogan?: boolean
  size?: number | string
}

/**
 * Cores oficiais da G+ Engenharia
 * - Laranja G+: #D95A2B (RGB 217, 90, 43 / HSL 16, 68%, 51%)
 * - Navy Institucional: #1E2A4A (RGB 30, 42, 74 / HSL 224, 42%, 20%)
 * - Cinza Estrutural: #8A8A8A (RGB 138, 138, 138)
 */
export const G_PLUS_COLORS = {
  orange: '#D95A2B',
  orangeHover: '#C44E22',
  navy: '#1E2A4A',
  navyDark: '#141D34',
  navyLight: '#2C3B63',
  gray: '#8A8A8A',
}

/**
 * Símbolo vetorial fiel da G+ Engenharia:
 * - Telhado e parede direita da casa em traço cinza contínuo:
 *   Começa no vértice do beiral esquerdo, sobe até o topo do telhado,
 *   desce para a parede direita e desce verticalmente.
 * - Monograma G em laranja vivo com corte de cruz (+):
 *   Traço laranja que sobe paralelo ao telhado esquerdo, desce na parede esquerda,
 *   faz a base inferior horizontal e sobe formando o corte central horizontal (+) da cruz.
 */
export const GPlusSymbol: React.FC<{
  size?: number | string
  className?: string
  grayColor?: string
  orangeColor?: string
}> = ({ size = 40, className = '', grayColor = '#8A8A8A', orangeColor = '#D95A2B' }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Símbolo G+ Engenharia"
    >
      {/* 1. Traço da Casa em Cinza: telhado inclinado e parede direita */}
      <path
        d="M 32 38 L 49.5 25.5 L 68 39 L 68 57"
        stroke={grayColor}
        strokeWidth="4.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 2. Traço Laranja que forma o 'G' integrado com a casa:
             - Começa sob o telhado esquerdo (x:49.5, y:31)
             - Desce inclinado até o canto esquerdo da parede (x:35.5, y:41.5)
             - Desce vertical formando a parede esquerda (x:35.5, y:57)
             - Dobra em 90 graus para a direita formando o fundo do G (x:51, y:57)
             - Sobe formando a haste vertical interna do G / haste da cruz (x:51, y:41.5)
      */}
      <path
        d="M 49.5 31 L 35.5 41.5 L 35.5 57 L 51 57 L 51 41.5"
        stroke={orangeColor}
        strokeWidth="4.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 3. Traço horizontal da cruz (+) que cruza a haste do G:
             - Da esquerda para além da direita (x:45 até x:65 na altura y:46)
      */}
      <line
        x1="45"
        y1="46"
        x2="65"
        y2="46"
        stroke={orangeColor}
        strokeWidth="4.5"
        strokeLinecap="round"
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
  showSlogan = true,
  size,
  className = '',
}) => {
  const isDark = theme === 'dark'
  const textColor = isDark ? '#FFFFFF' : '#1E2A4A'
  const sloganColor = isDark ? '#CBD5E1' : '#1E2A4A'
  const grayColor = isDark ? '#94A3B8' : '#8A8A8A'

  if (variant === 'icon') {
    return (
      <GPlusSymbol
        size={size || 36}
        className={className}
        grayColor={grayColor}
        orangeColor={G_PLUS_COLORS.orange}
      />
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2.5 ${className}`}>
        <GPlusSymbol size={size || 32} grayColor={grayColor} orangeColor={G_PLUS_COLORS.orange} />
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
        <GPlusSymbol size={size || 72} grayColor={grayColor} orangeColor={G_PLUS_COLORS.orange} />
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
      <GPlusSymbol size={size || 40} grayColor={grayColor} orangeColor={G_PLUS_COLORS.orange} />
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
