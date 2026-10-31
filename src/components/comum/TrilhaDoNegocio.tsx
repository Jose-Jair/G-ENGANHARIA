import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Building2,
  FileText,
  ShieldCheck,
  FileCheck,
  FolderGit2,
  ClipboardList,
  ChevronRight,
  CheckCircle2,
  Clock,
  Circle,
} from 'lucide-react'

export type EtapaTrilhaId = 'lead' | 'proposta' | 'pre_cotacao' | 'contrato' | 'projeto' | 'os'

export interface ItemTrilhaNegocio {
  id: EtapaTrilhaId
  label: string
  sublabel?: string
  rota: string
  status?: 'concluido' | 'ativo' | 'pendente'
  codigo?: string
}

interface TrilhaDoNegocioProps {
  /**
   * Identificador da etapa atualmente em foco na tela
   */
  etapaAtual?: EtapaTrilhaId
  /**
   * Dados opcionais para enriquecer cada etapa com código e status
   */
  leadId?: string
  leadNome?: string
  propostaId?: string
  propostaCodigo?: string
  contratoId?: string
  contratoNumero?: string
  projetoId?: string
  projetoCodigo?: string
  temOsEmitida?: boolean
  className?: string
}

/**
 * Trilha do Negócio G+
 * Lead → Proposta → Contrato → Projeto → Ordens de Serviço (OS)
 *
 * REGRA ESTRITA: Cabeçalho fixo renderizado EXCLUSIVAMENTE para perfis internos
 * (Admin, Comercial, Financeiro, Gestor de Projetos).
 * NUNCA renderizar para Executor externo / Portal do Prestador.
 */
