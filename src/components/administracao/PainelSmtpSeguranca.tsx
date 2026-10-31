import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Server,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'

interface SelfcheckResultados {
  item1_api_rules?: {
    cotacoes_segura?: boolean
    subcontratos_segura?: boolean
    users_anti_escalonamento?: boolean
  }
  item2_protected_files?: {
    todos_protegidos?: boolean
    detalhes?: Record<string, boolean>
  }
  item3_token_security?: {
    campos_configurados?: boolean
    [key: string]: unknown
  }
  item4_telefones_json?: {
    campos_configurados?: boolean
    [key: string]: unknown
  }
  item5_modulo_prestadores?: {
    colecoes_criadas?: boolean
    os_regra_segura_sem_executor?: boolean
    contrato_mestre_regra_segura_sem_executor?: boolean
    portal_os_isolado_por_email?: boolean
    portal_entregaveis_isolado_por_email?: boolean
    portal_documentos_isolado_por_email?: boolean
    portal_os_sem_campos_sensiveis?: boolean
    contas_financeiro_isolado_sem_prestador?: boolean
    portal_os_sem_dados_financeiros_cliente?: boolean
    [key: string]: unknown
  }
  item6_colecoes_novas_cadeia_projetos?: {
    todas_conformes?: boolean
    detalhes?: Record<string, boolean>
  }
  item7_cotacao_automatica?: {
    todas_conformes?: boolean
    detalhes?: Record<string, unknown>
  }
  item8_assinatura_eletronica_otp?: {
    todas_conformes?: boolean
    detalhes?: Record<string, unknown>
  }
  item9_canal_comunicacao_os?: {
    todas_conformes?: boolean
    detalhes?: Record<string, unknown>
  }
  item10_monitoramento_cobranca_prazos?: {
    todas_conformes?: boolean
    detalhes?: Record<string, unknown>
  }
  item11_ia_operacao_chaves?: {
    todas_conformes?: boolean
    detalhes?: Record<string, unknown>
  }
  item12_smtp_operante?: {
    todas_conformes?: boolean
    detalhes?: {
      senderAddress?: string
      senderName?: string
      host?: string
      port?: number
      enabled?: boolean
      auth_user_configurado?: boolean
      status?: string
      motivo?: string
      erro?: string
    }
  }
  item15_custo_interno_real?: {
    todas_conformes?: boolean
    detalhes?: {
      colecoes_configuradas?: boolean
      custos_profissional_isolamento?: boolean
      apontamentos_isolamento_prestador?: boolean
      os_campos_custo_interno?: boolean
      parametros_administracao?: boolean
      erro?: string
    }
  }
  item16_scorecards_isolamento?: {
    todas_conformes?: boolean
    detalhes?: {
      colecoes_configuradas?: boolean
      scorecards_isolamento_prestador?: boolean
      parametros_versionados_imutaveis?: boolean
      parametros_ativos_configurados?: boolean
      erro?: string
    }
  }
  item17_ifc_bcf_issues?: {
    todas_conformes?: boolean
    detalhes?: {
      campo_resumo_ifc?: boolean
      campo_hash_sha256?: boolean
      campo_tamanho?: boolean
      colecao_issues_revisao?: boolean
      viewpoint_protegido?: boolean
      issues_isolamento_prestador?: boolean
      parametro_teto_ifc?: boolean
      teto_ifc_mb?: string
      erro?: string
    }
  }
  conformidade_geral?: boolean
}

