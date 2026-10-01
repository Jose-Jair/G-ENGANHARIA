import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { readFileToSheetData, ParsedSheetData } from '@/lib/spreadsheetParser'
import { empresasService } from '@/services/empresas'
import { contratosService } from '@/services/contratos'
import { cleanCnpj, formatCnpj, isValidCnpj } from '@/lib/cnpj'
import { formatCurrencyBr } from '@/lib/formatters'
import { CenarioEntrada, EmpresaRecord } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Building2,
  RefreshCw,
  HelpCircle,
  Download,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ColumnMapping {
  cnpj: string
  razao_social: string
  nome_fantasia: string
  orgao: string
  numero_contrato: string
  objeto: string
  valor: string
  vigencia_inicio: string
  vigencia_fim: string
  situacao_contrato: string
  uf: string
  municipio: string
  email: string
  telefone: string
}

interface RowValidation {
  index: number // 1-based
  rawRow: Record<string, string>
  cnpjClean: string
  cnpjFormatted: string
  razaoSocial: string
  orgao: string
  numeroContrato: string
  objeto: string
  valorNumber: number
  vigenciaInicio: string
  vigenciaFim: string
  situacaoContrato: string
  uf: string
  municipio: string
  email: string
  telefone: string
  cenario: CenarioEntrada
  empresaExistenteId?: string
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export default function EmpresasImportarPage() {
  const { user, isAdmin, isComercial } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  // Bloqueio de acesso apenas a Admin e Comercial
  const canAccess = isAdmin || isComercial

  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [sheetData, setSheetData] = useState<ParsedSheetData | null>(null)

  // Mapeamento de colunas
  const [mapping, setMapping] = useState<ColumnMapping>({
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    orgao: '',
    numero_contrato: '',
    objeto: '',
    valor: '',
    vigencia_inicio: '',
    vigencia_fim: '',
    situacao_contrato: '',
    uf: '',
    municipio: '',
    email: '',
    telefone: '',
  })

  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload')
  const [validating, setValidating] = useState(false)
  const [validatedRows, setValidatedRows] = useState<RowValidation[]>([])
  const [somenteValidas, setSomenteValidas] = useState(true)

  // Execução da importação
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<{
    total: number
    sucessoEmpresasNovas: number
    sucessoContratosNovos: number
    alertasOportunidade: number
    erros: number
  } | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0]
    if (!uploadedFile) return

