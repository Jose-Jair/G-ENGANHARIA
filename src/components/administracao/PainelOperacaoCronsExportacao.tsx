// src/components/administracao/PainelOperacaoCronsExportacao.tsx
// GESTÃO G+ — RODADA 19: OPERAÇÃO DO SISTEMA
// Painel Administrativo de:
// 1. Exportação semanal + botão "Exportar agora" auditado + link do último JSON
// 2. Monitoramento de "Último Sucesso" das rotinas de Cron com alerta de 2x intervalo
// 3. Consulta da coleção erros_sistema com rota, mensagem, usuário e hora
// 4. Parâmetros de tamanho máximo por tipo de arquivo (IFC, DWG, PDF, imagem)
// 5. Botão de Snapshot pré-migração de dados

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import {
  Download,
  Play,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HardDrive,
  ShieldAlert,
  Save,
  RefreshCw,
  FileText,
  Camera,
  Layers,
  Database,
} from 'lucide-react'
import {
  obterStatusCrons,
  executarExportacaoAgora,
  obterUltimaExportacao,
  listarErrosSistema,
  obterLimitesUpload,
  salvarLimitesUpload,
  gerarSnapshotPreMigracao,
  type CronRotinaStatus,
  type CronAlertaAtraso,
  type ErroSistemaItem,
  type LimitesUploadTipos,
  type ExportacaoInfo,
} from '@/services/operacaoSistema'

