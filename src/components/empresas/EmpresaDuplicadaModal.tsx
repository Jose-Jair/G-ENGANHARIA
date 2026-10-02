import React from 'react'
import { EmpresaRecord } from '@/types'
import { formatCnpj } from '@/lib/cnpj'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { AlertTriangle, Building2, ExternalLink, FileText } from 'lucide-react'

export interface EmpresaDuplicadaModalProps {
  open: boolean
  empresaDuplicada: EmpresaRecord | null
  nomeDigitado?: string
  onCancelarVoltar: () => void
  onIrParaContratos: () => void
  onCadastrarNovoContrato: () => void
}

export function EmpresaDuplicadaModal({
  open,
  empresaDuplicada,
  nomeDigitado,
  onCancelarVoltar,
  onIrParaContratos,
  onCadastrarNovoContrato,
}: EmpresaDuplicadaModalProps) {
  if (!open || !empresaDuplicada) {
    return null
  }

  const nomeExibicao =
    empresaDuplicada.nome_fantasia || empresaDuplicada.razao_social || nomeDigitado || 'Empresa'
  const razaoSocial = empresaDuplicada.razao_social

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancelarVoltar()}>
      <DialogContent
        className="w-full max-w-md p-6 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 text-slate-900"
        onEscapeKeyDown={(e) => {
          e.preventDefault()
          onCancelarVoltar()
        }}
        onPointerDownOutside={(e) => {
          // Previne fechamento involuntário por clique fora
          e.preventDefault()
        }}
      >
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900 text-left">
            Empresa já cadastrada no sistema
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 text-left leading-relaxed">
            Identificamos que a empresa{' '}
            <strong className="text-slate-900 font-semibold">{nomeExibicao}</strong>
            {razaoSocial && razaoSocial !== nomeExibicao && (
              <span className="block text-[11px] text-slate-500 font-normal">
                Razão: {razaoSocial}
              </span>
            )}
            {empresaDuplicada.cnpj && (
              <span className="block mt-0.5">
                CNPJ:{' '}
                <span className="font-mono font-medium">{formatCnpj(empresaDuplicada.cnpj)}</span>
              </span>
            )}{' '}
            já possui cadastro ativo na base do GESTÃO G+.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg text-xs text-amber-950 space-y-2">
          <p className="font-semibold flex items-center gap-1.5 text-amber-900">
            <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
            Deseja cadastrar um NOVO CONTRATO para esta empresa?
          </p>
          <p className="text-slate-600 leading-relaxed">
            Em vez de duplicar o cadastro, o sistema abrirá diretamente a ficha desta empresa na aba{' '}
            <strong className="text-slate-900">Contratos Públicos</strong> para você gerenciar ou
            lançar novos contratos.
          </p>
          <div className="pt-2 text-[11px] text-slate-500 border-t border-amber-200/60 flex flex-wrap gap-x-3 gap-y-1">
            <span>
              <strong>Etapa:</strong>{' '}
              <Badge variant="outline" className="text-[10px] py-0 px-1 bg-white border-slate-300">
                {empresaDuplicada.etapa_funil || 'identificada'}
              </Badge>
            </span>
            <span>
              <strong>Curva:</strong>{' '}
              <Badge
                variant="outline"
                className={`text-[10px] py-0 px-1 font-bold ${
                  empresaDuplicada.curva === 'A'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : empresaDuplicada.curva === 'B'
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                Curva {empresaDuplicada.curva || 'C'}
              </Badge>
            </span>
            {empresaDuplicada.municipio && (
              <span>
                <strong>Local:</strong> {empresaDuplicada.municipio}
                {empresaDuplicada.uf ? `/${empresaDuplicada.uf}` : ''}
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={onIrParaContratos}
              className="w-full text-xs font-medium border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ir para Contratos Públicos
            </Button>
            <Button
              type="button"
              onClick={onCadastrarNovoContrato}
              className="w-full text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white justify-center gap-1.5 shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              Sim, Cadastrar Novo Contrato
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancelarVoltar}
            className="w-full text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            Cancelar / Voltar ao formulário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