    setFile(uploadedFile)
    setParsing(true)
    try {
      const data = await readFileToSheetData(uploadedFile)
      if (data.headers.length === 0 || data.rows.length === 0) {
        throw new Error('O arquivo selecionado parece estar vazio ou não possui linhas de dados.')
      }
      setSheetData(data)

      // Auto-detectar mapeamento por heurística de nomes comuns de cabeçalhos
      const autoMap: ColumnMapping = {
        cnpj: findHeaderMatch(data.headers, ['cnpj', 'cpf_cnpj', 'documento']),
        razao_social: findHeaderMatch(data.headers, [
          'razao_social',
          'razao',
          'empresa',
          'nome_empresa',
          'contratada',
          'fornecedor',
        ]),
        nome_fantasia: findHeaderMatch(data.headers, ['nome_fantasia', 'fantasia']),
        orgao: findHeaderMatch(data.headers, [
          'orgao',
          'ente',
          'prefeitura',
          'secretaria',
          'contratante',
        ]),
        numero_contrato: findHeaderMatch(data.headers, [
          'numero',
          'contrato',
          'numero_contrato',
          'num_contrato',
          'termo',
        ]),
        objeto: findHeaderMatch(data.headers, ['objeto', 'descricao', 'escopo', 'servico']),
        valor: findHeaderMatch(data.headers, ['valor', 'valor_total', 'preco', 'montante']),
        vigencia_inicio: findHeaderMatch(data.headers, [
          'vigencia_inicio',
          'inicio',
          'data_inicio',
        ]),
        vigencia_fim: findHeaderMatch(data.headers, [
          'vigencia_fim',
          'fim',
          'data_fim',
          'vencimento',
          'termino',
        ]),
        situacao_contrato: findHeaderMatch(data.headers, [
          'situacao',
          'status',
          'situacao_contrato',
        ]),
        uf: findHeaderMatch(data.headers, ['uf', 'estado']),
        municipio: findHeaderMatch(data.headers, ['municipio', 'cidade']),
        email: findHeaderMatch(data.headers, ['email', 'e_mail', 'contato']),
        telefone: findHeaderMatch(data.headers, ['telefone', 'tel', 'celular', 'whatsapp', 'fone']),
      }

      setMapping(autoMap)
      setStep('mapping')
    } catch (err: unknown) {
      toast({
        title: 'Erro ao ler arquivo',
        description: err instanceof Error ? err.message : 'Falha ao processar planilha.',
        variant: 'destructive',
      })
    } finally {
      setParsing(false)
    }
  }

  const findHeaderMatch = (headers: string[], candidates: string[]): string => {
    for (const h of headers) {
      const cleanH = h
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
      for (const c of candidates) {
        if (cleanH === c || cleanH.includes(c)) return h
      }
    }
    return ''
  }

  // Avançar para prévia e validação linha por linha
  const proceedToPreview = async () => {
    if (!sheetData) return

    if (!mapping.razao_social && !mapping.cnpj) {
      toast({
        title: 'Mapeamento incompleto',
        description:
          'Mapeie ao menos a coluna de Razão Social ou CNPJ para identificar as empresas.',
        variant: 'destructive',
      })
      return
    }

    setValidating(true)
    setStep('preview')

    try {
      // 1. Carregar lista de todas as empresas existentes para checar os 3 cenários e duplicidades
      const empresasExistentes = await empresasService.list()
      const cnpjMap = new Map<string, EmpresaRecord>()
      for (const emp of empresasExistentes) {
        const c = cleanCnpj(emp.cnpj)
        if (c) cnpjMap.set(c, emp)
      }

      // 2. Controlar duplicidade dentro do próprio arquivo
      const cnpjsNoArquivo = new Set<string>()

      const results: RowValidation[] = []

      for (let i = 0; i < sheetData.rows.length; i++) {
        const raw = sheetData.rows[i]
        const errors: string[] = []
        const warnings: string[] = []

        const rawCnpj = mapping.cnpj ? (raw[mapping.cnpj] || '').trim() : ''
        const cleanC = cleanCnpj(rawCnpj)
        const formattedC = formatCnpj(cleanC)

        const razao = mapping.razao_social
          ? (raw[mapping.razao_social] || '').trim()
          : (raw[mapping.nome_fantasia] || '').trim()

        const orgao = mapping.orgao ? (raw[mapping.orgao] || '').trim() : ''
        const numContrato = mapping.numero_contrato
          ? (raw[mapping.numero_contrato] || '').trim()
          : ''
        const objeto = mapping.objeto ? (raw[mapping.objeto] || '').trim() : ''

        // Parse de valor
        let valorNum = 0
        const rawValor = mapping.valor ? (raw[mapping.valor] || '').trim() : ''
        if (rawValor) {
          // Limpar caracteres não numéricos exceto vírgula/ponto
          const normalizedValor = rawValor
            .replace(/[R$\s]/g, '')
            .replace(/\.(?=\d{3})/g, '') // remove pontos de milhar
            .replace(',', '.') // troca vírgula decimal por ponto
          const parsed = parseFloat(normalizedValor)
          if (isNaN(parsed)) {
            errors.push(`Valor ilegível: "${rawValor}"`)
          } else {
            valorNum = parsed
          }
        }

        // Validação de CNPJ
        if (cleanC) {
          if (!isValidCnpj(cleanC)) {
            errors.push('CNPJ com dígitos verificadores inválidos.')
          } else {
            // Verificar duplicidade no próprio arquivo
            if (cnpjsNoArquivo.has(cleanC)) {
              warnings.push(
                'CNPJ repetido em linhas anteriores da planilha (inclusão de múltiplos contratos).',
              )
            } else {
              cnpjsNoArquivo.add(cleanC)
            }
          }
        } else if (!razao) {
          errors.push('Linha sem CNPJ e sem Razão Social.')
        }

        if (!razao && !cleanC) {
          errors.push('Razão Social obrigatória não encontrada.')
        }

        // Validação dos 3 Cenários de Entrada
        let cenario: CenarioEntrada = 'nova'
        let empresaExistenteId: string | undefined = undefined

        if (cleanC && cnpjMap.has(cleanC)) {
          const emp = cnpjMap.get(cleanC)!
          empresaExistenteId = emp.id
          if (emp.etapa_funil === 'parceira') {
            cenario = 'parceira'
            warnings.push(
              `Cenário 3 (Já Parceira): Contrato será vinculado a "${emp.razao_social}" gerando ALERTA DE OPORTUNIDADE ao Comercial.`,
            )
          } else {
            cenario = 'cadastrada'
            warnings.push(
              `Cenário 2 (Já Cadastrada): Empresa "${emp.razao_social}" já existe no banco. Etapa do funil preservada.`,
            )
          }
        } else {
          cenario = 'nova'
        }

        // Datas
        const vigInicio = mapping.vigencia_inicio ? (raw[mapping.vigencia_inicio] || '').trim() : ''
        const vigFim = mapping.vigencia_fim ? (raw[mapping.vigencia_fim] || '').trim() : ''
        const sitContrato = mapping.situacao_contrato
          ? (raw[mapping.situacao_contrato] || '').trim()
          : 'Em Execução'
        const uf = mapping.uf ? (raw[mapping.uf] || '').trim().toUpperCase() : ''
        const mun = mapping.municipio ? (raw[mapping.municipio] || '').trim() : ''
        const email = mapping.email ? (raw[mapping.email] || '').trim().toLowerCase() : ''
        const tel = mapping.telefone ? (raw[mapping.telefone] || '').trim() : ''

        results.push({
          index: i + 1,
          rawRow: raw,
          cnpjClean: cleanC,
          cnpjFormatted: formattedC,
          razaoSocial: razao,
          orgao,
          numeroContrato: numContrato,
          objeto,
          valorNumber: valorNum,
          vigenciaInicio: vigInicio,
          vigenciaFim: vigFim,
          situacaoContrato: sitContrato || 'Em Execução',
          uf,
          municipio: mun,
          email,
          telefone: tel,
          cenario,
          empresaExistenteId,
          isValid: errors.length === 0,
          errors,
          warnings,
        })
      }

      setValidatedRows(results)
    } catch (err: unknown) {
      toast({
        title: 'Erro na validação prévia',
        description: err instanceof Error ? err.message : 'Falha ao validar linhas.',
        variant: 'destructive',
      })
    } finally {
      setValidating(false)
    }
  }

  // Executar a importação definitiva
  const executeImport = async () => {
    const rowsToProcess = somenteValidas ? validatedRows.filter((r) => r.isValid) : validatedRows

    if (rowsToProcess.length === 0) {
      toast({
        title: 'Nenhuma linha válida',
        description: 'Corrija os erros na planilha ou selecione outro arquivo.',
        variant: 'destructive',
      })
      return
    }

    setImporting(true)
    setImportProgress(0)

    let okEmpresasNovas = 0
    let okContratosNovos = 0
    let alertasOportunidade = 0
    let totalErros = 0

    try {
      const total = rowsToProcess.length
      // Cache local para empresas criadas durante esta importação
      const createdEmpresasCnpj = new Map<string, string>()

      for (let i = 0; i < total; i++) {
        const item = rowsToProcess[i]
        try {
          let targetEmpresaId = item.empresaExistenteId

          // Se já foi criada numa linha anterior deste mesmo lote
          if (!targetEmpresaId && item.cnpjClean && createdEmpresasCnpj.has(item.cnpjClean)) {
            targetEmpresaId = createdEmpresasCnpj.get(item.cnpjClean)!
          }

          // Cenário 1: Empresa NOVA
          if (!targetEmpresaId) {
            const novaEmpresa = await empresasService.create({
              razao_social: item.razaoSocial || `Empresa CNPJ ${item.cnpjFormatted}`,
              cnpj: item.cnpjFormatted || '',
              uf: item.uf,
              municipio: item.municipio,
              email: item.email,
              telefone: item.telefone,
              etapa_funil: 'identificada', // Sempre identificada para nova empresa
              curva: empresasService.calcularCurva(item.valorNumber),
              status: 'ativa',
              responsavel: user?.id,
              observacoes: `Importada via planilha em ${new Date().toLocaleDateString('pt-BR')}`,
            })

            targetEmpresaId = novaEmpresa.id
            if (item.cnpjClean) {
              createdEmpresasCnpj.set(item.cnpjClean, novaEmpresa.id)
            }
            okEmpresasNovas++
          }

          // Cenário 3: Empresa Parceira detectada -> Contabilizar alerta
          if (item.cenario === 'parceira') {
            alertasOportunidade++
          }

          // Se a linha tem informações de contrato, lançar o contrato
          if (item.numeroContrato || item.orgao || item.valorNumber > 0) {
            await contratosService.create({
              empresa: targetEmpresaId,
              orgao: item.orgao || 'Órgão Público (Importação)',
              numero: item.numeroContrato || `IMP-${Date.now().toString().slice(-6)}`,
              objeto: item.objeto,
              valor: item.valorNumber,
              saldo: item.valorNumber,
              vigencia_inicio: item.vigenciaInicio
                ? `${item.vigenciaInicio} 00:00:00.000Z`
                : undefined,
              vigencia_fim: item.vigenciaFim ? `${item.vigenciaFim} 00:00:00.000Z` : undefined,
              situacao: item.situacaoContrato || 'Em Execução',
              fonte: 'Planilha de Importação',
            })
            okContratosNovos++
          }
        } catch (rowErr) {
          console.error(`Erro ao processar linha ${item.index}:`, rowErr)
          totalErros++
        }

        setImportProgress(Math.round(((i + 1) / total) * 100))
      }

      setImportResult({
        total,
        sucessoEmpresasNovas: okEmpresasNovas,
        sucessoContratosNovos: okContratosNovos,
        alertasOportunidade,
        erros: totalErros,
      })

      setStep('result')
      toast({
        title: 'Importação concluída',
        description: `${okEmpresasNovas} empresas novas e ${okContratosNovos} contratos registrados com auditoria.`,
      })
    } catch (err: unknown) {
      toast({
        title: 'Falha durante importação',
        description: err instanceof Error ? err.message : 'Erro no processamento dos registros.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  // Estatísticas das linhas validadas
  const totalValidas = validatedRows.filter((r) => r.isValid).length
  const totalErros = validatedRows.length - totalValidas

  // Baixar modelo de planilha CSV
  const downloadTemplateCsv = () => {
    const csvHeader =
      'CNPJ;Razao_Social;Nome_Fantasia;Orgao;Numero_Contrato;Objeto;Valor;Vigencia_Inicio;Vigencia_Fim;Situacao;UF;Municipio;Email;Telefone\r\n'
    const csvSample =
      '14.285.340/0001-80;Construtora Rio Doce Ltda;Rio Doce Eng;Prefeitura de BH;CT-2024/099;Pavimentacao e Drenagem;1250000.00;2024-01-10;2026-12-31;Em Execucao;MG;Belo Horizonte;contato@riodoce.com.br;(31) 3222-1111\r\n'
    const blob = new Blob([csvHeader + csvSample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', 'modelo_importacao_empresas_contratos.csv')
    link.click()
  }

  if (!canAccess) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Acesso Restrito</h2>
        <p className="text-sm text-slate-500 mt-2">
          Apenas perfis <strong>Admin</strong> e <strong>Comercial</strong> possuem permissão para
          realizar importação de planilhas.
        </p>
        <Button onClick={() => navigate('/empresas')} className="mt-4">
          Voltar para Empresas
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Topo / Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/empresas')}
            className="text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar para Empresas
          </Button>
          <span className="text-slate-300">|</span>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            Importação de Empresas & Contratos por Planilha
          </h1>
        </div>

        <Button variant="outline" size="sm" onClick={downloadTemplateCsv} className="text-xs">
          <Download className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Baixar Planilha Modelo (CSV)
        </Button>
      </div>

      {/* Card de Apresentação das Regras dos 3 Cenários */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
        <div className="font-bold flex items-center gap-1.5 text-sm">
          <Building2 className="w-4 h-4 text-blue-700" /> Regras dos 3 Cenários Aplicadas por Linha:
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="bg-white p-3 rounded-md border border-blue-100 shadow-xs">
            <strong className="text-blue-900 block mb-1">1. Empresa NOVA:</strong>
            CNPJ não cadastrado → cadastra empresa na etapa "Identificada" e lança contratos ativos.
          </div>
          <div className="bg-white p-3 rounded-md border border-blue-100 shadow-xs">
            <strong className="text-amber-800 block mb-1">2. Já CADASTRADA:</strong>
            CNPJ existente (não parceira) → vincula o novo contrato ativo sem reiniciar o funil
            comercial.
          </div>
          <div className="bg-white p-3 rounded-md border border-blue-100 shadow-xs">
            <strong className="text-purple-800 block mb-1">3. Já PARCEIRA:</strong>
            Empresa parceira homologada → inclui contrato ativo e GERA ALERTA DE OPORTUNIDADE ao
            Comercial.
          </div>
        </div>
      </div>

      {/* PASSO 1: UPLOAD DO ARQUIVO */}
      {step === 'upload' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">Selecione ou arraste sua planilha</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Formatos aceitos: <strong>CSV</strong> (separador ponto-e-vírgula <code>;</code>{' '}
              padrão Brasil) e <strong>XLSX</strong> (Excel).
            </p>
          </div>

          <div className="max-w-md mx-auto pt-2">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 transition-all">
              <span className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                Escolher arquivo do computador
              </span>
              <span className="text-[11px] text-slate-400 mt-1">.csv, .xlsx</span>
              <input
                type="file"
                accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileUpload}
                className="hidden"
                disabled={parsing}
              />
            </label>
          </div>

          {parsing && (
            <div className="text-xs text-slate-500 flex items-center justify-center gap-2 pt-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> Processando dados da
              planilha...
            </div>
          )}
        </div>
      )}

      {/* PASSO 2: MAPEAMENTO DE COLUNAS */}
      {step === 'mapping' && sheetData && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Mapeamento de Colunas</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Arquivo: <strong>{file?.name}</strong> ({sheetData.rows.length} linhas detectadas)
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep('upload')} className="text-xs">
              Trocar Arquivo
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* CNPJ */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Coluna do CNPJ *</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.cnpj}
                onChange={(e) => setMapping({ ...mapping, cnpj: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Razão Social */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Razão Social / Nome *</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.razao_social}
                onChange={(e) => setMapping({ ...mapping, razao_social: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Nome Fantasia */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Nome Fantasia</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.nome_fantasia}
                onChange={(e) => setMapping({ ...mapping, nome_fantasia: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Órgão */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Órgão Contratante</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.orgao}
                onChange={(e) => setMapping({ ...mapping, orgao: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Número Contrato */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Número do Contrato</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.numero_contrato}
                onChange={(e) => setMapping({ ...mapping, numero_contrato: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Objeto */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Objeto do Contrato</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.objeto}
                onChange={(e) => setMapping({ ...mapping, objeto: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Valor */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Valor do Contrato (R$)</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.valor}
                onChange={(e) => setMapping({ ...mapping, valor: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Vigência Início */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Vigência Início (AAAA-MM-DD)
              </Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.vigencia_inicio}
                onChange={(e) => setMapping({ ...mapping, vigencia_inicio: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Vigência Fim */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Vigência Fim (AAAA-MM-DD)
              </Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.vigencia_fim}
                onChange={(e) => setMapping({ ...mapping, vigencia_fim: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* UF */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">UF / Estado</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.uf}
                onChange={(e) => setMapping({ ...mapping, uf: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Município */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Município / Cidade</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.municipio}
                onChange={(e) => setMapping({ ...mapping, municipio: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* E-mail */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">E-mail</Label>
              <select
                className="w-full h-9 px-2.5 text-xs border border-slate-200 rounded-md bg-white"
                value={mapping.email}
                onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
              >
                <option value="">(Não mapear)</option>
                {sheetData.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Voltar
            </Button>
            <Button onClick={proceedToPreview} className="bg-blue-600 hover:bg-blue-700 text-white">
              Validar e Ver Prévia das Linhas
            </Button>
          </div>
        </div>
      )}

      {/* PASSO 3: PRÉVIA E RELATÓRIO DE ERROS POR LINHA */}
      {step === 'preview' && (
        <div className="space-y-4">
          {validating ? (
            <div className="p-12 text-center text-slate-500 bg-white border rounded-xl">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              Validando linhas, dígitos de CNPJ e detectando cenários no banco...
            </div>
          ) : (
            <>
              {/* Barra de Resumo da Validação */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {totalValidas} linhas
                    válidas
                  </div>
                  {totalErros > 0 && (
                    <div className="flex items-center gap-1.5 text-red-700 font-bold text-sm">
                      <XCircle className="w-4 h-4 text-red-600" /> {totalErros} com erro
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={somenteValidas}
                      onChange={(e) => setSomenteValidas(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>Importar apenas linhas válidas ({totalValidas})</span>
                  </label>

                  <Button
                    onClick={executeImport}
                    disabled={importing || totalValidas === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    {importing ? 'Importando...' : `Confirmar Importação (${totalValidas} linhas)`}
                  </Button>
                </div>
              </div>

              {/* Tabela de Prévia Linha a Linha */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-[550px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Linha</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Cenário Detectado</th>
                        <th className="py-2.5 px-3">CNPJ</th>
                        <th className="py-2.5 px-4">Razão Social / Nome</th>
                        <th className="py-2.5 px-3">Órgão / Contrato</th>
                        <th className="py-2.5 px-3 text-right">Valor (R$)</th>
                        <th className="py-2.5 px-4">Erros / Alertas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validatedRows.map((r) => (
                        <tr
                          key={r.index}
                          className={r.isValid ? 'hover:bg-slate-50/60' : 'bg-red-50/30'}
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-500">{r.index}</td>

                          <td className="py-2.5 px-3">
                            {r.isValid ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                                Válida
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px]">
                                Erro
                              </Badge>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            {r.cenario === 'nova' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-blue-50 text-blue-700 border-blue-300"
                              >
                                Nova
                              </Badge>
                            )}
                            {r.cenario === 'cadastrada' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-50 text-amber-700 border-amber-300"
                              >
                                Já Cadastrada
                              </Badge>
                            )}
                            {r.cenario === 'parceira' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-purple-50 text-purple-700 border-purple-300"
                              >
                                Já Parceira
                              </Badge>
                            )}
                          </td>

                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {r.cnpjFormatted || '—'}
                          </td>

                          <td className="py-2.5 px-4 font-medium text-slate-900 truncate max-w-[200px]">
                            {r.razaoSocial || '—'}
                          </td>

                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-[180px]">
                            {r.orgao ? `${r.orgao}` : '—'}
                            {r.numeroContrato && (
                              <span className="block text-[10px] text-slate-400">
                                {r.numeroContrato}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                            {formatCurrencyBr(r.valorNumber)}
                          </td>

                          <td className="py-2.5 px-4">
                            {r.errors.length > 0 && (
                              <div className="space-y-0.5 text-[11px] text-red-600 font-medium">
                                {r.errors.map((err, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <XCircle className="w-3 h-3 shrink-0" />
                                    <span>{err}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {r.warnings.length > 0 && (
                              <div className="space-y-0.5 text-[11px] text-amber-700">
                                {r.warnings.map((w, i) => (
                                  <div key={i} className="flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                    <span>{w}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {r.errors.length === 0 && r.warnings.length === 0 && (
                              <span className="text-slate-400 text-[11px]">Pronto para gravar</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* PASSO 4: RESULTADO DA IMPORTAÇÃO */}
      {step === 'result' && importResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-xs text-center space-y-6 max-w-xl mx-auto">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">Importação Concluída com Sucesso!</h2>
            <p className="text-xs text-slate-500 mt-1">
              Os registros foram processados e a ação foi devidamente auditada pelo sistema.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Novas Empresas
              </span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                {importResult.sucessoEmpresasNovas}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Contratos Lançados
              </span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                {importResult.sucessoContratosNovos}
              </span>
            </div>

            <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
              <span className="text-[10px] text-purple-600 uppercase font-bold block">
                Alertas Oportunidade
              </span>
              <span className="text-xl font-bold text-purple-900 font-mono">
                {importResult.alertasOportunidade}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">
                Falhas / Erros
              </span>
              <span className="text-xl font-bold text-slate-900 font-mono">
                {importResult.erros}
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <Button
              onClick={() => navigate('/empresas')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Visualizar Lista de Empresas
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFile(null)
                setSheetData(null)
                setValidatedRows([])
                setStep('upload')
              }}
            >
              Nova Importação
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
