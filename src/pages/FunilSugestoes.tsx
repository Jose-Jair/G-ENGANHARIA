import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { SugestaoFunilRecord, SugestaoStatus, SugestaoFonte } from '@/types'
import { sugestoesService, CreateSugestaoData } from '@/services/sugestoes'
import { pncpService, PncpItemCompra } from '@/services/pncp'
import { readFileToSheetData, ParsedSheetData } from '@/lib/spreadsheetParser'
import { formatCurrencyBr, formatDateBr } from '@/lib/formatters'
import { formatCnpj, cleanCnpj } from '@/lib/cnpj'
import { useToast } from '@/hooks/use-toast'
import {
  Sparkles,
  FileSpreadsheet,
  Globe,
  Upload,
  CheckCircle,
  XCircle,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  AlertTriangle,
  Building2,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function FunilSugestoesPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [sugestoes, setSugestoes] = useState<SugestaoFunilRecord[]>([])
  const [filtroStatus, setFiltroStatus] = useState<string>('pendente')
  const [busca, setBusca] = useState('')

  // Modais
  const [modalImportarOpen, setModalImportarOpen] = useState(false)
  const [modalPncpOpen, setModalPncpOpen] = useState(false)
  const [sugestaoDescartar, setSugestaoDescartar] = useState<SugestaoFunilRecord | null>(null)
  const [motivoDescarte, setMotivoDescarte] = useState('')

  // Estado de Importação de Planilha
  const [sheetFile, setSheetFile] = useState<File | null>(null)
  const [sheetParsed, setSheetParsed] = useState<ParsedSheetData | null>(null)
  const [importPreviewErrors, setImportPreviewErrors] = useState<{ linha: number; erro: string }[]>(
    [],
  )
  const [importValidRows, setImportValidRows] = useState<CreateSugestaoData[]>([])
  const [importing, setImporting] = useState(false)

  // Estado de Consulta PNCP
  const [pncpTermo, setPncpTermo] = useState('engenharia')
  const [pncpUf, setPncpUf] = useState('todas')
  const [pncpLoading, setPncpLoading] = useState(false)
  const [pncpResults, setPncpResults] = useState<PncpItemCompra[]>([])
  const [pncpAviso, setPncpAviso] = useState('')
  const [pncpSelected, setPncpSelected] = useState<Set<number>>(new Set())

  // Carregar sugestões
  const loadSugestoes = async () => {
    setLoading(true)
    try {
      const list = await sugestoesService.list(filtroStatus !== 'todas' ? filtroStatus : undefined)
      setSugestoes(list)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar fila de sugestões',
        description: err instanceof Error ? err.message : 'Falha na conexão.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSugestoes()
  }, [filtroStatus])

  // Filtragem local por texto
  const sugestoesFiltradas = useMemo(() => {
    if (!busca.trim()) return sugestoes
    const q = busca.toLowerCase().trim()
    return sugestoes.filter((s) => {
      const matchRazao = s.razao_social.toLowerCase().includes(q)
      const matchFantasia = (s.nome_fantasia || '').toLowerCase().includes(q)
      const matchCnpj = (s.cnpj || '').includes(q)
      const matchOrgao = (s.orgao_contrato || '').toLowerCase().includes(q)
      const matchObjeto = (s.objeto_contrato || '').toLowerCase().includes(q)
      return matchRazao || matchFantasia || matchCnpj || matchOrgao || matchObjeto
    })
  }, [sugestoes, busca])

  // Ações sobre uma sugestão
  const handleIncorporar = async (sug: SugestaoFunilRecord) => {
    if (!user) return
    try {
      await sugestoesService.incorporarAoFunil(sug.id, user.id)
      toast({
        title: 'Empresa incorporada ao Funil!',
        description: `"${sug.nome_fantasia || sug.razao_social}" agora está na etapa "Identificada".`,
      })
      loadSugestoes()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao incorporar',
        description: err instanceof Error ? err.message : 'Falha na operação.',
        variant: 'destructive',
      })
    }
  }

  const handleAprovarInclusao = async (sug: SugestaoFunilRecord) => {
    if (!user) return
    try {
      await sugestoesService.aprovarParaInclusao(sug.id, user.id)
      toast({
        title: 'Sugestão validada pelo Comercial',
        description: 'Marcada como aprovada para inclusão definitiva.',
      })
      loadSugestoes()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao aprovar',
        description: err instanceof Error ? err.message : 'Falha ao atualizar.',
        variant: 'destructive',
      })
    }
  }

  const handleConfirmarDescarte = async () => {
    if (!sugestaoDescartar || !user) return
    if (!motivoDescarte.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo do descarte da sugestão.',
        variant: 'destructive',
      })
      return
    }

    try {
      await sugestoesService.descartar(sugestaoDescartar.id, motivoDescarte.trim(), user.id)
      toast({
        title: 'Sugestão descartada',
        description: 'Registro auditado e arquivado com sucesso.',
      })
      setSugestaoDescartar(null)
      setMotivoDescarte('')
      loadSugestoes()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao descartar',
        description: err instanceof Error ? err.message : 'Falha ao descartar.',
        variant: 'destructive',
      })
    }
  }

  // ==========================================
  // IMPORTAÇÃO DE PLANILHA (CSV / XLSX)
  // ==========================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSheetFile(file)
    setImportPreviewErrors([])
    setImportValidRows([])

    try {
      const parsed = await readFileToSheetData(file)
      setSheetParsed(parsed)

      // Validação linha a linha
      const valid: CreateSugestaoData[] = []
      const errors: { linha: number; erro: string }[] = []

      parsed.rows.forEach((row, idx) => {
        const linhaNum = idx + 2 // +2 por conta do cabeçalho (1-based)

        // Tentar mapear campos por nomes comuns
        const razao =
          row['razao_social'] ||
          row['Razão Social'] ||
          row['RAZAO SOCIAL'] ||
          row['razao'] ||
          row['Empresa'] ||
          row['empresa'] ||
          row['Nome'] ||
          ''

        const fantasia =
          row['nome_fantasia'] ||
          row['Nome Fantasia'] ||
          row['NOME FANTASIA'] ||
          row['fantasia'] ||
          ''

        const cnpj = row['cnpj'] || row['CNPJ'] || row['cpf_cnpj'] || ''
        const uf = row['uf'] || row['UF'] || row['Estado'] || ''
        const municipio = row['municipio'] || row['Município'] || row['Cidade'] || ''
        const email = row['email'] || row['E-mail'] || row['Email'] || ''
        const telefone = row['telefone'] || row['Telefone'] || row['Fone'] || ''
        const orgao = row['orgao'] || row['Órgão'] || row['Orgao'] || row['orgao_contrato'] || ''
        const numero =
          row['contrato'] || row['Contrato'] || row['numero_contrato'] || row['Numero'] || ''
        const objeto = row['objeto'] || row['Objeto'] || row['objeto_contrato'] || ''

        let valorNum: number | undefined = undefined
        const valorRaw = row['valor'] || row['Valor'] || row['valor_estimado'] || ''
        if (valorRaw) {
          const vClean = valorRaw
            .toString()
            .replace(/R\$\s?/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .trim()
          const n = parseFloat(vClean)
          if (!isNaN(n)) valorNum = n
        }

        if (!razao.trim()) {
          errors.push({ linha: linhaNum, erro: 'Coluna de Razão Social/Empresa vazia' })
          return
        }

        valid.push({
          razao_social: razao.trim(),
          nome_fantasia: fantasia.trim() || undefined,
          cnpj: cnpj.trim() || undefined,
          uf: uf.trim() || undefined,
          municipio: municipio.trim() || undefined,
          email: email.trim() || undefined,
          telefone: telefone.trim() || undefined,
          orgao_contrato: orgao.trim() || undefined,
          numero_contrato: numero.trim() || undefined,
          objeto_contrato: objeto.trim() || undefined,
          valor_estimado: valorNum,
          fonte: 'planilha',
          status: 'pendente',
        })
      })

      setImportValidRows(valid)
      setImportPreviewErrors(errors)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao processar planilha',
        description: err instanceof Error ? err.message : 'Falha na leitura do arquivo.',
        variant: 'destructive',
      })
    }
  }

  const handleConfirmarImportacao = async () => {
    if (importValidRows.length === 0) return
    setImporting(true)
    try {
      const res = await sugestoesService.createBatch(importValidRows)
      toast({
        title: 'Importação concluída',
        description: `${res.created} sugestão(ões) adicionada(s) à fila com sucesso.`,
      })
      setModalImportarOpen(false)
      setSheetFile(null)
      setSheetParsed(null)
      setImportValidRows([])
      setImportPreviewErrors([])
      loadSugestoes()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao importar',
        description: err instanceof Error ? err.message : 'Falha ao salvar registros.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  // ==========================================
  // CONSULTA PNCP
  // ==========================================
  const handleConsultarPncp = async (e: React.FormEvent) => {
    e.preventDefault()
    setPncpLoading(true)
    setPncpAviso('')
    setPncpResults([])
    setPncpSelected(new Set())

    try {
      const res = await pncpService.consultarContratacoes({
        termo: pncpTermo.trim() || undefined,
        uf: pncpUf !== 'todas' ? pncpUf : undefined,
        tamanhoPagina: 15,
      })

      if (res.aviso) {
        setPncpAviso(res.aviso)
      }

      setPncpResults(res.items)

      if (res.items.length === 0 && !res.aviso) {
        setPncpAviso('Nenhuma contratação recente encontrada no PNCP para o termo informado.')
      }
    } finally {
      setPncpLoading(false)
    }
  }

  const toggleSelectPncp = (index: number) => {
    const next = new Set(pncpSelected)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setPncpSelected(next)
  }

  const handleImportarSelecionadosPncp = async () => {
    if (pncpSelected.size === 0) return
    setPncpLoading(true)

    const itensParaImportar: CreateSugestaoData[] = []
    pncpSelected.forEach((idx) => {
      const item = pncpResults[idx]
      if (!item) return

      const razao = item.orgaoEntidade?.razaoSocial || 'Órgão Público PNCP'
      itensParaImportar.push({
        razao_social: `Prospect [${item.modalidadeNome || 'Licitação'}]: ${razao}`,
        nome_fantasia: razao,
        cnpj: item.orgaoEntidade?.cnpj || '',
        uf: item.unidadeOrgao?.ufSigla || '',
        municipio: item.unidadeOrgao?.municipioNome || '',
        orgao_contrato: razao,
        numero_contrato:
          item.numeroControlePNCP || `PNCP-${item.anoCompra || 2026}-${item.sequencialCompra || 1}`,
        objeto_contrato: item.objetoCompra || 'Contratação pública identificada via PNCP',
        valor_estimado: item.valorTotalEstimado || item.valorTotalHomologado || 0,
        fonte: 'pncp',
        status: 'pendente',
        observacoes: `Capturado via API PNCP (${item.modalidadeNome || 'Pregão'}). Requer validação do gestor/comercial antes da inclusão no funil.`,
      })
    })

    try {
      const res = await sugestoesService.createBatch(itensParaImportar)
      toast({
        title: 'Sugestões do PNCP importadas',
        description: `${res.created} oportunidade(s) adicionada(s) à Fila de Sugestões com sucesso.`,
      })
      setModalPncpOpen(false)
      loadSugestoes()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao importar PNCP',
        description: err instanceof Error ? err.message : 'Falha ao salvar sugestões.',
        variant: 'destructive',
      })
    } finally {
      setPncpLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Topo da Tela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Fila de Sugestões de Prospecção
            </h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              Módulo /funil/sugestoes
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Recebimento e qualificação de oportunidades vindas de planilhas de licitações ou da API
            do PNCP.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => navigate('/funil')}
            className="text-xs text-slate-700 hover:text-blue-600"
          >
            <ArrowRight className="w-3.5 h-3.5 mr-1.5 rotate-180" />
            Voltar ao Funil
          </Button>

          <Button
            variant="outline"
            onClick={() => setModalPncpOpen(true)}
            className="text-xs text-slate-700 hover:text-blue-600 hover:border-blue-300"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Consultar PNCP
          </Button>

          <Button
            onClick={() => setModalImportarOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-white" />
            Importar Planilha
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <Input
              placeholder="Buscar por Empresa, Órgão, CNPJ ou Objeto do Contrato..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 shrink-0">Status:</label>
            <select
              className="h-9 px-3 text-xs border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todas">Todos os Status</option>
              <option value="pendente">Pendentes de Decisão</option>
              <option value="aprovada_para_inclusao">Aprovadas para Inclusão</option>
              <option value="incorporada">Incorporadas ao Funil</option>
              <option value="descartada">Descartadas</option>
            </select>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadSugestoes}
              className="text-slate-500 hover:text-blue-600 h-9"
              title="Recarregar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Sugestões na Fila */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-16 text-center text-slate-500 text-sm">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mx-auto mb-2" />
            Carregando fila de sugestões...
          </div>
        ) : sugestoesFiltradas.length === 0 ? (
          <div className="p-16 text-center">
            <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Nenhuma sugestão encontrada</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Utilize os botões acima para importar uma planilha CSV/XLSX de licitações ou consultar
              o PNCP.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Empresa / Sugestão</th>
                  <th className="py-3 px-3">Origem / Fonte</th>
                  <th className="py-3 px-3">Contrato / Órgão</th>
                  <th className="py-3 px-4 text-right">Valor Estimado (R$)</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Decisão Comercial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sugestoesFiltradas.map((sug) => (
                  <tr key={sug.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Empresa / Sugestão */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 text-sm">
                        {sug.nome_fantasia || sug.razao_social}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        {sug.cnpj && <span>CNPJ: {formatCnpj(sug.cnpj)}</span>}
                        {sug.uf && (
                          <Badge variant="outline" className="text-[9px] py-0 font-mono">
                            {sug.municipio ? `${sug.municipio}/${sug.uf}` : sug.uf}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Fonte */}
                    <td className="py-3 px-3">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] uppercase font-bold ${
                          sug.fonte === 'pncp'
                            ? 'bg-blue-100 text-blue-800'
                            : sug.fonte === 'planilha'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {sug.fonte}
                      </Badge>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {formatDateBr(sug.created)}
                      </span>
                    </td>

                    {/* Contrato / Órgão */}
                    <td className="py-3 px-3 max-w-xs">
                      <div className="font-medium text-slate-800 truncate">
                        {sug.orgao_contrato || '—'}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">
                        {sug.objeto_contrato || sug.numero_contrato || '—'}
                      </div>
                    </td>

                    {/* Valor Estimado */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrencyBr(sug.valor_estimado || 0)}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          sug.status === 'incorporada'
                            ? 'bg-purple-100 text-purple-800'
                            : sug.status === 'aprovada_para_inclusao'
                              ? 'bg-blue-100 text-blue-800'
                              : sug.status === 'descartada'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sug.status === 'incorporada'
                          ? 'Incorporada'
                          : sug.status === 'aprovada_para_inclusao'
                            ? 'Aprovada'
                            : sug.status === 'descartada'
                              ? 'Descartada'
                              : 'Pendente'}
                      </span>
                      {sug.motivo_descarte && (
                        <p className="text-[9px] text-rose-600 mt-0.5 italic max-w-[130px] truncate mx-auto">
                          {sug.motivo_descarte}
                        </p>
                      )}
                    </td>

                    {/* Ações de Decisão */}
                    <td className="py-3 px-4 text-right">
                      {sug.status === 'pendente' && (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Se for PNCP, pode apenas aprovar antes ou incorporar direto */}
                          {sug.fonte === 'pncp' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAprovarInclusao(sug)}
                              className="text-[11px] h-7 px-2 text-blue-700 hover:bg-blue-50"
                              title="Marcar como validada pelo comercial"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Validar
                            </Button>
                          )}

                          <Button
                            size="sm"
                            onClick={() => handleIncorporar(sug)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] h-7 px-2.5"
                          >
                            <ArrowRight className="w-3 h-3 mr-1" />
                            Incorporar ao Funil
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSugestaoDescartar(sug)
                              setMotivoDescarte('')
                            }}
                            className="text-slate-500 hover:text-red-600 h-7 px-2"
                            title="Descartar sugestão"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}

                      {sug.status === 'aprovada_para_inclusao' && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleIncorporar(sug)}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] h-7 px-2.5"
                          >
                            <ArrowRight className="w-3 h-3 mr-1" />
                            Criar em Identificada
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSugestaoDescartar(sug)
                              setMotivoDescarte('')
                            }}
                            className="text-slate-500 hover:text-red-600 h-7 px-2"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}

                      {sug.status === 'incorporada' && (
                        <span className="text-[11px] text-purple-700 font-medium">
                          No funil (Identificada)
                        </span>
                      )}

                      {sug.status === 'descartada' && (
                        <span className="text-[11px] text-slate-400 italic">Descartada</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: IMPORTAÇÃO POR PLANILHA COM PRÉVIA E RELATÓRIO  */}
      {/* ======================================================== */}
      <Dialog open={modalImportarOpen} onOpenChange={setModalImportarOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600">
              <FileSpreadsheet className="w-5 h-5" />
              <DialogTitle>Importar Sugestões via Planilha</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Faça upload de planilha no padrão brasileiro (CSV com separador ";" ou XLSX). As
              linhas validadas serão inseridas na fila de sugestões.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <input
                type="file"
                id="file-sheet-sugestoes"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-sheet-sugestoes"
                className="cursor-pointer font-semibold text-blue-600 hover:underline"
              >
                {sheetFile ? sheetFile.name : 'Selecionar arquivo CSV ou Excel'}
              </label>
              <p className="text-[11px] text-slate-400 mt-1">
                Colunas aceitas: Razão Social, Nome Fantasia, CNPJ, UF, Município, Órgão, Contrato,
                Objeto, Valor.
              </p>
            </div>

            {/* Prévia e Relatório de Erros por Linha */}
            {sheetParsed && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    Total de Linhas: {sheetParsed.rows.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-700 font-bold">
                      ✓ {importValidRows.length} Válidas
                    </span>
                    {importPreviewErrors.length > 0 && (
                      <span className="text-rose-600 font-bold">
                        ✗ {importPreviewErrors.length} Com Erro
                      </span>
                    )}
                  </div>
                </div>

                {/* Relatório de Erros por Linha */}
                {importPreviewErrors.length > 0 && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 max-h-36 overflow-y-auto">
                    <div className="font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Relatório de inconsistências por linha:
                    </div>
                    <ul className="space-y-1 text-[11px] text-rose-700 font-mono">
                      {importPreviewErrors.map((err, i) => (
                        <li key={i}>
                          Linha {err.linha}: {err.erro}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Prévia das primeiras 3 linhas válidas */}
                {importValidRows.length > 0 && (
                  <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 max-h-40 overflow-y-auto">
                    <span className="font-semibold text-slate-700 block mb-1 text-[11px]">
                      Prévia dos Registros Válidos:
                    </span>
                    <div className="space-y-1 text-[11px]">
                      {importValidRows.slice(0, 4).map((row, i) => (
                        <div
                          key={i}
                          className="bg-white p-1.5 rounded border border-slate-200 flex justify-between"
                        >
                          <span className="font-medium text-slate-800">{row.razao_social}</span>
                          <span className="font-mono text-slate-500">
                            {formatCurrencyBr(row.valor_estimado || 0)}
                          </span>
                        </div>
                      ))}
                      {importValidRows.length > 4 && (
                        <div className="text-[10px] text-slate-400 text-center pt-1">
                          + {importValidRows.length - 4} outro(s) registro(s)...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalImportarOpen(false)}
              disabled={importing}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarImportacao}
              disabled={importing || importValidRows.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {importing ? 'Importando...' : `Confirmar (${importValidRows.length} sugestões)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 2: CONSULTA PNCP COM AVISO DE INSTABILIDADE/REDE   */}
      {/* ======================================================== */}
      <Dialog open={modalPncpOpen} onOpenChange={setModalPncpOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600">
              <Globe className="w-5 h-5" />
              <DialogTitle>Consulta Pública de Licitações no PNCP</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Busca contratações públicas recentes no Portal Nacional de Contratações Públicas
              (https://pncp.gov.br/api/consulta). Sugestões importadas entram com pendência de
              aprovação antes da inserção no funil.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConsultarPncp} className="space-y-4 py-2 text-xs">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  Termo / Objeto de Engenharia
                </Label>
                <Input
                  placeholder="Ex: engenharia, drenagem, pavimentação, ponte..."
                  value={pncpTermo}
                  onChange={(e) => setPncpTermo(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="w-28">
                <Label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                  UF
                </Label>
                <select
                  className="w-full h-9 px-2 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
                  value={pncpUf}
                  onChange={(e) => setPncpUf(e.target.value)}
                >
                  <option value="todas">Todas</option>
                  <option value="SP">SP</option>
                  <option value="MG">MG</option>
                  <option value="RJ">RJ</option>
                  <option value="PR">PR</option>
                  <option value="SC">SC</option>
                  <option value="RS">RS</option>
                  <option value="BA">BA</option>
                  <option value="PE">PE</option>
                  <option value="CE">CE</option>
                  <option value="GO">GO</option>
                  <option value="PA">PA</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={pncpLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-9"
                >
                  {pncpLoading ? 'Consultando...' : 'Buscar Contratações'}
                </Button>
              </div>
            </div>

            {/* Aviso Amigável de Instabilidade / Falha de Rede se houver */}
            {pncpAviso && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-semibold block">
                    Aviso sobre o serviço público do PNCP:
                  </span>
                  <p>{pncpAviso}</p>
                </div>
              </div>
            )}

            {/* Resultados PNCP */}
            {pncpResults.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {pncpResults.length} Contratação(ões) Encontrada(s)
                  </span>
                  <span className="text-[11px] text-blue-600 font-medium">
                    {pncpSelected.size} selecionada(s) para importar
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-2 bg-slate-50/60">
                  {pncpResults.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => toggleSelectPncp(idx)}
                      className={`p-2.5 rounded-md border text-xs cursor-pointer transition-colors ${
                        pncpSelected.has(idx)
                          ? 'bg-blue-50/90 border-blue-300 ring-1 ring-blue-400'
                          : 'bg-white border-slate-200 hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">
                            {item.orgaoEntidade?.razaoSocial || 'Órgão Público'}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {item.unidadeOrgao?.municipioNome} - {item.unidadeOrgao?.ufSigla} |{' '}
                            {item.modalidadeNome}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 shrink-0">
                          {formatCurrencyBr(
                            item.valorTotalEstimado || item.valorTotalHomologado || 0,
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                        {item.objetoCompra}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>

          <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setModalPncpOpen(false)}
              disabled={pncpLoading}
            >
              Fechar
            </Button>
            {pncpResults.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={handleImportarSelecionadosPncp}
                disabled={pncpLoading || pncpSelected.size === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Importar {pncpSelected.size} Selecionada(s)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 3: DESCARTE DE SUGESTÃO COM MOTIVO OBRIGATÓRIO     */}
      {/* ======================================================== */}
      <Dialog
        open={!!sugestaoDescartar}
        onOpenChange={(open) => !open && setSugestaoDescartar(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600">
              <XCircle className="w-5 h-5" />
              <DialogTitle>Descartar Sugestão de Prospecção</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 pt-1">
              Descarte a sugestão "
              <strong className="text-slate-800">
                {sugestaoDescartar?.nome_fantasia || sugestaoDescartar?.razao_social}
              </strong>
              ". O motivo será registrado nos logs imutáveis de auditoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Motivo do Descarte <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="Ex: Escopo fora da atuação da intermediação, objeto de baixo valor, empresa sem interesse em terceirização..."
                value={motivoDescarte}
                onChange={(e) => setMotivoDescarte(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSugestaoDescartar(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmarDescarte}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirmar Descarte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
