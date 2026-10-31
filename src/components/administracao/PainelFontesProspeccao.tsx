import { useState, useEffect } from 'react'
import {
  FonteProspeccaoRecord,
  LoteProspeccaoAuditoriaRecord,
  prospeccaoService,
} from '@/services/prospeccao'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { formatDateTimeBr } from '@/lib/formatters'
import {
  Globe,
  Upload,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  History,
  Save,
  RotateCw,
  Search,
  Sparkles,
} from 'lucide-react'

export function PainelFontesProspeccao() {
  const { toast } = useToast()
  const [fontes, setFontes] = useState<FonteProspeccaoRecord[]>([])
  const [lotes, setLotes] = useState<LoteProspeccaoAuditoriaRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [executandoFonteSlug, setExecutandoFonteSlug] = useState<string | null>(null)
  const [importandoCsv, setImportandoCsv] = useState(false)
  const [csvConteudo, setCsvConteudo] = useState('')
  const [fonteCsvDestino, setFonteCsvDestino] = useState('comprasnet_contratos')

  // Municípios do Ceará
  const [municipiosCe, setMunicipiosCe] = useState<Array<{ codigo: string; nome: string }>>([])
  const [municipioSelecionado, setMunicipioSelecionado] = useState('044')
  const [exercicioSelecionado, setExercicioSelecionado] = useState(2024)

  // Edição rápida de fonte
  const [editandoFonte, setEditandoFonte] = useState<FonteProspeccaoRecord | null>(null)
  const [salvandoFonte, setSalvandoFonte] = useState(false)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const [listaFontes, listaLotes, resMuns] = await Promise.all([
        prospeccaoService.listarFontes(),
        prospeccaoService.listarAuditoriaLotes(15),
        prospeccaoService.listarMunicipiosCeara().catch(() => ({ municipios: [], fonte: '' })),
      ])
      setFontes(listaFontes)
      setLotes(listaLotes)
      if (resMuns.municipios && resMuns.municipios.length > 0) {
        setMunicipiosCe(resMuns.municipios)
      }
    } catch (err) {
      toast({
        title: 'Erro ao carregar fontes',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const handleDispararFonte = async (fonte: FonteProspeccaoRecord) => {
    // Se for portal_transparencia e estiver desligado por falta de chave
    if (fonte.slug === 'portal_transparencia' && !fonte.chave_configurada) {
      toast({
        title: 'Fonte Desligada — Chave Ausente',
        description:
          fonte.aviso_configuracao ||
          'Chave PORTAL_TRANSPARENCIA_API_KEY ausente no servidor. Configure a chave de API da CGU para ativar a consulta de sanções.',
        variant: 'destructive',
      })
      return
    }

    // Se for importador de CSV, orienta a usar a seção de importação
    if (fonte.tipo === 'importador_csv') {
      setFonteCsvDestino(fonte.slug)
      toast({
        title: `${fonte.nome} é um Importador de CSV`,
        description:
          'Utilize a seção "Importador de CSV com Mapeamento de Colunas Salvo" abaixo para ingerir o arquivo oficial.',
      })
      const secaoCsv = document.getElementById('secao-importador-csv')
      if (secaoCsv) {
        secaoCsv.scrollIntoView({ behavior: 'smooth' })
      }
      return
    }

    setExecutandoFonteSlug(fonte.slug)
    try {
      const params =
        fonte.slug === 'tce_ce_contratacoes'
          ? {
              municipio: municipioSelecionado || fonte.municipios || '044',
              exercicio: exercicioSelecionado || fonte.exercicio || 2024,
            }
          : undefined

      const res = await prospeccaoService.dispararVarredura(fonte.slug, params)
      toast({
        title: `Varredura concluída: ${fonte.nome}`,
        description: `Lidos: ${res.resultado.total_lidos} | Novas Sugestões: ${res.resultado.novas_sugestoes} | Dedupe: ${res.resultado.duplicados_dedupe} | Descarte CPF: ${res.resultado.descartados_cpf}`,
      })
      carregarDados()
    } catch (err) {
      toast({
        title: `Falha na varredura (${fonte.nome})`,
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setExecutandoFonteSlug(null)
    }
  }

  const handleSalvarEdicaoFonte = async () => {
    if (!editandoFonte) return
    setSalvandoFonte(true)
    try {
      await prospeccaoService.atualizarFonte(editandoFonte.id, {
        ativo: editandoFonte.ativo,
        ufs: editandoFonte.ufs,
        municipios: editandoFonte.municipios,
        dias_janela: Number(editandoFonte.dias_janela) || 7,
        palavras_chave: editandoFonte.palavras_chave,
        cnaes: editandoFonte.cnaes,
        exercicio: Number(editandoFonte.exercicio) || 2024,
        mapeamento_colunas: editandoFonte.mapeamento_colunas,
        cron_expressao: editandoFonte.cron_expressao,
        limite_por_execucao: Number(editandoFonte.limite_por_execucao) || 50,
      })
      toast({
        title: 'Configuração atualizada',
        description: `Parâmetros da fonte ${editandoFonte.nome} gravados no banco.`,
      })
      setEditandoFonte(null)
      carregarDados()
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setSalvandoFonte(false)
    }
  }

  const handleProcessarCsv = async () => {
    if (!csvConteudo.trim()) {
      toast({
        title: 'CSV vazio',
        description: 'Cole o conteúdo do CSV ou cabeçalho e linhas da tabela Comprasnet.',
        variant: 'destructive',
      })
      return
    }

    setImportandoCsv(true)
    try {
      // Parser simples de CSV: divide linhas e colunas por vírgula ou ponto-e-vírgula
      const linhas = csvConteudo.trim().split('\n')
      if (linhas.length < 2) {
        throw new Error('O CSV deve conter pelo menos 1 linha de cabeçalho e 1 linha de dados.')
      }

      const separador = linhas[0].includes(';') ? ';' : ','
      const cabecalho = linhas[0].split(separador).map((c) => c.replace(/["\r]/g, '').trim())

      const registros = []
      for (let i = 1; i < linhas.length; i++) {
        if (!linhas[i].trim()) continue
        const colunas = linhas[i].split(separador).map((c) => c.replace(/["\r]/g, '').trim())
        const obj: Record<string, string> = {}
        for (let j = 0; j < cabecalho.length; j++) {
          obj[cabecalho[j]] = colunas[j] || ''
        }
        registros.push(obj)
      }

      const res = await prospeccaoService.importarCsvDinamico(fonteCsvDestino, registros)
      toast({
        title: 'Importação de CSV concluída',
        description: `Lidos: ${res.resultado.total_lidos} | Novas Sugestões: ${res.resultado.novas_sugestoes} | Dedupe: ${res.resultado.duplicados_dedupe}`,
      })
      setCsvConteudo('')
      carregarDados()
    } catch (err) {
      toast({
        title: 'Erro no parse do CSV',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setImportandoCsv(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#D95A2B]" />
            Fontes de Prospecção Automática (Rodada 14)
          </h2>
          <p className="text-xs text-slate-500">
            Varredura contínua de contratos públicos, classificação de relevância e triagem no
            Funil. Parâmetros configuráveis no banco de dados, nunca fixos no código.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor rápido de Município CE para o botão de varredura TCE-CE */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs">
            <span className="text-slate-500 font-medium">TCE-CE:</span>
            <select
              value={municipioSelecionado}
              onChange={(e) => setMunicipioSelecionado(e.target.value)}
              className="h-7 text-xs border border-slate-300 rounded px-1.5 bg-white font-mono"
            >
              {municipiosCe.length > 0 ? (
                municipiosCe.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.codigo} - {m.nome}
                  </option>
                ))
              ) : (
                <>
                  <option value="044">044 - FORTALEZA</option>
                  <option value="042">042 - CAUCAIA</option>
                  <option value="075">075 - JUAZEIRO DO NORTE</option>
                  <option value="088">088 - MARACANAÚ</option>
                  <option value="135">135 - SOBRAL</option>
                </>
              )}
            </select>
            <select
              value={exercicioSelecionado}
              onChange={(e) => setExercicioSelecionado(Number(e.target.value))}
              className="h-7 text-xs border border-slate-300 rounded px-1.5 bg-white font-mono"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="text-xs h-8"
          >
            <RotateCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const fPncp = fontes.find((f) => f.slug === 'pncp_contratos')
              if (fPncp) handleDispararFonte(fPncp)
            }}
            disabled={Boolean(executandoFonteSlug)}
            className="bg-[#D95A2B] hover:bg-[#c24e24] text-xs h-8 text-white gap-1.5"
          >
            <Play
              className={`w-3.5 h-3.5 ${executandoFonteSlug === 'pncp_contratos' ? 'animate-spin' : ''}`}
            />
            {executandoFonteSlug === 'pncp_contratos' ? 'Varrendo PNCP...' : 'Varredura PNCP'}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const fTce = fontes.find((f) => f.slug === 'tce_ce_contratacoes')
              if (fTce) handleDispararFonte(fTce)
            }}
            disabled={Boolean(executandoFonteSlug)}
            className="bg-emerald-700 hover:bg-emerald-800 text-xs h-8 text-white gap-1.5"
          >
            <Play
              className={`w-3.5 h-3.5 ${executandoFonteSlug === 'tce_ce_contratacoes' ? 'animate-spin' : ''}`}
            />
            {executandoFonteSlug === 'tce_ce_contratacoes'
              ? 'Varrendo TCE-CE...'
              : 'Varredura TCE-CE'}
          </Button>
        </div>
      </div>

      {/* Grid de Fontes Cadastradas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {fontes.map((f) => {
          const isTransp = f.slug === 'portal_transparencia'
          const isComprasnet = f.slug === 'comprasnet_contratos'
          const isTceCe = f.slug === 'tce_ce_contratacoes'
          const isCearaTransp = f.slug === 'ceara_transparente_csv'

          return (
            <Card key={f.id} className="border-slate-200 shadow-sm flex flex-col justify-between">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      {f.nome}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          f.ativo
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]'
                            : 'bg-slate-100 text-slate-600 border-slate-300 text-[10px]'
                        }
                      >
                        {f.ativo ? 'Ativo' : 'Desligado'}
                      </Badge>
                      <span className="text-[11px] font-mono text-slate-500 uppercase">
                        {f.tipo}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditandoFonte({ ...f })}
                    className="h-7 text-xs text-blue-600 hover:text-blue-800"
                  >
                    Editar
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-2 text-xs space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  {/* Alerta de Transparência se chave ausente */}
                  {isTransp && !f.chave_configurada && (
                    <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-semibold text-[11px]">Chave de API Ausente</div>
                        <div className="text-[10px] leading-tight text-amber-700">
                          {f.aviso_configuracao ||
                            'Chave da CGU não cadastrada na variável PORTAL_TRANSPARENCIA_API_KEY. Fonte desligada por padrão até a inserção da chave.'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Informação Comprasnet */}
                  {isComprasnet && (
                    <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-800 text-[11px] leading-tight">
                      <strong>Importador CSV:</strong> API direta respondeu 404 (legada no
                      dados.gov.br). Opera via importação de arquivo CSV oficial abaixo.
                    </div>
                  )}

                  {/* Informação TCE-CE */}
                  {isTceCe && (
                    <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] leading-tight space-y-1">
                      <div>
                        <strong>API Ativa (TCE-CE SIM):</strong> Consulta aberta de licitações e
                        fornecedores por município cearense e exercício.
                      </div>
                      <div className="text-[10px] text-emerald-700">
                        Município atual:{' '}
                        <span className="font-mono font-semibold">{f.municipios || '044'}</span> |
                        Exercício:{' '}
                        <span className="font-mono font-semibold">{f.exercicio || 2024}</span>
                      </div>
                    </div>
                  )}

                  {/* Informação Ceará Transparente */}
                  {isCearaTransp && (
                    <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-tight">
                      <strong>Importador CSV Dinâmico:</strong> Portal Ceará Transparente respondeu
                      HTTP 502 no probe. Opera via importador de CSV com mapeamento de colunas
                      salvo.
                    </div>
                  )}

                  {/* Métricas de totais */}
                  <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded border border-slate-200 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Lidos</div>
                      <div className="font-semibold text-slate-800 text-sm">
                        {f.total_lidos || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Sugeridos</div>
                      <div className="font-semibold text-[#D95A2B] text-sm">
                        {f.total_sugeridos || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Incorporados</div>
                      <div className="font-semibold text-emerald-700 text-sm">
                        {f.total_incorporados || 0}
                      </div>
                    </div>
                  </div>

                  {/* Detalhes de Parâmetros */}
                  <div className="space-y-1 text-slate-600 text-[11px]">
                    {f.cron_expressao && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Agendamento: {f.cron_expressao} (Diário)</span>
                      </div>
                    )}
                    {f.dias_janela ? <div>Janela de consulta: {f.dias_janela} dias</div> : null}
                    {f.ufs && (
                      <div>
                        UFs: <span className="font-mono">{f.ufs}</span>
                      </div>
                    )}
                    {f.cnaes && (
                      <div>
                        CNAEs: <span className="font-mono">{f.cnaes}</span>
                      </div>
                    )}
                    <div className="text-slate-400 text-[10px]">
                      Última execução: {formatDateTimeBr(f.ultima_execucao) || 'Nunca'}
                    </div>
                    {f.ultimo_erro ? (
                      <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-mono break-all">
                        <span className="font-bold block text-rose-800">Último erro real:</span>
                        {f.ultimo_erro}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-[10px] italic">
                        Último erro: nenhum registro de falha.
                      </div>
                    )}
                  </div>
                </div>

                {/* Botão Rodar Agora por Fonte */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                  <span className="text-[10px] text-slate-400">
                    {f.tipo === 'importador_csv'
                      ? 'Upload de arquivo CSV'
                      : f.tipo === 'transparencia_sancoes'
                        ? 'Consulta sob demanda'
                        : 'Disparo da API'}
                  </span>
                  <Button
                    size="sm"
                    variant={isTransp && !f.chave_configurada ? 'outline' : 'default'}
                    onClick={() => handleDispararFonte(f)}
                    disabled={Boolean(executandoFonteSlug)}
                    className={
                      isTransp && !f.chave_configurada
                        ? 'text-amber-700 border-amber-300 hover:bg-amber-50 h-7 text-xs gap-1'
                        : isComprasnet || isCearaTransp
                          ? 'bg-slate-800 hover:bg-slate-900 text-white h-7 text-xs gap-1'
                          : 'bg-[#D95A2B] hover:bg-[#c24e24] text-white h-7 text-xs gap-1'
                    }
                  >
                    <Play
                      className={`w-3 h-3 ${executandoFonteSlug === f.slug ? 'animate-spin' : ''}`}
                    />
                    {executandoFonteSlug === f.slug
                      ? 'Executando...'
                      : isComprasnet || isCearaTransp
                        ? 'Abrir Importador'
                        : 'Rodar agora'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Modal / Formulário de Edição de Fonte */}
      {editandoFonte && (
        <Card className="border-blue-300 bg-blue-50/20 shadow-md">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Configurar Parâmetros: {editandoFonte.nome}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditandoFonte(null)}
                className="h-6 text-xs text-slate-500"
              >
                Cancelar
              </Button>
            </CardTitle>
            <CardDescription className="text-xs">
              Altere UFs, municípios, janela de datas, palavras-chave do objeto e CNAEs.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Status Ativo</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Switch
                    checked={editandoFonte.ativo}
                    onCheckedChange={(val) => setEditandoFonte({ ...editandoFonte, ativo: val })}
                  />
                  <span className="text-xs font-medium">
                    {editandoFonte.ativo ? 'Fonte Ativada' : 'Fonte Desligada'}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Janela em Dias</Label>
                <Input
                  type="number"
                  value={editandoFonte.dias_janela || 7}
                  onChange={(e) =>
                    setEditandoFonte({ ...editandoFonte, dias_janela: Number(e.target.value) })
                  }
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Limite por Execução</Label>
                <Input
                  type="number"
                  value={editandoFonte.limite_por_execucao || 50}
                  onChange={(e) =>
                    setEditandoFonte({
                      ...editandoFonte,
                      limite_por_execucao: Number(e.target.value),
                    })
                  }
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">UFs (separadas por vírgula)</Label>
                <Input
                  value={editandoFonte.ufs || ''}
                  onChange={(e) => setEditandoFonte({ ...editandoFonte, ufs: e.target.value })}
                  placeholder="SP, RJ, MG, PR, SC, RS, CE..."
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">CNAEs Obrigatórios / Relevantes</Label>
                <Input
                  value={editandoFonte.cnaes || ''}
                  onChange={(e) => setEditandoFonte({ ...editandoFonte, cnaes: e.target.value })}
                  placeholder="7111-1/00, 7112-0/00, 7119-7/99, 7410-2/00"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Municípios / Códigos TCE-CE</Label>
                <Input
                  value={editandoFonte.municipios || ''}
                  onChange={(e) =>
                    setEditandoFonte({ ...editandoFonte, municipios: e.target.value })
                  }
                  placeholder="Ex: 044 (Fortaleza), 042 (Caucaia), 135 (Sobral)"
                  className="h-8 text-xs bg-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Exercício Orçamentário / Ano</Label>
                <Input
                  type="number"
                  value={editandoFonte.exercicio || 2024}
                  onChange={(e) =>
                    setEditandoFonte({ ...editandoFonte, exercicio: Number(e.target.value) })
                  }
                  placeholder="2024"
                  className="h-8 text-xs bg-white font-mono"
                />
              </div>
            </div>

            {/* Mapeamento de Colunas CSV se for importador */}
            {editandoFonte.tipo === 'importador_csv' && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#D95A2B]" />
                  Mapeamento de Colunas CSV (Configurável por Fonte)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <Label className="text-[10px] text-slate-500">Coluna CNPJ</Label>
                    <Input
                      value={editandoFonte.mapeamento_colunas?.col_cnpj || ''}
                      onChange={(e) =>
                        setEditandoFonte({
                          ...editandoFonte,
                          mapeamento_colunas: {
                            ...(editandoFonte.mapeamento_colunas || {}),
                            col_cnpj: e.target.value,
                          },
                        })
                      }
                      className="h-7 text-xs bg-white font-mono"
                      placeholder="cnpj / cpf_cnpj"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Coluna Razão Social</Label>
                    <Input
                      value={editandoFonte.mapeamento_colunas?.col_razao_social || ''}
                      onChange={(e) =>
                        setEditandoFonte({
                          ...editandoFonte,
                          mapeamento_colunas: {
                            ...(editandoFonte.mapeamento_colunas || {}),
                            col_razao_social: e.target.value,
                          },
                        })
                      }
                      className="h-7 text-xs bg-white font-mono"
                      placeholder="razao_social / contratada"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Coluna Órgão</Label>
                    <Input
                      value={editandoFonte.mapeamento_colunas?.col_orgao || ''}
                      onChange={(e) =>
                        setEditandoFonte({
                          ...editandoFonte,
                          mapeamento_colunas: {
                            ...(editandoFonte.mapeamento_colunas || {}),
                            col_orgao: e.target.value,
                          },
                        })
                      }
                      className="h-7 text-xs bg-white font-mono"
                      placeholder="orgao / contratante"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Coluna Número Contrato</Label>
                    <Input
                      value={editandoFonte.mapeamento_colunas?.col_numero_contrato || ''}
                      onChange={(e) =>
                        setEditandoFonte({
                          ...editandoFonte,
                          mapeamento_colunas: {
                            ...(editandoFonte.mapeamento_colunas || {}),
                            col_numero_contrato: e.target.value,
                          },
                        })
                      }
                      className="h-7 text-xs bg-white font-mono"
                      placeholder="numero / num_contrato"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Coluna Objeto</Label>
                    <Input
                      value={editandoFonte.mapeamento_colunas?.col_objeto || ''}
                      onChange={(e) =>
                        setEditandoFonte({
                          ...editandoFonte,
                          mapeamento_colunas: {
                            ...(editandoFonte.mapeamento_colunas || {}),
                            col_objeto: e.target.value,
                          },
                        })
                      }
                      className="h-7 text-xs bg-white font-mono"
                      placeholder="objeto / descricao"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Coluna Valor</Label>
                    <Input
                      value={editandoFonte.mapeamento_colunas?.col_valor || ''}
                      onChange={(e) =>
                        setEditandoFonte({
                          ...editandoFonte,
                          mapeamento_colunas: {
                            ...(editandoFonte.mapeamento_colunas || {}),
                            col_valor: e.target.value,
                          },
                        })
                      }
                      className="h-7 text-xs bg-white font-mono"
                      placeholder="valor / valor_global"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Início Vigência</Label>
                    <Input
                      value={editandoFonte.mapeamento_colunas?.col_vigencia_inicio || ''}
                      onChange={(e) =>
                        setEditandoFonte({
                          ...editandoFonte,
                          mapeamento_colunas: {
                            ...(editandoFonte.mapeamento_colunas || {}),
                            col_vigencia_inicio: e.target.value,
                          },
                        })
                      }
                      className="h-7 text-xs bg-white font-mono"
                      placeholder="vigencia_inicio"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500">Fim Vigência</Label>
                    <Input
                      value={editandoFonte.mapeamento_colunas?.col_vigencia_fim || ''}
                      onChange={(e) =>
                        setEditandoFonte({
                          ...editandoFonte,
                          mapeamento_colunas: {
                            ...(editandoFonte.mapeamento_colunas || {}),
                            col_vigencia_fim: e.target.value,
                          },
                        })
                      }
                      className="h-7 text-xs bg-white font-mono"
                      placeholder="vigencia_fim"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Palavras-chave do Objeto (separadas por vírgula)
              </Label>
              <Textarea
                rows={2}
                value={editandoFonte.palavras_chave || ''}
                onChange={(e) =>
                  setEditandoFonte({ ...editandoFonte, palavras_chave: e.target.value })
                }
                placeholder="projeto executivo, projeto básico, elaboração de projetos, estrutural, elétrico, hidrossanitário..."
                className="text-xs bg-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditandoFonte(null)}
                className="text-xs h-8"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSalvarEdicaoFonte}
                disabled={salvandoFonte}
                className="bg-blue-600 hover:bg-blue-700 text-xs h-8 text-white gap-1"
              >
                <Save className="w-3.5 h-3.5" />
                {salvandoFonte ? 'Salvando...' : 'Salvar Parâmetros'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seção Importador CSV Dinâmico (Comprasnet e Ceará Transparente) */}
      <Card id="secao-importador-csv" className="border-slate-200">
        <CardHeader className="p-4 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-[#D95A2B]" />
                Importador de CSV com Mapeamento de Colunas Salvo por Fonte
              </CardTitle>
              <CardDescription className="text-xs">
                Ingira arquivos CSV de portais externos (Ceará Transparente, Comprasnet, outros)
                usando o mapeamento dinâmico configurado na fonte. Aplica o mesmo pipeline: descarte
                de CPF, dedupe e classificação.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500 whitespace-nowrap">Fonte destino:</Label>
              <select
                value={fonteCsvDestino}
                onChange={(e) => setFonteCsvDestino(e.target.value)}
                className="h-8 text-xs border border-slate-300 rounded px-2 bg-white"
              >
                <option value="ceara_transparente_csv">
                  Ceará Transparente (transparencia.ce.gov.br)
                </option>
                <option value="comprasnet_contratos">Comprasnet Contratos (Governo Federal)</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Textarea
            rows={4}
            value={csvConteudo}
            onChange={(e) => setCsvConteudo(e.target.value)}
            placeholder={
              fonteCsvDestino === 'ceara_transparente_csv'
                ? `cpf_cnpj_contratada,nome_contratada,orgao_contratante,numero_contrato,objeto_contrato,valor_contrato,data_inicio_vigencia,data_fim_vigencia\n12345678000199,ENG CONSTRUTORA CE LTDA,SOP CEARA,CTR-044/2026,Elaboração de projetos executivos de engenharia rodoviária,850000,2026-01-01,2027-01-01`
                : `cnpj,razao_social,orgao,numero_contrato,objeto,valor,vigencia_inicio,vigencia_fim\n12345678000199,ENG CONSTRUTORA LTDA,MINISTERIO TRANSPORTES,CTR-01/2026,Elaboração de projeto executivo estrutural e drenagem,450000,2026-01-01,2027-01-01`
            }
            className="text-xs font-mono bg-slate-50"
          />
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>
              {fonteCsvDestino === 'ceara_transparente_csv'
                ? 'Mapeamento Ceará: cpf_cnpj_contratada, nome_contratada, orgao_contratante, objeto_contrato, valor_contrato'
                : 'Mapeamento Comprasnet: cnpj, razao_social, orgao, numero_contrato, objeto, valor'}
            </span>
            <Button
              size="sm"
              onClick={handleProcessarCsv}
              disabled={importandoCsv || !csvConteudo.trim()}
              className="bg-slate-900 hover:bg-slate-800 text-xs h-8 text-white gap-1.5"
            >
              <Upload className={`w-3.5 h-3.5 ${importandoCsv ? 'animate-spin' : ''}`} />
              {importandoCsv ? 'Processando Lote...' : 'Parsear e Ingerir CSV'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico / Auditoria dos Lotes */}
      <Card className="border-slate-200">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-600" />
            Auditoria de Execuções e Lotes de Prospecção
          </CardTitle>
          <CardDescription className="text-xs">
            Registro detalhado de início, fim, descartes de CPF, dedupe, novas sugestões e créditos
            de IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Início / Fim</th>
                  <th className="py-2.5 px-4">Fonte</th>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4 text-center">Lidos</th>
                  <th className="py-2.5 px-4 text-center">Descartados CPF</th>
                  <th className="py-2.5 px-4 text-center">Dedupe</th>
                  <th className="py-2.5 px-4 text-center">Reativações</th>
                  <th className="py-2.5 px-4 text-center">Novas Sugestões</th>
                  <th className="py-2.5 px-4 text-center">Créditos IA</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lotes.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-slate-500">
                      Nenhum lote de varredura registrado ainda.
                    </td>
                  </tr>
                ) : (
                  lotes.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80">
                      <td className="py-2 px-4 whitespace-nowrap text-slate-600">
                        <div>{formatDateTimeBr(l.data_inicio)}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatDateTimeBr(l.data_fim)}
                        </div>
                      </td>
                      <td className="py-2 px-4 font-semibold text-slate-900">{l.fonte_nome}</td>
                      <td className="py-2 px-4">
                        <Badge variant="outline" className="text-[10px]">
                          {l.tipo_execucao}
                        </Badge>
                      </td>
                      <td className="py-2 px-4 text-center font-mono font-medium">
                        {l.total_lidos || 0}
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-amber-700">
                        {l.total_descartados_cpf || 0}
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-blue-700">
                        {l.total_duplicados_dedupe || 0}
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-purple-700 font-semibold">
                        {l.total_reativacoes_sugeridas || 0}
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-emerald-700 font-bold">
                        {l.total_novas_sugestoes || 0}
                      </td>
                      <td className="py-2 px-4 text-center font-mono text-indigo-700">
                        {l.creditos_ia_gastos || 0}
                      </td>
                      <td className="py-2 px-4">
                        {l.status === 'sucesso' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sucesso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
                            {l.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
