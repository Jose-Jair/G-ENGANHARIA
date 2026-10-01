import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, Mail, Info, Send, Building2 } from 'lucide-react'
import { ContagemDestinatariosNutricao } from '@/services/nutricao'

interface PreviaCampanhaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assunto: string
  corpo: string
  segmento: 'A' | 'B' | 'C' | 'todos'
  contagem?: ContagemDestinatariosNutricao
  exemploEmpresa?: {
    nome: string
    orgao: string
    valor_contrato: string
  }
}

export function PreviaCampanhaModal({
  open,
  onOpenChange,
  assunto,
  corpo,
  segmento,
  contagem,
  exemploEmpresa = {
    nome: 'Carlos Eduardo (Diretor Operacional)',
    orgao: 'Secretaria de Infraestrutura e Meio Ambiente de SP',
    valor_contrato: '18.500.000,00',
  },
}: PreviaCampanhaModalProps) {
  const [empresaExemplo, setEmpresaExemplo] = useState(exemploEmpresa)

  // Link fictício de descadastro para prévia
  const linkDescadastroSimulado = 'https://sistema.eng.br/descadastro/token-seguro-exemplo'

  // Substituição de variáveis
  const renderAssunto = assunto
    .replace(/\{nome\}/g, empresaExemplo.nome)
    .replace(/\{orgao\}/g, empresaExemplo.orgao)
    .replace(/\{valor_contrato\}/g, empresaExemplo.valor_contrato)

  let renderCorpo = corpo
    .replace(/\{nome\}/g, empresaExemplo.nome)
    .replace(/\{orgao\}/g, empresaExemplo.orgao)
    .replace(/\{valor_contrato\}/g, empresaExemplo.valor_contrato)
    .replace(/\{link_descadastro\}/g, linkDescadastroSimulado)

  if (!renderCorpo.includes(linkDescadastroSimulado)) {
    renderCorpo += `\n\n---\nLink de Descadastro (LGPD Obrigatório):\n${linkDescadastroSimulado}`
  }

  const destinatariosEstimados = contagem
    ? segmento === 'todos'
      ? contagem.total
      : segmento === 'A'
        ? contagem.curvaA
        : segmento === 'B'
          ? contagem.curvaB
          : contagem.curvaC
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              Prévia de Visualização do E-mail (Como chegará ao destinatário)
            </DialogTitle>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 font-mono text-xs">
              Segmento: Curva {segmento === 'todos' ? 'Todas (A/B/C)' : segmento}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Confira como as variáveis {'{nome}'}, {'{orgao}'}, {'{valor_contrato}'} e{' '}
            {'{link_descadastro}'} são renderizadas para as empresas elegíveis da nutrição mensal.
          </DialogDescription>
        </DialogHeader>

        {/* Informações de Segmentação e Auditoria */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div>
            <span className="text-slate-500 block">Destinatários estimados:</span>
            <span className="font-bold text-slate-800 text-sm">
              {destinatariosEstimados} empresa(s)
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Critério de bloqueio:</span>
            <span className="font-medium text-emerald-700">Não Contatar + Parceiras</span>
          </div>
          <div>
            <span className="text-slate-500 block">Mecanismo de rastreamento:</span>
            <span className="font-medium text-slate-700">Pixel 1x1 + Links Redirecionáveis</span>
          </div>
        </div>

        {/* Simulador de variáveis */}
        <div className="p-3 border border-blue-100 bg-blue-50/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900">
            <Building2 className="w-4 h-4 text-blue-600" />
            Dados fictícios da empresa de exemplo para teste de variáveis:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label className="text-[11px] text-slate-600">Contato {'{nome}'}</Label>
              <Input
                size={1}
                value={empresaExemplo.nome}
                onChange={(e) => setEmpresaExemplo({ ...empresaExemplo, nome: e.target.value })}
                className="h-7 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">Órgão {'{orgao}'}</Label>
              <Input
                size={1}
                value={empresaExemplo.orgao}
                onChange={(e) => setEmpresaExemplo({ ...empresaExemplo, orgao: e.target.value })}
                className="h-7 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-[11px] text-slate-600">
                Valor Contrato {'{valor_contrato}'}
              </Label>
              <Input
                size={1}
                value={empresaExemplo.valor_contrato}
                onChange={(e) =>
                  setEmpresaExemplo({ ...empresaExemplo, valor_contrato: e.target.value })
                }
                className="h-7 text-xs bg-white"
              />
            </div>
          </div>
        </div>

        {/* Preview do E-mail */}
        <div className="border border-slate-300 rounded-lg overflow-hidden shadow-xs">
          {/* Header do Cliente de E-mail */}
          <div className="bg-slate-100 border-b border-slate-200 p-3 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">De:</span>
              <span className="font-medium text-slate-700">
                Engenharia Contratos — Parcerias &lt;nao-responder@skip.dev&gt;
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Para:</span>
              <span className="font-medium text-slate-700">
                {empresaExemplo.nome} &lt;contato@empresa.com.br&gt;
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="text-slate-500">Assunto:</span>
              <span className="font-bold text-slate-900">{renderAssunto || '(Sem assunto)'}</span>
            </div>
          </div>

          {/* Corpo do e-mail */}
          <div className="p-6 bg-white min-h-[220px]">
            <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
              {renderCorpo}
            </div>

            {/* Simulação do Pixel invisível */}
            <div className="mt-8 pt-4 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                [Pixel invisível de rastreamento de abertura 1x1 incluído automaticamente]
              </span>
              <span className="font-mono text-[10px]">track_token=preview-test</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Taxas de abertura podem sofrer variações por clientes de e-mail com bloqueio de imagem.
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar Prévia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
