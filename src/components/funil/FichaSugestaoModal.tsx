import React from 'react'
import { SugestaoFunilRecord } from '@/types'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { formatCnpj } from '@/lib/cnpj'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  FileText,
  Calendar,
  DollarSign,
  MapPin,
  Sparkles,
  ArrowRight,
  XCircle,
  CheckCircle,
} from 'lucide-react'

interface FichaSugestaoModalProps {
  sugestao: SugestaoFunilRecord | null
  open: boolean
  onClose: () => void
  onAprovar?: (sugestao: SugestaoFunilRecord) => void
  onDescartar?: (sugestao: SugestaoFunilRecord) => void
  onIncorporar?: (sugestao: SugestaoFunilRecord) => void
}

export function FichaSugestaoModal({
  sugestao,
  open,
  onClose,
  onAprovar,
  onDescartar,
  onIncorporar,
}: FichaSugestaoModalProps) {
  if (!sugestao) return null

  const getSancaoBadge = () => {
    const st = sugestao.status_sancao
    if (st === 'sancionada') {
      return (
        <Badge
          variant="outline"
          className="bg-rose-50 text-rose-800 border-rose-300 gap-1 text-[11px]"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          Sancionada (CEIS / CNEP)
        </Badge>
      )
    }
    if (st === 'sem_sancao') {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-800 border-emerald-300 gap-1 text-[11px]"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Sanção Verificada (Livre)
        </Badge>
      )
    }
    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-800 border-amber-300 gap-1 text-[11px]"
      >
        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
        Sanção Não Verificada
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#D95A2B]" />
                  {sugestao.nome_fantasia || sugestao.razao_social}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] bg-blue-50 text-blue-700 border-blue-200 uppercase"
                >
                  Fonte: {sugestao.fonte_prospeccao_slug || sugestao.fonte}
                </Badge>
                {getSancaoBadge()}
              </div>
              <DialogDescription className="text-xs text-slate-500">
                Razão Social: <strong>{sugestao.razao_social}</strong>
                {sugestao.cnpj && ` • CNPJ: ${formatCnpj(sugestao.cnpj)}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Alerta de Sanção Detalhada */}
          {sugestao.detalhe_sancao && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                sugestao.status_sancao === 'sancionada'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block">Registro de Sanção / Auditoria:</strong>
                <p className="mt-0.5 leading-relaxed">{sugestao.detalhe_sancao}</p>
              </div>
            </div>
          )}

          {/* Cards de Métricas Principais da Sugestão */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-medium block">
                Valor do Contrato
              </span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {formatCurrencyBr(sugestao.valor_estimado || 0)}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-medium block">
                Relevância / Score
              </span>
              <span className="font-mono font-bold text-[#D95A2B] text-sm">
                {sugestao.score_relevancia != null ? `${sugestao.score_relevancia}/100` : '—'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-medium block">Curva Provisória</span>
              <span className="font-mono font-bold text-blue-700 text-sm">
                Curva {sugestao.curva_provisoria || 'C'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-medium block">Localização</span>
              <span className="font-semibold text-slate-800 text-xs">
                {sugestao.municipio
                  ? `${sugestao.municipio}/${sugestao.uf}`
                  : sugestao.uf || 'Brasil'}
              </span>
            </div>
          </div>

          {/* Ficha Completa do Contrato de Origem */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                <FileText className="w-4 h-4 text-slate-600" />
                Dados do Contrato Público de Origem
              </span>
              {sugestao.link_fonte && (
                <a
                  href={sugestao.link_fonte}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-[11px] font-semibold inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Abrir link do contrato oficial
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 text-[11px] block font-medium">
                  Órgão Contratante:
                </span>
                <span className="font-semibold text-slate-800">
                  {sugestao.orgao_contrato || 'Órgão não informado'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block font-medium">
                  Número do Contrato:
                </span>
                <span className="font-mono font-semibold text-slate-800">
                  {sugestao.numero_contrato || '—'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block font-medium">
                  Início da Vigência:
                </span>
                <span className="text-slate-700">
                  {sugestao.vigencia_inicio
                    ? formatDateBr(sugestao.vigencia_inicio)
                    : 'Não informado'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block font-medium">
                  Fim da Vigência:
                </span>
                <span className="text-slate-700">
                  {sugestao.vigencia_fim ? formatDateBr(sugestao.vigencia_fim) : 'Não informado'}
                </span>
              </div>
            </div>

            {/* Objeto Completo */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-500 text-[11px] block font-medium mb-1">
                Objeto Completo do Contrato:
              </span>
              <div className="p-3 rounded-lg bg-slate-50 text-slate-800 leading-relaxed font-sans border border-slate-200 text-xs whitespace-pre-wrap">
                {sugestao.objeto_contrato || 'Objeto não especificado na fonte.'}
              </div>
            </div>

            {/* Justificativa da IA se houver */}
            {sugestao.justificativa_ia && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 text-[11px] block font-medium mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#D95A2B]" />
                  Justificativa de Classificação da IA:
                </span>
                <p className="text-slate-700 italic bg-orange-50/50 p-2.5 rounded border border-orange-100 text-xs">
                  {sugestao.justificativa_ia}
                </p>
              </div>
            )}
          </div>

          {/* Dados de Contato e Enriquecimento */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 text-[11px]">E-mail / Telefone:</span>
              <p className="font-medium text-slate-800">
                {sugestao.email || 'E-mail não informado'} • {sugestao.telefone || 'Sem telefone'}
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px]">CNAE Principal:</span>
              <p className="font-mono text-slate-800">{sugestao.cnae || 'Não informado'}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Fechar
          </Button>

          {sugestao.status === 'pendente' && (
            <div className="flex items-center gap-1.5">
              {onAprovar && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onAprovar(sugestao)
                    onClose()
                  }}
                  className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50 gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Aprovar
                </Button>
              )}
              {onDescartar && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onDescartar(sugestao)
                    onClose()
                  }}
                  className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50 gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Descartar
                </Button>
              )}
              {onIncorporar && (
                <Button
                  size="sm"
                  onClick={() => {
                    onIncorporar(sugestao)
                    onClose()
                  }}
                  className="bg-[#D95A2B] hover:bg-[#c24e24] text-white text-xs gap-1"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Incorporar ao Funil
                </Button>
              )}
            </div>
          )}

          {sugestao.status === 'aprovada_para_inclusao' && onIncorporar && (
            <Button
              size="sm"
              onClick={() => {
                onIncorporar(sugestao)
                onClose()
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Incorporar ao Funil
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