export const PainelSmtpSeguranca: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loadingTestEmail, setLoadingTestEmail] = useState(false)
  const [loadingSelfcheck, setLoadingSelfcheck] = useState(false)
  const [selfcheckData, setSelfcheckData] = useState<{
    status: string
    timestamp: string
    resultados: SelfcheckResultados
  } | null>(null)
  const [ultimoTesteEmail, setUltimoTesteEmail] = useState<{
    sucesso: boolean
    mensagem: string
    data: string
    destinatario: string
  } | null>(null)

  const handleTestarEmail = async () => {
    setLoadingTestEmail(true)
    try {
      const res = await pb.send('/backend/v1/administracao/testar-email', {
        method: 'POST',
      })

      setUltimoTesteEmail({
        sucesso: true,
        mensagem: res.message || 'Mensagem de prova enviada com sucesso ao Admin!',
        data: new Date().toLocaleTimeString('pt-BR'),
        destinatario: user?.email || '',
      })

      toast({
        title: 'E-mail de teste disparado',
        description:
          res.message || `Prova enviada para ${user?.email}. Resultado gravado em auditoria.`,
      })

      // Atualiza o selfcheck automaticamente
      handleExecutarSelfcheck()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setUltimoTesteEmail({
        sucesso: false,
        mensagem: msg || 'Falha ao conectar com o serviço SMTP do backend.',
        data: new Date().toLocaleTimeString('pt-BR'),
        destinatario: user?.email || '',
      })

      toast({
        title: 'Falha no teste de e-mail',
        description: 'Verifique se o SMTP está habilitado e configurado no servidor.',
        variant: 'destructive',
      })
    } finally {
      setLoadingTestEmail(false)
    }
  }

  const handleExecutarSelfcheck = async () => {
    setLoadingSelfcheck(true)
    try {
      const res = await pb.send('/backend/v1/seguranca/selfcheck', {
        method: 'GET',
      })
      setSelfcheckData(res)
      toast({
        title: 'Selfcheck executado',
        description: `12 itens verificados no backend (${new Date().toLocaleTimeString('pt-BR')}).`,
      })
    } catch (err: unknown) {
      toast({
        title: 'Erro ao rodar selfcheck',
        description: err instanceof Error ? err.message : 'Falha na requisição.',
        variant: 'destructive',
      })
    } finally {
      setLoadingSelfcheck(false)
    }
  }

  const res = selfcheckData?.resultados
  const smtp = res?.item12_smtp_operante

  return (
    <div className="space-y-6">
      {/* CARD DO TESTE DE E-MAIL */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#D95A2B]" />
                Comunicação & Conectividade SMTP
              </CardTitle>
              <CardDescription className="text-xs">
                Dispara mensagem de prova ao Admin logado ({user?.email || 'Admin'}) pelo remetente
                configurado no servidor. Ação gravada em auditoria.
              </CardDescription>
            </div>
            <Button
              onClick={handleTestarEmail}
              disabled={loadingTestEmail}
              className="bg-[#D95A2B] hover:bg-[#b8451b] text-white text-xs gap-1.5 shadow-sm"
            >
              {loadingTestEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enviando prova...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Testar e-mail
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {ultimoTesteEmail && (
            <Alert
              className={`text-xs ${
                ultimoTesteEmail.sucesso
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              <div className="flex items-start gap-2">
                {ultimoTesteEmail.sucesso ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1">
                  <AlertTitle className="text-xs font-semibold">
                    {ultimoTesteEmail.sucesso
                      ? 'Envio concluído com sucesso'
                      : 'Falha no envio de e-mail'}
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    {ultimoTesteEmail.mensagem}
                    <div className="text-[11px] opacity-75 mt-0.5">
                      Destinatário: {ultimoTesteEmail.destinatario} | Horário:{' '}
                      {ultimoTesteEmail.data} | Log de auditoria gerado: TESTE_EMAIL_SMTP
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">
              Observação sobre a infraestrutura de e-mails (Skip Cloud):
            </p>
            <p>
              Os envios de propostas, convites de cotação e contratos utilizam o remetente e
              credenciais SMTP cadastradas nas configurações do servidor. Se o SMTP estiver
              desabilitado no painel, o sistema rejeitará envios externos e reportará status
              pendente no selfcheck (item 12).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CARD DO SELFCHECK DE SEGURANÇA (12 ITENS) */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Autochecagem de Segurança & Integridade (12 Itens)
              </CardTitle>
              <CardDescription className="text-xs">
                Varredura profunda executada diretamente no backend
                (/backend/v1/seguranca/selfcheck). Verifica isolamento por API rules, tokens,
                telefones, IA, monitoramento e SMTP.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={handleExecutarSelfcheck}
              disabled={loadingSelfcheck}
              className="text-xs gap-1.5"
            >
              {loadingSelfcheck ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  Verificando servidor...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Executar Selfcheck Agora
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {!selfcheckData ? (
            <div className="py-6 text-center text-slate-400 border border-dashed rounded-lg bg-slate-50/50">
              <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">
                Nenhum selfcheck carregado nesta sessão. Clique no botão acima para verificar os 12
                itens.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Conformidade Geral dos 12 Itens:
                  </span>
                  {res?.conformidade_geral ? (
                    <Badge className="bg-emerald-600 text-white text-xs gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      100% Conforme
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-400 bg-amber-50 text-amber-800 text-xs gap-1"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Atenção / Pendência Parcial
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {new Date(selfcheckData.timestamp).toLocaleString('pt-BR')}
                </span>
              </div>

              {/* LISTA DOS 12 ITENS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* 1. API Rules */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>1. API Rules & Anti-Escalonamento</span>
                    {res?.item1_api_rules?.cotacoes_segura &&
                    res?.item1_api_rules?.subcontratos_segura &&
                    res?.item1_api_rules?.users_anti_escalonamento ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Cotacoes, Subcontratos e restrição de alteração de role em _pb_users_auth_.
                  </p>
                </div>

                {/* 2. Arquivos protegidos */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>2. Arquivos Protegidos (Protected)</span>
                    {res?.item2_protected_files?.todos_protegidos ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    PDFs de contratos, propostas, contas e medições com flags protegidas.
                  </p>
                </div>

                {/* 3. Tokens de segurança */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>3. Tokens & Tentativas</span>
                    {res?.item3_token_security?.campos_configurados ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Expiração e contadores de tentativas configurados em coleções com token público.
                  </p>
                </div>

                {/* 4. Telefones JSON */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>4. Múltiplos Telefones (JSON)</span>
                    {res?.item4_telefones_json?.campos_configurados ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Estrutura de telefones em empresas, clientes PF e cadastros de prestadores.
                  </p>
                </div>

                {/* 5. Módulo Prestadores & Isolamento */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>5. Módulo Prestadores & Portal Seguro</span>
                    {res?.item5_modulo_prestadores?.portal_os_sem_campos_sensiveis &&
                    res?.item5_modulo_prestadores?.portal_os_isolado_por_email ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Segmentação restrita por email, sem dados de margem, bdi ou outros prestadores.
                  </p>
                </div>

                {/* 6. Cadeia de Projetos & Catálogo */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>6. Cadeia de Projetos & Escopos</span>
                    {res?.item6_colecoes_novas_cadeia_projetos?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Coleções catalogo_escopos e entregaveis_versoes restritas por perfil.
                  </p>
                </div>

                {/* 7. Cotação Automática */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>7. Cotação Automática Conforme</span>
                    {res?.item7_cotacao_automatica?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Campos novos de cotação e isolamento do prestador por email.
                  </p>
                </div>

                {/* 8. Assinatura Eletrônica & OTP */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>8. Assinatura Eletrônica (OTP/Dossiê)</span>
                    {res?.item8_assinatura_eletronica_otp?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Hash SHA-256, OTP de 6 dígitos e parâmetros jurídicos configurados.
                  </p>
                </div>

                {/* 9. Canal de Comunicação de OS */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>9. Canal de Comunicação de OS</span>
                    {res?.item9_canal_comunicacao_os?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Imutabilidade estrita de mensagens e isolamento do prestador.
                  </p>
                </div>

                {/* 10. Monitoramento & Cobrança de Prazos */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>10. Monitoramento & Cobrança de Prazos</span>
                    {res?.item10_monitoramento_cobranca_prazos?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Eventos de cobrança idempotentes e resumos diários para gestores.
                  </p>
                </div>

                {/* 11. IA a Serviço da Operação */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>11. IA Operacional (5 Parâmetros)</span>
                    {res?.item11_ia_operacao_chaves?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Chaves ia_escopo, ia_justificativa_prestador, ia_texto_canal, ia_resumo_dia e
                    ia_pre_revisao.
                  </p>
                </div>

                {/* 12. SMTP Operante (Novo Rodada 11) */}
                <div className="p-3 border rounded-lg bg-white space-y-1 ring-1 ring-[#D95A2B]/30">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-[#D95A2B]">12. SMTP Operante (Rodada 11)</span>
                    {smtp?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Status:{' '}
                    <strong className="text-slate-700">
                      {smtp?.detalhes?.status || 'Não consultado'}
                    </strong>
                    {smtp?.detalhes?.senderAddress && (
                      <span className="block text-[10px] text-slate-400">
                        Remetente: {smtp.detalhes.senderAddress}
                      </span>
                    )}
                    {smtp?.detalhes?.motivo && (
                      <span className="block text-[10px] text-amber-700">
                        {smtp.detalhes.motivo}
                      </span>
                    )}
                  </p>
                </div>

                {/* 15. Custo Interno Real (Novo Rodada 15) */}
                <div className="p-3 border rounded-lg bg-white space-y-1 ring-1 ring-[#D95A2B]/30">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-[#D95A2B]">15. Custo Interno Real & Isolamento</span>
                    {res?.item15_custo_interno_real?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Vigências protegidas:{' '}
                    <strong className="text-slate-700">
                      {res?.item15_custo_interno_real?.detalhes?.custos_profissional_isolamento
                        ? 'Sim (Admin/Fin)'
                        : 'Não'}
                    </strong>{' '}
                    | Apontamentos isolados por dono:{' '}
                    <strong className="text-slate-700">
                      {res?.item15_custo_interno_real?.detalhes?.apontamentos_isolamento_prestador
                        ? 'Sim'
                        : 'Não'}
                    </strong>
                  </p>
                </div>

                {/* 16. Scorecards & Parâmetros Versionados (Rodada 16) */}
                <div className="p-3 border rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span>16. Scorecards & Isolamento</span>
                    {res?.item16_scorecards_isolamento?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Isolamento do prestador:{' '}
                    <strong className="text-slate-700">
                      {res?.item16_scorecards_isolamento?.detalhes?.scorecards_isolamento_prestador
                        ? 'Conforme'
                        : 'Não'}
                    </strong>{' '}
                    | Parâmetros versionados:{' '}
                    <strong className="text-slate-700">
                      {res?.item16_scorecards_isolamento?.detalhes?.parametros_versionados_imutaveis
                        ? 'Sim'
                        : 'Não'}
                    </strong>
                  </p>
                </div>

                {/* 17. IFC / BCF & Issues de Revisão (Rodada 17) */}
                <div className="p-3 border rounded-lg bg-white space-y-1 ring-1 ring-blue-500/40">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-blue-700">17. IFC / BCF & Issues de Revisão</span>
                    {res?.item17_ifc_bcf_issues?.todas_conformes ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Hash SHA-256 & Resumo IFC:{' '}
                    <strong className="text-slate-700">
                      {res?.item17_ifc_bcf_issues?.detalhes?.campo_hash_sha256 &&
                      res?.item17_ifc_bcf_issues?.detalhes?.campo_resumo_ifc
                        ? 'Sim'
                        : 'Não'}
                    </strong>{' '}
                    | Isolamento Prestador:{' '}
                    <strong className="text-slate-700">
                      {res?.item17_ifc_bcf_issues?.detalhes?.issues_isolamento_prestador
                        ? 'Conforme'
                        : 'Não'}
                    </strong>{' '}
                    | Teto IFC:{' '}
                    <strong className="text-slate-700">
                      {res?.item17_ifc_bcf_issues?.detalhes?.teto_ifc_mb || '150'} MB
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