export function TrilhaDoNegocio({
  etapaAtual,
  leadId,
  leadNome,
  propostaId,
  propostaCodigo,
  contratoId,
  contratoNumero,
  projetoId,
  projetoCodigo,
  temOsEmitida,
  className = '',
}: TrilhaDoNegocioProps) {
  const { user, isExecutor } = useAuth()
  const location = useLocation()

  // REGRA DE SEGURANÇA E PRIVACIDADE: Ocultar para prestadores/executores externos
  // ou quando a rota for pública / portal do prestador
  if (!user || isExecutor) {
    return null
  }
  if (
    location.pathname.startsWith('/portal-prestador') ||
    location.pathname.startsWith('/portal-executor') ||
    location.pathname.startsWith('/cotacao/') ||
    location.pathname.startsWith('/subcontrato/') ||
    location.pathname.startsWith('/proposta-publica/') ||
    location.pathname.startsWith('/contrato-servico-publico/')
  ) {
    return null
  }

  // Inferir etapa atual pela rota caso não passada via prop
  const etapaEfetiva: EtapaTrilhaId =
    etapaAtual ||
    (location.pathname.startsWith('/empresas') || location.pathname.startsWith('/funil')
      ? 'lead'
      : location.pathname.startsWith('/propostas')
        ? 'proposta'
        : location.pathname.startsWith('/contratos-servico')
          ? 'contrato'
          : location.pathname.startsWith('/projetos')
            ? 'projeto'
            : location.pathname.startsWith('/monitoramento-prazos')
              ? 'os'
              : 'lead')

  const etapas: {
    id: EtapaTrilhaId
    titulo: string
    subtitulo: string
    icone: React.ComponentType<{ className?: string }>
    link: string
    codigo?: string
    isConcluida: boolean
    isAtiva: boolean
  }[] = [
    {
      id: 'lead',
      titulo: 'Lead / Oportunidade',
      subtitulo: leadNome || 'Empresa & Funil',
      icone: Building2,
      link: leadId ? `/funil` : '/funil',
      codigo: leadNome,
      isConcluida: !!propostaId || !!contratoId || !!projetoId || etapaEfetiva !== 'lead',
      isAtiva: etapaEfetiva === 'lead',
    },
    {
      id: 'proposta',
      titulo: 'Proposta Comercial',
      subtitulo: propostaCodigo || 'Elaboração & Aceite',
      icone: FileText,
      link: propostaId ? `/propostas?id=${propostaId}` : '/propostas',
      codigo: propostaCodigo,
      isConcluida:
        !!contratoId ||
        !!projetoId ||
        etapaEfetiva === 'pre_cotacao' ||
        etapaEfetiva === 'contrato' ||
        etapaEfetiva === 'projeto' ||
        etapaEfetiva === 'os',
      isAtiva: etapaEfetiva === 'proposta',
    },
    {
      id: 'pre_cotacao',
      titulo: 'Pré-Cotação',
      subtitulo: 'Escopo & Vinculação',
      icone: ShieldCheck,
      link: propostaId ? `/propostas?id=${propostaId}` : '/propostas',
      isConcluida:
        !!contratoId ||
        !!projetoId ||
        etapaEfetiva === 'contrato' ||
        etapaEfetiva === 'projeto' ||
        etapaEfetiva === 'os',
      isAtiva: etapaEfetiva === 'pre_cotacao',
    },
    {
      id: 'contrato',
      titulo: 'Contrato de Serviço',
      subtitulo: contratoNumero || 'Assinatura Bilateral',
      icone: FileCheck,
      link: contratoId
        ? `/contratos-servico?id=${contratoId}`
        : projetoId
          ? `/projetos?id=${projetoId}&tab=contrato`
          : '/contratos-servico',
      codigo: contratoNumero,
      isConcluida: !!projetoId || etapaEfetiva === 'projeto' || etapaEfetiva === 'os',
      isAtiva: etapaEfetiva === 'contrato',
    },
    {
      id: 'projeto',
      titulo: 'Projeto Ativo',
      subtitulo: projetoCodigo || 'Cronograma & Marcos',
      icone: FolderGit2,
      link: projetoId ? `/projetos?id=${projetoId}` : '/projetos',
      codigo: projetoCodigo,
      isConcluida: temOsEmitida || etapaEfetiva === 'os',
      isAtiva: etapaEfetiva === 'projeto',
    },
    {
      id: 'os',
      titulo: 'Ordens de Serviço',
      subtitulo: 'Execução e Medição',
      icone: ClipboardList,
      link: projetoId ? `/projetos?id=${projetoId}&tab=pacotes` : '/monitoramento-prazos',
      isConcluida: false,
      isAtiva: etapaEfetiva === 'os',
    },
  ]

  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-xl p-2.5 sm:p-3 shadow-2xs mb-4 ${className}`}
      data-testid="trilha-do-negocio"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 px-1 text-[11px]">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <span className="w-2 h-2 rounded-full bg-[#D95A2B]" />
          <span>Trilha do Negócio G+</span>
          <span className="text-slate-400 font-normal hidden sm:inline">
            (Ciclo de Intermediação de Engenharia)
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
          Acesso Restrito: Perfis Internos
        </span>
      </div>

      <nav aria-label="Progresso do Negócio" className="overflow-x-auto scrollbar-thin pb-1">
        <ol className="flex items-center justify-between min-w-[640px] gap-1">
          {etapas.map((etapa, idx) => {
            const Icone = etapa.icone
            const isLast = idx === etapas.length - 1

            return (
              <React.Fragment key={etapa.id}>
                <li className="flex-1">
                  <Link
                    to={etapa.link}
                    className={`group flex items-center gap-2 p-1.5 sm:p-2 rounded-lg transition-all ${
                      etapa.isAtiva
                        ? 'bg-orange-50/80 border border-orange-200 text-[#D95A2B]'
                        : etapa.isConcluida
                          ? 'hover:bg-slate-50 text-slate-700'
                          : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                        etapa.isAtiva
                          ? 'bg-[#D95A2B] text-white shadow-2xs'
                          : etapa.isConcluida
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {etapa.isConcluida && !etapa.isAtiva ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <Icone className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-bold truncate ${
                            etapa.isAtiva
                              ? 'text-[#D95A2B]'
                              : etapa.isConcluida
                                ? 'text-slate-800'
                                : 'text-slate-400'
                          }`}
                        >
                          {etapa.titulo}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate font-mono">
                        {etapa.codigo || etapa.subtitulo}
                      </span>
                    </div>
                  </Link>
                </li>

                {!isLast && (
                  <li aria-hidden="true" className="px-0.5 text-slate-300 shrink-0">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </li>
                )}
              </React.Fragment>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
