import React, { useState, useEffect } from 'react'
import {
  FileCheck2,
  Download,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Lock,
  Copy,
  CheckCircle,
  ExternalLink,
  Clock,
  User,
  Globe,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  assinaturaEletronicaService,
  DossiêEvidenciasOSResponse,
} from '@/services/assinaturaEletronica'
import { formatDateBr, formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

interface ModalDossieEvidenciasOSProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  osId: string | null
  numeroOS?: string
}

export const ModalDossieEvidenciasOS: React.FC<ModalDossieEvidenciasOSProps> = ({
  open,
  onOpenChange,
  osId,
  numeroOS = '',
}) => {
  const { toast } = useToast()
  const [dossie, setDossie] = useState<DossiêEvidenciasOSResponse | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erroPermissao, setErroPermissao] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (open && osId) {
      carregarDossie(osId)
    } else {
      setDossie(null)
      setErroPermissao(null)
    }
  }, [open, osId])

  const carregarDossie = async (id: string) => {
    setCarregando(true)
    setErroPermissao(null)
    try {
      const data = await assinaturaEletronicaService.getDossieOS(id)
      setDossie(data)
    } catch (err: any) {
      if (err.status === 403 || (err.message && err.message.includes('403'))) {
        setErroPermissao(
          'Acesso Restrito: Apenas usuários com perfil Administrador ou Gestor de Projetos podem visualizar o Dossiê de Evidências Digitais.',
        )
      } else {
        setErroPermissao(
          err.message || 'Erro ao carregar dossiê de evidências digitais da Ordem de Serviço.',
        )
      }
    } finally {
      setCarregando(false)
    }
  }

  const handleBaixarJson = () => {
    if (!dossie) return
    try {
      const jsonStr = JSON.stringify(dossie, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dossie_evidencias_${dossie.numero || 'os'}_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: 'Dossiê exportado com sucesso!',
        description: 'Arquivo JSON com evidências e hashes baixado.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao baixar arquivo',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleCopiarHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
    toast({
      title: 'Hash SHA-256 copiado!',
      description: 'Código de integridade copiado para a área de transferência.',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 rounded-lg text-white">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-base text-slate-900">
                Dossiê de Evidências Digitais — {numeroOS || dossie?.numero || 'OS'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Auditoria jurídica e integridade criptográfica (MP 2.200-2/2001 e Lei 14.063/2020)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {carregando ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#D95A2B]" />
            <span className="text-xs text-slate-500">Consultando integridade do servidor...</span>
          </div>
        ) : erroPermissao ? (
          <div className="py-6 space-y-4">
            <Alert variant="destructive">
              <Lock className="w-4 h-4 mr-2 shrink-0" />
              <AlertDescription className="text-xs leading-relaxed">
                {erroPermissao}
              </AlertDescription>
            </Alert>
          </div>
        ) : dossie ? (
          <div className="space-y-4 text-xs">
            {/* Status do Aceite e Selo de Integridade */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Estado de Aceite Jurídico:</span>
                <Badge
                  className={
                    dossie.aceite_status === 'aceito'
                      ? 'bg-emerald-600 text-white'
                      : dossie.aceite_status === 'aguardando_codigo'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-500 text-white'
                  }
                >
                  {dossie.aceite_status === 'aceito'
                    ? '✓ Aceite Formalizado e Válido'
                    : dossie.aceite_status === 'aguardando_codigo'
                      ? 'Aguardando Validação OTP'
                      : 'Pendente de Aceite'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">
                    Tipo de Execução
                  </span>
                  <span className="font-semibold text-slate-800">
                    {dossie.tipo_prestador === 'interno'
                      ? 'Equipe Interna (Aceite Simplificado)'
                      : 'Prestador Externo (OTP 6 dígitos)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">
                    Data e Hora do Aceite (UTC)
                  </span>
                  <span className="font-mono text-slate-800">
                    {dossie.data_aceite ? formatDateBr(dossie.data_aceite) : 'Ainda não registrado'}
                  </span>
                </div>
              </div>
            </div>

            {/* Dados do Signatário e Rede */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Signatário Registrado
                </div>
                <div className="text-slate-600 space-y-0.5">
                  <p className="font-medium text-slate-900">
                    {dossie.assinante_prestador_nome || dossie.prestador_nome || 'Não identificado'}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500">
                    {dossie.assinante_prestador_doc ||
                      dossie.prestador_documento ||
                      'Sem documento'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  Origem do Acesso
                </div>
                <div className="text-slate-600 space-y-0.5 font-mono text-[11px]">
                  <p>
                    IP:{' '}
                    <strong className="text-slate-900">{dossie.aceite_ip || '127.0.0.1'}</strong>
                  </p>
                  <p className="truncate text-slate-400" title={dossie.aceite_user_agent}>
                    Agent: {dossie.aceite_user_agent || 'Navegador Web'}
                  </p>
                </div>
              </div>
            </div>

            {/* Hashes Criptográficos SHA-256 */}
            <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">
                  Hash SHA-256 do Documento Congelado
                </span>
                {dossie.pdf_congelado_hash && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopiarHash(dossie.pdf_congelado_hash!)}
                    className="h-6 text-[10px] gap-1 text-slate-600"
                  >
                    {copiado ? (
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiado ? 'Copiado!' : 'Copiar Hash'}
                  </Button>
                )}
              </div>
              <div className="font-mono text-[11px] bg-white p-2 border border-slate-200 rounded break-all text-slate-700">
                {dossie.pdf_congelado_hash ||
                  dossie.versao_texto_hash ||
                  'Nenhum hash gerado até o momento.'}
              </div>
            </div>

            {/* JSON Bruto do Dossiê */}
            {dossie.dossie_evidencias_json && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Conteúdo Estruturado do Dossiê (JSON)
                </span>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono max-h-40 overflow-y-auto">
                  {JSON.stringify(dossie.dossie_evidencias_json, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="pt-2 border-t flex sm:justify-between items-center">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {dossie && !erroPermissao && (
            <Button
              size="sm"
              onClick={handleBaixarJson}
              className="bg-[#1E2A4A] hover:bg-[#141D34] text-white gap-1.5"
            >
              <Download className="w-4 h-4" />
              Exportar Dossiê (JSON)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
export default ModalDossieEvidenciasOS
