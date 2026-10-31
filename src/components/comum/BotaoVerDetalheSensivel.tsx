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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ShieldAlert, Eye, Lock, Loader2, CheckCircle2 } from 'lucide-react'
import { sigiloAuditService } from '@/services/sigiloAuditService'
import { formatCurrencyBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

export type TipoDadoSensivel =
  | 'prestador_banco_custo'
  | 'cotacao_preco'
  | 'pre_cotacao_preco'
  | 'contrato_publico_valor'

interface BotaoVerDetalheSensivelProps {
  tipo: TipoDadoSensivel
  registroId: string
  titulo?: string
  descricao?: string
  labelBotao?: string
  className?: string
  size?: 'default' | 'sm' | 'lg' | 'icon'
  variant?: 'outline' | 'default' | 'ghost' | 'secondary'
}

export const BotaoVerDetalheSensivel: React.FC<BotaoVerDetalheSensivelProps> = ({
  tipo,
  registroId,
  titulo = 'Acesso a Dado Sensível',
  descricao = 'A visualização deste dado confidencial será gravada de forma imutável nos logs de auditoria do sistema.',
  labelBotao = 'Ver Detalhe',
  className = '',
  size = 'sm',
  variant = 'outline',
}) => {
  const { toast } = useToast()
  const [modalAvisoOpen, setModalAvisoOpen] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<any | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const handleConfirmarLeitura = async () => {
    setCarregando(true)
    setErro(null)
    try {
      if (tipo === 'prestador_banco_custo') {
        const resp = await sigiloAuditService.getPrestadorSensivel(registroId)
        if (!resp.sucesso) {
          setErro(resp.erro || 'Falha ao consultar dados do prestador.')
        } else {
          setResultado(resp.dados)
        }
      } else if (tipo === 'cotacao_preco') {
        const resp = await sigiloAuditService.getCotacaoPreco(registroId)
        if (!resp.sucesso) {
          setErro(resp.erro || 'Falha ao consultar preço da cotação.')
        } else {
          setResultado(resp.dados)
        }
      } else if (tipo === 'pre_cotacao_preco') {
        const resp = await sigiloAuditService.getPreCotacaoRespostaPreco(registroId)
        if (!resp.sucesso) {
          setErro(resp.erro || 'Falha ao consultar preço da pré-cotação.')
        } else {
          setResultado(resp.dados)
        }
      } else if (tipo === 'contrato_publico_valor') {
        const resp = await sigiloAuditService.getContratoPublicoValor(registroId)
        if (!resp.sucesso) {
          setErro(resp.erro || 'Falha ao consultar valor do contrato público.')
        } else {
          setResultado(resp.dados)
        }
      }
    } catch (e: any) {
      setErro(e?.message || 'Erro inesperado na consulta segura.')
    } finally {
      setCarregando(false)
    }
  }

  const handleFechar = () => {
    setModalAvisoOpen(false)
    setResultado(null)
    setErro(null)
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => {
          setResultado(null)
          setErro(null)
          setModalAvisoOpen(true)
        }}
        className={`text-xs gap-1.5 border-orange-200 text-[#D95A2B] hover:bg-orange-50 font-medium ${className}`}
        title="Consultar dado protegido por matriz de sigilo (com auditoria imutável)"
      >
        <Lock className="w-3.5 h-3.5 text-[#D95A2B]" />
        <span>{labelBotao}</span>
      </Button>

      <Dialog open={modalAvisoOpen} onOpenChange={setModalAvisoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-[#1E2A4A]">
              <ShieldAlert className="w-5 h-5 text-[#D95A2B]" />
              <DialogTitle className="text-base">{titulo}</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-600">{descricao}</DialogDescription>
          </DialogHeader>

          {!resultado && !erro && (
            <div className="space-y-3 py-2">
              <Alert className="bg-amber-50 border-amber-200 text-amber-900 text-xs">
                <AlertDescription className="space-y-1">
                  <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                    Aviso Legal de Sigilo e Confidencialidade
                  </p>
                  <p>
                    Seu usuário, endereço IP, data e hora da abertura deste campo serão registrados
                    de forma imutável nos <strong>Logs de Auditoria</strong> do sistema.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded border border-slate-200 font-mono">
                Entidade ID: {registroId}
              </div>
            </div>
          )}

          {erro && (
            <Alert className="bg-rose-50 border-rose-200 text-rose-800 text-xs my-2">
              <AlertDescription className="font-medium">{erro}</AlertDescription>
            </Alert>
          )}

          {resultado && (
            <div className="space-y-3 py-2">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Acesso Concedido e Registrado na Auditoria</span>
                </div>

                {tipo === 'prestador_banco_custo' && (
                  <div className="space-y-1.5 text-slate-800 font-sans pt-1">
                    <div className="font-semibold text-slate-900">{resultado.nome}</div>
                    <div className="text-[11px] text-slate-600">
                      Vínculo: {resultado.tipo_vinculo}
                    </div>

                    <div className="p-2 bg-white rounded border border-slate-200 space-y-1 mt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Dados Bancários
                      </span>
                      {resultado.dados_bancarios ? (
                        <p className="font-mono text-xs text-slate-900 whitespace-pre-wrap">
                          {resultado.dados_bancarios}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          {resultado.dados_bancarios_ocultados_motivo ||
                            'Nenhum dado bancário cadastrado'}
                        </p>
                      )}
                    </div>

                    <div className="p-2 bg-white rounded border border-slate-200 grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Custo-Hora
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {resultado.custo_hora !== null
                            ? `${formatCurrencyBr(resultado.custo_hora)}/h`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          Custo Mensal
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {resultado.custo_mensal !== null
                            ? formatCurrencyBr(resultado.custo_mensal)
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {tipo === 'cotacao_preco' && (
                  <div className="space-y-1 text-slate-800 font-sans pt-1">
                    <div className="font-semibold text-slate-900">Cotação: {resultado.codigo}</div>
                    <div className="p-2 bg-white rounded border border-slate-200 mt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Preço Ofertado
                      </span>
                      <span className="font-mono text-base font-bold text-emerald-700">
                        {formatCurrencyBr(resultado.preco_ofertado || 0)}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Prazo: {resultado.prazo_dias} dia(s)
                      </div>
                    </div>
                  </div>
                )}

                {tipo === 'pre_cotacao_preco' && (
                  <div className="space-y-1 text-slate-800 font-sans pt-1">
                    <div className="font-semibold text-slate-900">
                      Pré-Cotação: {resultado.codigo_pre_cotacao}
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200 mt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Preço Ofertado
                      </span>
                      <span className="font-mono text-base font-bold text-emerald-700">
                        {formatCurrencyBr(resultado.preco_ofertado || 0)}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Prazo: {resultado.prazo_ofertado_dias} dia(s)
                      </div>
                    </div>
                  </div>
                )}

                {tipo === 'contrato_publico_valor' && (
                  <div className="space-y-1 text-slate-800 font-sans pt-1">
                    <div className="font-semibold text-slate-900">
                      Edital: {resultado.numero_edital || 'S/N'}
                    </div>
                    <div className="text-[11px] text-slate-600">Órgão: {resultado.orgao}</div>
                    <div className="p-2 bg-white rounded border border-slate-200 mt-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Valor do Contrato Público
                      </span>
                      <span className="font-mono text-base font-bold text-[#1E2A4A]">
                        {formatCurrencyBr(resultado.valor || 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!resultado ? (
              <>
                <Button variant="outline" size="sm" onClick={handleFechar} disabled={carregando}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmarLeitura}
                  disabled={carregando}
                  className="bg-[#D95A2B] hover:bg-[#b84820] text-white"
                >
                  {carregando ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Consultando...
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      Confirmar e Ver
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleFechar} className="bg-slate-800 text-white">
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
