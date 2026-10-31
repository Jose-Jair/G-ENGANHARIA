// =============================================================================
// GESTÃO G+ — COMPONENTE MODAL DE CHECKLIST E ENVIO DE VERSÃO IFC (RODADA 17)
// Bloqueia envios malformados com indicação do motivo e transmite o resumo
// validado via hash SHA-256 ao endpoint backend /backend/v1/entregaveis/{id}/versoes/{versao_id}/resumo-ifc
// =============================================================================

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
import {
  FileCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Loader2,
  Layers,
  UploadCloud,
  FileCode2,
  Building2,
  Compass,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  analisarEValidarIfc,
  extrairResumoIfcPayload,
  type ChecklistIfcResultado,
} from '@/services/ifcChecklistParser'
import { issuesRevisaoService } from '@/services/issuesRevisaoService'
import { entregaveisCicloService } from '@/services/cadeiaContratosProjetos'

export interface ModalChecklistEnvioIfcProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entregavelId: string
  entregavelNome: string
  disciplinaSugerida?: string
  onSucesso: (resultado: { versaoId: string; numeroVersao: number }) => void
}

export const ModalChecklistEnvioIfc: React.FC<ModalChecklistEnvioIfcProps> = ({
  open,
  onOpenChange,
  entregavelId,
  entregavelNome,
  disciplinaSugerida,
  onSucesso,
}) => {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ChecklistIfcResultado | null>(null)
  const [observacoes, setObservacoes] = useState('')

  const handleArquivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setArquivo(null)
      setResultado(null)
      return
    }

    setArquivo(file)
    setAnalisando(true)
    setResultado(null)

    try {
      const res = await analisarEValidarIfc(file, disciplinaSugerida)
      setResultado(res)
      if (!res.valido) {
        toast({
          title: 'IFC com inconformidades bloqueantes',
          description: `O arquivo possui ${res.bloqueios.length} erro(s) estruturais que impedem o envio.`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Checklist IFC Aprovado!',
          description: `Arquivo em conformidade: ${res.schema}, ${res.pavimentos.length} pavimento(s), ${res.totalElementos} elementos.`,
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao analisar arquivo IFC',
        description: err.message || 'Falha ao processar a estrutura STEP do arquivo.',
        variant: 'destructive',
      })
    } finally {
      setAnalisando(false)
    }
  }

  const handleConfirmarEnvio = async () => {
    if (!arquivo || !resultado) return
    if (!resultado.valido) {
      toast({
        title: 'Envio Bloqueado',
        description: 'Corrija os erros apontados no checklist antes de submeter a versão.',
        variant: 'destructive',
      })
      return
    }

    setEnviando(true)
    try {
      // 1. Submete a versão do entregável criando o registro da versão
      const submissao = await entregaveisCicloService.submeterVersao(entregavelId, observacoes)

      // 2. Transmite o resumo validado ao endpoint seguro resumo-ifc com hash SHA-256
      const resumoPayload = extrairResumoIfcPayload(resultado)
      await issuesRevisaoService.gravarResumoIfc(entregavelId, submissao.versao_id, {
        hash_sha256: resultado.hashSha256,
        tamanho: resultado.tamanhoBytes,
        resumo_ifc: resumoPayload,
      })

      toast({
        title: 'Versão IFC enviada com sucesso!',
        description: `Versão ${submissao.versao} registrada e metadados validados pelo servidor.`,
      })

      onSucesso({
        versaoId: submissao.versao_id,
        numeroVersao: submissao.versao,
      })
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao submeter versão IFC',
        description: err.message || 'Falha ao enviar arquivo ou gravar resumo IFC.',
        variant: 'destructive',
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#D95A2B] flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Checklist de Entrada & Envio de Versão IFC
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Entregável: <strong>"{entregavelNome}"</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Seleção do Arquivo IFC */}
          <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50/60 text-center space-y-2">
            <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
            <div>
              <Label
                htmlFor="ifc-upload-input"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Clique para selecionar o arquivo .ifc do seu computador
              </Label>
              <p className="text-[11px] text-slate-400">
                Formatos aceitos: IFC2x3 e IFC4 (teto máximo configurado na Administração)
              </p>
            </div>
            <Input
              id="ifc-upload-input"
              type="file"
              accept=".ifc,.ifczip"
              onChange={handleArquivoChange}
              disabled={analisando || enviando}
              className="hidden"
            />
            {arquivo && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-mono text-slate-700 shadow-sm mt-1">
                <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
                <span className="truncate max-w-xs">{arquivo.name}</span>
                <span className="text-[10px] text-slate-400">
                  ({(arquivo.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>
            )}
          </div>

          {/* Estado de Processamento */}
          {analisando && (
            <div className="p-6 text-center space-y-2 text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              <Loader2 className="w-6 h-6 animate-spin text-[#D95A2B] mx-auto" />
              <p className="text-xs font-medium text-slate-700">
                Executando checklist de entrada no navegador...
              </p>
              <p className="text-[11px] text-slate-400">
                Validando schema, pavimentos, unidades métricas e calculando hash SHA-256.
              </p>
            </div>
          )}

          {/* Resultado do Checklist */}
          {resultado && !analisando && (
            <div className="space-y-3">
              {/* Resumo Rápido */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 border rounded-lg">
                  <span className="text-[10px] text-slate-400 block">Schema</span>
                  <strong className="text-slate-800 font-mono text-xs">{resultado.schema}</strong>
                </div>
                <div className="p-2.5 bg-slate-50 border rounded-lg">
                  <span className="text-[10px] text-slate-400 block">Pavimentos</span>
                  <strong className="text-slate-800 text-xs">
                    {resultado.pavimentos.length} pavimento(s)
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 border rounded-lg">
                  <span className="text-[10px] text-slate-400 block">Total de Elementos</span>
                  <strong className="text-slate-800 text-xs">{resultado.totalElementos}</strong>
                </div>
                <div className="p-2.5 bg-slate-50 border rounded-lg">
                  <span className="text-[10px] text-slate-400 block">Hash SHA-256</span>
                  <strong
                    className="text-slate-800 font-mono text-[10px] truncate block"
                    title={resultado.hashSha256}
                  >
                    {resultado.hashSha256.slice(0, 10)}...
                  </strong>
                </div>
              </div>

              {/* Lista dos Itens do Checklist */}
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                <div className="p-2.5 bg-slate-100 font-semibold text-slate-700 text-[11px] flex items-center justify-between">
                  <span>Itens de Conformidade do Checklist Técnico</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold ${
                      resultado.valido
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}
                  >
                    {resultado.valido ? 'Aprovado para Envio' : 'Bloqueado por Inconformidade'}
                  </Badge>
                </div>

                {resultado.itensChecklist.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-start gap-2.5 bg-white">
                    {item.aprovado ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : item.bloqueante ? (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{item.descricao}</span>
                        {item.bloqueante && !item.aprovado && (
                          <Badge className="bg-rose-100 text-rose-800 text-[9px] px-1.5 py-0">
                            Bloqueante
                          </Badge>
                        )}
                      </div>
                      {item.detalhes && (
                        <p className="text-[11px] text-slate-500">{item.detalhes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Lista de Bloqueios */}
              {resultado.bloqueios.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Envio Bloqueado — Corrija os motivos abaixo:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                    {resultado.bloqueios.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Lista de Avisos Não-Bloqueantes */}
              {resultado.avisos.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Avisos de Alerta (Não impedem o envio):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px]">
                    {resultado.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notas do Envio */}
              <div className="space-y-1">
                <Label htmlFor="obs-ifc" className="text-xs font-semibold text-slate-700">
                  Observações Técnicas da Entrega (Opcional)
                </Label>
                <Input
                  id="obs-ifc"
                  placeholder="Ex: Modelo compatibilizado com pranchas estruturais v2..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!resultado || !resultado.valido || analisando || enviando}
            onClick={handleConfirmarEnvio}
            className="bg-[#D95A2B] hover:bg-[#c44e24] text-white gap-1.5 font-medium"
          >
            {enviando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                Validando & Enviando...
              </>
            ) : (
              <>
                <FileCheck className="w-3.5 h-3.5 mr-1" />
                Submeter Versão IFC
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ModalChecklistEnvioIfc