export function PainelOperacaoCronsExportacao() {
  const { toast } = useToast()
  const [abaAtiva, setAbaAtiva] = useState<
    'crons' | 'exportacao' | 'erros' | 'limites' | 'snapshot'
  >('crons')

  // Estados de Crons
  const [carregandoCrons, setCarregandoCrons] = useState(false)
  const [rotinas, setRotinas] = useState<CronRotinaStatus[]>([])
  const [alertasCrons, setAlertasCrons] = useState<CronAlertaAtraso[]>([])

  // Estados de Exportação
  const [exportando, setExportando] = useState(false)
  const [ultimaExportacao, setUltimaExportacao] = useState<ExportacaoInfo | null>(null)
  const [carregandoExport, setCarregandoExport] = useState(false)

  // Estados de Erros de Sistema
  const [erros, setErros] = useState<ErroSistemaItem[]>([])
  const [totalErros, setTotalErros] = useState(0)
  const [carregandoErros, setCarregandoErros] = useState(false)

  // Estados de Limites de Upload
  const [limites, setLimites] = useState<LimitesUploadTipos>({
    ifc: { max_mb: 150, max_bytes: 150 * 1024 * 1024, extensoes: ['.ifc', '.ifczip'] },
    dwg: { max_mb: 100, max_bytes: 100 * 1024 * 1024, extensoes: ['.dwg', '.dxf'] },
    pdf: { max_mb: 50, max_bytes: 50 * 1024 * 1024, extensoes: ['.pdf'] },
    imagem: {
      max_mb: 25,
      max_bytes: 25 * 1024 * 1024,
      extensoes: ['.png', '.jpg', '.jpeg', '.webp'],
    },
  })
  const [formLimites, setFormLimites] = useState({
    ifc_mb: 150,
    dwg_mb: 100,
    pdf_mb: 50,
    imagem_mb: 25,
  })
  const [salvandoLimites, setSalvandoLimites] = useState(false)

  // Estado de Snapshot
  const [gerandoSnapshot, setGerandoSnapshot] = useState(false)
  const [ultimoSnapshot, setUltimoSnapshot] = useState<any>(null)

  // Carregar dados iniciais
  useEffect(() => {
    carregarCrons()
    carregarExportacao()
    carregarErros()
    carregarLimites()
  }, [])

  const carregarCrons = async () => {
    setCarregandoCrons(true)
    try {
      const res = await obterStatusCrons()
      setRotinas(res.rotinas || [])
      setAlertasCrons(res.alertas || [])
    } catch (_) {
      toast({
        title: 'Aviso',
        description: 'Não foi possível carregar os crons em tempo real.',
        variant: 'destructive',
      })
    } finally {
      setCarregandoCrons(false)
    }
  }

  const carregarExportacao = async () => {
    setCarregandoExport(true)
    try {
      const res = await obterUltimaExportacao()
      if (res.sucesso && res.exportacao) {
        setUltimaExportacao(res.exportacao)
      }
    } catch {
      /* intentionally ignored */
    } finally {
      setCarregandoExport(false)
    }
  }

  const carregarErros = async () => {
    setCarregandoErros(true)
    try {
      const res = await listarErrosSistema()
      if (res.sucesso) {
        setErros(res.erros || [])
        setTotalErros(res.total || 0)
      }
    } catch {
      /* intentionally ignored */
    } finally {
      setCarregandoErros(false)
    }
  }

  const carregarLimites = async () => {
    try {
      const res = await obterLimitesUpload()
      if (res.limites_por_tipo) {
        setLimites(res.limites_por_tipo)
        setFormLimites({
          ifc_mb: res.limites_por_tipo.ifc.max_mb,
          dwg_mb: res.limites_por_tipo.dwg.max_mb,
          pdf_mb: res.limites_por_tipo.pdf.max_mb,
          imagem_mb: res.limites_por_tipo.imagem.max_mb,
        })
      }
    } catch {
      /* intentionally ignored */
    }
  }

  const handleExportarAgora = async () => {
    setExportando(true)
    try {
      const res = await executarExportacaoAgora()
      if (res.sucesso) {
        toast({
          title: 'Exportação Concluída com Sucesso',
          description: `Foram exportados ${res.export_info.total_registros} registros em ${res.export_info.total_colecoes} coleções. Auditoria gerada.`,
        })
        setUltimaExportacao(res.export_info)
        // Disparar download em JSON para conveniência imediata do admin
        const blob = new Blob([JSON.stringify(res.dados, null, 2)], {
          type: 'application/json',
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `gestao_gplus_exportacao_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        carregarCrons()
      }
    } catch (err: any) {
      toast({
        title: 'Falha na Exportação',
        description: err?.message || 'Não foi possível concluir a exportação dos dados.',
        variant: 'destructive',
      })
    } finally {
      setExportando(false)
    }
  }

  const handleSalvarLimites = async () => {
    setSalvandoLimites(true)
    try {
      await salvarLimitesUpload({
        upload_max_ifc_mb: Number(formLimites.ifc_mb),
        upload_max_dwg_mb: Number(formLimites.dwg_mb),
        upload_max_pdf_mb: Number(formLimites.pdf_mb),
        upload_max_imagem_mb: Number(formLimites.imagem_mb),
      })
      toast({
        title: 'Limites Atualizados',
        description: 'Tamanhos máximos salvos com sucesso e registrados na auditoria.',
      })
      carregarLimites()
    } catch (err: any) {
      toast({
        title: 'Erro ao Salvar',
        description: err?.message || 'Falha ao salvar parâmetros de upload.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoLimites(false)
    }
  }

  const handleGerarSnapshot = async () => {
    setGerandoSnapshot(true)
    try {
      const res = await gerarSnapshotPreMigracao('limpeza_ou_migracao_manual', [
        'contas',
        'ordens_servico',
        'contratos',
        'projetos',
        'propostas',
        'empresas',
      ])
      if (res.sucesso) {
        setUltimoSnapshot(res.snapshot)
        toast({
          title: 'Snapshot de Segurança Gerado',
          description: `Total de ${res.snapshot.total_linhas_afetadas} registros catalogados e auditados imutavelmente.`,
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro no Snapshot',
        description: err?.message || 'Não foi possível gerar snapshot prévio.',
        variant: 'destructive',
      })
    } finally {
      setGerandoSnapshot(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#1E2A4A] flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-[#D95A2B]" />
            Operação do Sistema, Crons & Confiabilidade
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitoramento de rotinas agendadas (2× intervalo), exportação semanal com link
            protegido, rastreio de erros de sistema e tetos de upload.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            carregarCrons()
            carregarExportacao()
            carregarErros()
            carregarLimites()
          }}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar Painel
        </Button>
      </div>

      {alertasCrons.length > 0 && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span>
              Atenção Operacional: {alertasCrons.length} rotina(s) sem rodar há mais de 2× seu
              intervalo!
            </span>
          </div>
          <ul className="list-disc list-inside text-xs space-y-1 pl-2">
            {alertasCrons.map((alt, idx) => (
              <li key={idx}>
                <strong>{alt.nome}:</strong> {alt.mensagem}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tabs value={abaAtiva} onValueChange={(v: any) => setAbaAtiva(v)}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-1">
          <TabsTrigger value="crons" className="gap-2">
            <Clock className="h-4 w-4" />
            Rotinas Crons ({rotinas.length})
          </TabsTrigger>
          <TabsTrigger value="exportacao" className="gap-2">
            <Download className="h-4 w-4" />
            Exportação Semanal
          </TabsTrigger>
          <TabsTrigger value="erros" className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            Erros Sistema ({totalErros})
          </TabsTrigger>
          <TabsTrigger value="limites" className="gap-2">
            <HardDrive className="h-4 w-4" />
            Tetos de Upload
          </TabsTrigger>
          <TabsTrigger value="snapshot" className="gap-2">
            <Database className="h-4 w-4" />
            Snapshot de Dados
          </TabsTrigger>
        </TabsList>

        {/* 1. ABA ROTINAS CRONS */}
        <TabsContent value="crons" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#D95A2B]" />
                Rotinas Automáticas Agendadas & Último Sucesso
              </CardTitle>
              <CardDescription>
                Cada rotina reporta sua última execução confirmada. Se ultrapassar 2× o intervalo
                previsto, alertas imediatos são disparados na Central de Ações e no painel Decisões.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {carregandoCrons ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Carregando status das rotinas de cron...
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rotina Operacional</TableHead>
                      <TableHead>Intervalo Nominal</TableHead>
                      <TableHead>Último Sucesso</TableHead>
                      <TableHead>Tempo Decorrido</TableHead>
                      <TableHead>Status Tolerância (2×)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rotinas.map((r) => (
                      <TableRow key={r.chave}>
                        <TableCell>
                          <div className="font-medium text-sm text-[#1E2A4A]">{r.nome}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.job_id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.intervalo_label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.ultimo_sucesso ? (
                            new Date(r.ultimo_sucesso).toLocaleString('pt-BR')
                          ) : (
                            <span className="text-muted-foreground italic">Nenhuma execução</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.minutos_desde_ultimo !== null
                            ? r.minutos_desde_ultimo < 60
                              ? `${r.minutos_desde_ultimo} min atrás`
                              : `${Math.round(r.minutos_desde_ultimo / 60)}h atrás`
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {r.atrasado_2x ? (
                            <Badge className="bg-red-600 text-white flex items-center gap-1 w-fit">
                              <AlertTriangle className="h-3 w-3" />
                              Atrasada (&gt;2×)
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-600 text-white flex items-center gap-1 w-fit">
                              <CheckCircle2 className="h-3 w-3" />
                              Operante
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. ABA EXPORTAÇÃO */}
        <TabsContent value="exportacao" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-4 w-4 text-[#D95A2B]" />
                    Exportação Semanal de Dados & Backup
                  </CardTitle>
                  <CardDescription>
                    Gera JSON por coleção com índice estruturado. Toda execução é auditada. E-mail é
                    enviado ao Admin caso o SMTP esteja operante.
                  </CardDescription>
                </div>

                <Button
                  onClick={handleExportarAgora}
                  disabled={exportando}
                  className="bg-[#D95A2B] hover:bg-[#c04d22] text-white gap-2"
                >
                  <Play className="h-4 w-4" />
                  {exportando ? 'Exportando e auditando...' : 'Exportar agora'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {carregandoExport ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Consultando última exportação...
                </div>
              ) : ultimaExportacao ? (
                <div className="p-4 rounded-lg bg-slate-50 border space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <div className="text-sm font-semibold text-[#1E2A4A] flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Última Exportação Registrada
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Data: {new Date(ultimaExportacao.gerado_em).toLocaleString('pt-BR')} (
                        {ultimaExportacao.tipo_execucao === 'cron_semanal'
                          ? 'Automática semanal'
                          : 'Manual auditada por Admin'}
                        )
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportarAgora}
                      className="gap-2"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar Novo JSON
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t">
                    <div>
                      <span className="text-muted-foreground">Coleções:</span>{' '}
                      <strong>{ultimaExportacao.total_colecoes}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Registros:</span>{' '}
                      <strong>{ultimaExportacao.total_registros}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duração:</span>{' '}
                      <strong>{ultimaExportacao.duracao_ms} ms</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      <Badge variant="outline" className="text-emerald-700 bg-emerald-50">
                        {ultimaExportacao.status}
                      </Badge>
                    </div>
                  </div>

                  {ultimaExportacao.indice_arquivos &&
                    ultimaExportacao.indice_arquivos.length > 0 && (
                      <div className="pt-2">
                        <div className="text-xs font-medium text-slate-700 mb-1">
                          Índice de Coleções Exportadas:
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 text-[11px]">
                          {ultimaExportacao.indice_arquivos.map((idxItem) => (
                            <div
                              key={idxItem.colecao}
                              className="bg-white border rounded px-2 py-1 flex justify-between"
                            >
                              <span className="font-mono text-slate-600">{idxItem.colecao}</span>
                              <span className="font-semibold text-slate-900">
                                {idxItem.total_registros}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                  Nenhuma exportação realizada ainda. Clique em "Exportar agora" para gerar a
                  primeira.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. ABA ERROS SISTEMA */}
        <TabsContent value="erros" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    Erros de Sistema Catalogados (Coleção erros_sistema)
                  </CardTitle>
                  <CardDescription>
                    Falhas em rotas e hooks do backend capturadas com rota, mensagem, usuário e
                    data/hora.
                  </CardDescription>
                </div>
                <Badge variant="outline">Total: {totalErros} erros</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {carregandoErros ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Carregando log de erros...
                </div>
              ) : erros.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground border rounded-lg border-dashed">
                  Nenhum erro de sistema registrado. O ambiente está estável.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hora</TableHead>
                      <TableHead>Rota / Ponto de Falha</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Usuário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {erros.map((err) => (
                      <TableRow key={err.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(err.hora || err.created).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-medium text-slate-800">
                          {err.rota}
                        </TableCell>
                        <TableCell className="text-xs text-red-700 max-w-[300px] truncate">
                          {err.mensagem}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {err.usuario_email || 'Anônimo / Sistema'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. ABA LIMITES DE UPLOAD */}
        <TabsContent value="limites" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-[#D95A2B]" />
                Tetos de Upload & Armazenamento da Plataforma
              </CardTitle>
              <CardDescription>
                Configuração dos tetos por tipo de arquivo. No envio, prestadores e gestores recebem
                mensagens claras de bloqueio se o arquivo exceder estes valores.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Relatório do Teto Real do Skip Cloud */}
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 space-y-2">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  Teto Real do Skip Cloud (PocketBase runtime Goja):
                </div>
                <p className="text-xs leading-relaxed">
                  • <strong>Limite HTTP por campo de arquivo:</strong> configurado em 100 MB na
                  migração base (0035_projetos_entregaveis_versao.js) para campos padrão e modelos
                  IFC.
                  <br />• <strong>Buffer de memória multipart:</strong> o runtime PocketBase/Go
                  processa em memória até 32 MB antes de criar arquivo temporário no disco.
                  <br />• <strong>Armazenamento Skip Cloud:</strong> persistência local/disco com
                  regras de segurança e hashes SHA-256 por entregável.
                </p>
              </div>

              {/* Formulário de Parâmetros por tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-sm text-[#1E2A4A]">
                    <Layers className="h-4 w-4 text-blue-600" />
                    Modelos IFC (.ifc, .ifczip)
                  </div>
                  <Label htmlFor="limite-ifc" className="text-xs text-muted-foreground">
                    Teto máximo permitido (MB)
                  </Label>
                  <Input
                    id="limite-ifc"
                    type="number"
                    min="1"
                    max="500"
                    value={formLimites.ifc_mb}
                    onChange={(e) =>
                      setFormLimites({ ...formLimites, ifc_mb: Number(e.target.value) })
                    }
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Atual no sistema: {limites.ifc?.max_mb || 150} MB
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-sm text-[#1E2A4A]">
                    <FileText className="h-4 w-4 text-amber-600" />
                    Pranchas e Desenhos DWG (.dwg, .dxf)
                  </div>
                  <Label htmlFor="limite-dwg" className="text-xs text-muted-foreground">
                    Teto máximo permitido (MB)
                  </Label>
                  <Input
                    id="limite-dwg"
                    type="number"
                    min="1"
                    max="500"
                    value={formLimites.dwg_mb}
                    onChange={(e) =>
                      setFormLimites({ ...formLimites, dwg_mb: Number(e.target.value) })
                    }
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Atual no sistema: {limites.dwg?.max_mb || 100} MB
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-sm text-[#1E2A4A]">
                    <FileText className="h-4 w-4 text-red-600" />
                    Documentos Técnicos PDF (.pdf)
                  </div>
                  <Label htmlFor="limite-pdf" className="text-xs text-muted-foreground">
                    Teto máximo permitido (MB)
                  </Label>
                  <Input
                    id="limite-pdf"
                    type="number"
                    min="1"
                    max="200"
                    value={formLimites.pdf_mb}
                    onChange={(e) =>
                      setFormLimites({ ...formLimites, pdf_mb: Number(e.target.value) })
                    }
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Atual no sistema: {limites.pdf?.max_mb || 50} MB
                  </div>
                </div>

                <div className="p-4 rounded-lg border bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2 font-medium text-sm text-[#1E2A4A]">
                    <Camera className="h-4 w-4 text-emerald-600" />
                    Imagens e Evidências (.png, .jpg, .jpeg, .webp)
                  </div>
                  <Label htmlFor="limite-img" className="text-xs text-muted-foreground">
                    Teto máximo permitido (MB)
                  </Label>
                  <Input
                    id="limite-img"
                    type="number"
                    min="1"
                    max="100"
                    value={formLimites.imagem_mb}
                    onChange={(e) =>
                      setFormLimites({ ...formLimites, imagem_mb: Number(e.target.value) })
                    }
                  />
                  <div className="text-[11px] text-muted-foreground">
                    Atual no sistema: {limites.imagem?.max_mb || 25} MB
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSalvarLimites}
                  disabled={salvandoLimites}
                  className="bg-[#1E2A4A] hover:bg-[#162038] text-white gap-2"
                >
                  <Save className="h-4 w-4" />
                  {salvandoLimites ? 'Salvando...' : 'Salvar Novos Tetos'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. ABA SNAPSHOT PRÉ-MIGRAÇÃO */}
        <TabsContent value="snapshot" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-[#D95A2B]" />
                Snapshot de Segurança Pré-Migração de Dados
              </CardTitle>
              <CardDescription>
                Padrão de segurança reaproveitado da limpeza de negócio. Gera contagens e metadados
                imutáveis registrados na auditoria antes de qualquer intervenção em lote.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
                <strong>Regra de Integridade:</strong> Nenhuma alteração em massa de dados pode ser
                executada sem snapshot prévio gravado em audit_logs. O snapshot garante que qualquer
                volumetria afetada possa ser rastreada por data, usuário e tabelas impactadas.
              </div>

              <Button
                onClick={handleGerarSnapshot}
                disabled={gerandoSnapshot}
                variant="outline"
                className="gap-2"
              >
                <Database className="h-4 w-4 text-[#1E2A4A]" />
                {gerandoSnapshot ? 'Gerando snapshot...' : 'Gerar Snapshot de Segurança Agora'}
              </Button>

              {ultimoSnapshot && (
                <div className="p-4 rounded-lg bg-slate-50 border space-y-2 text-xs">
                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Snapshot Gerado e Auditado
                  </div>
                  <div>
                    <strong>Data:</strong>{' '}
                    {new Date(ultimoSnapshot.gerado_em).toLocaleString('pt-BR')} |{' '}
                    <strong>Total Linhas:</strong> {ultimoSnapshot.total_linhas_afetadas}
                  </div>
                  <div className="font-mono text-[11px] bg-white p-2 rounded border">
                    {JSON.stringify(ultimoSnapshot.contagens_por_colecao, null, 2)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
