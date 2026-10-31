import pb from '@/lib/pocketbase/client'

export type FonteProspeccaoTipo = 'api_externa' | 'importador_csv' | 'transparencia_sancoes'

export interface MapeamentoColunasCsv {
  col_cnpj?: string
  col_razao_social?: string
  col_orgao?: string
  col_numero_contrato?: string
  col_objeto?: string
  col_valor?: string
  col_vigencia_inicio?: string
  col_vigencia_fim?: string
  [key: string]: string | undefined
}

export interface FonteProspeccaoRecord {
  id: string
  nome: string
  slug: string
  tipo: FonteProspeccaoTipo
  ativo: boolean
  cron_expressao?: string
  dias_janela?: number
  ufs?: string
  municipios?: string
  exercicio?: number
  palavras_chave?: string
  cnaes?: string
  limite_por_execucao?: number
  endpoint_base?: string
  requer_chave?: boolean
  chave_configurada?: boolean
  aviso_configuracao?: string
  ultima_execucao?: string
  total_lidos?: number
  total_sugeridos?: number
  total_incorporados?: number
  ultimo_erro?: string
  mapeamento_colunas?: MapeamentoColunasCsv
  config_extra?: Record<string, unknown>
  created: string
  updated: string
}

export interface MetricPorFonte {
  slug: string
  nome: string
  tipo: FonteProspeccaoTipo
  ativo: boolean
  total_lidos: number
  total_sugeridos: number
  total_incorporados: number
  creditos_ia_gastos: number
  ultima_execucao?: string
  ultimo_status?: string
}

export interface MunicipioCearaItem {
  codigo: string
  nome: string
  ibge?: string
}

export type LoteExecucaoTipo = 'cron_automatico' | 'manual_admin' | 'importacao_csv'
export type LoteStatus = 'em_andamento' | 'sucesso' | 'erro_parcial' | 'falha'

export interface LoteProspeccaoAuditoriaRecord {
  id: string
  fonte_slug: string
  fonte_nome: string
  tipo_execucao: LoteExecucaoTipo
  status: LoteStatus
  data_inicio: string
  data_fim?: string
  total_lidos?: number
  total_descartados_cpf?: number
  total_duplicados_dedupe?: number
  total_reativacoes_sugeridas?: number
  total_novas_sugestoes?: number
  total_incorporados?: number
  creditos_ia_gastos?: number
  erro_detalhe?: string
  parametros_aplicados?: Record<string, unknown>
  executado_por?: string
  created: string
  updated: string
}

export interface VarreduraResultado {
  lote_id: string
  total_lidos: number
  descartados_cpf: number
  duplicados_dedupe: number
  reativacoes_sugeridas: number
  novas_sugestoes: number
  creditos_ia_gastos?: number
}

export interface TriagemLotePayload {
  acao: 'aprovar' | 'descartar' | 'incorporar'
  sugestao_ids: string[]
  motivo_descarte?: string
}

export interface TriagemLoteResultado {
  processados: number
  erros: number
  aprovados: string[]
  descartados: string[]
  incorporados: Array<{
    sugestao_id: string
    empresa_id: string
    sancao_status: string
    cadencia_bloqueada: boolean
  }>
}

export interface LinhaCsvComprasnet {
  cnpj?: string
  cnpj_contratada?: string
  razao_social?: string
  nome_fornecedor?: string
  orgao?: string
  uasg_nome?: string
  numero?: string
  numero_contrato?: string
  objeto?: string
  objeto_contrato?: string
  valor?: number | string
  valor_inicial?: number | string
  vigencia_inicio?: string
  vigencia_fim?: string
  tipo_pessoa?: string
  [key: string]: unknown
}

export const prospeccaoService = {
  /**
   * Lista todas as fontes configuradas
   */
  async listarFontes(): Promise<FonteProspeccaoRecord[]> {
    return await pb.collection('fontes_prospeccao').getFullList<FonteProspeccaoRecord>({
      sort: 'slug',
    })
  },

  /**
   * Atualiza uma fonte de prospecção (UFs, municípios, janela, keywords, cnaes, ativo, limite, etc.)
   */
  async atualizarFonte(
    id: string,
    dados: Partial<FonteProspeccaoRecord>,
  ): Promise<FonteProspeccaoRecord> {
    return await pb.collection('fontes_prospeccao').update<FonteProspeccaoRecord>(id, dados)
  },

  /**
   * Lista os lotes de auditoria executados
   */
  async listarAuditoriaLotes(limit: number = 20): Promise<LoteProspeccaoAuditoriaRecord[]> {
    return await pb
      .collection('lotes_prospeccao_auditoria')
      .getList<LoteProspeccaoAuditoriaRecord>(1, limit, {
        sort: '-created',
      })
      .then((res) => res.items)
  },

  /**
   * Dispara varredura sob demanda de uma fonte (PNCP ou TCE-CE)
   */
  async dispararVarredura(
    fonteSlug: string = 'pncp_contratos',
    params?: { municipio?: string; exercicio?: number },
  ): Promise<{
    message: string
    fonte: string
    resultado: VarreduraResultado
  }> {
    return await pb.send('/backend/v1/prospeccao/executar-varredura', {
      method: 'POST',
      body: { fonte_slug: fonteSlug, ...(params || {}) },
    })
  },

  /**
   * Triagem em lote: aprovar, descartar ou incorporar
   */
  async executarTriagemLote(payload: TriagemLotePayload): Promise<TriagemLoteResultado> {
    return await pb.send('/backend/v1/prospeccao/triagem-lote', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Importador de CSV Comprasnet (fallback oficial conforme probe)
   */
  async importarCsvComprasnet(linhas: LinhaCsvComprasnet[]): Promise<{
    message: string
    resultado: VarreduraResultado
  }> {
    return await pb.send('/backend/v1/prospeccao/importar-csv-comprasnet', {
      method: 'POST',
      body: { linhas },
    })
  },

  /**
   * Importador dinâmico de CSV com mapeamento de colunas (Ceará Transparente, Comprasnet, outros)
   */
  async importarCsvDinamico(
    fonteSlug: string,
    linhas: Record<string, unknown>[],
    mapeamento?: MapeamentoColunasCsv,
  ): Promise<{
    message: string
    resultado: VarreduraResultado
  }> {
    return await pb.send('/backend/v1/prospeccao/importar-csv-dinamico', {
      method: 'POST',
      body: { fonte_slug: fonteSlug, linhas, mapeamento },
    })
  },

  /**
   * Lista municípios cearenses da API do TCE-CE (com fallback)
   */
  async listarMunicipiosCeara(): Promise<{
    municipios: MunicipioCearaItem[]
    fonte: string
  }> {
    return await pb.send('/backend/v1/prospeccao/tce-ce/municipios', {
      method: 'GET',
    })
  },

  /**
   * Executa o probe de diagnóstico das fontes
   */
  async probeFontes(): Promise<Record<string, unknown>> {
    return await pb.send('/backend/v1/prospeccao/probe-fontes-ceara-v5', {
      method: 'GET',
    })
  },

  /**
   * Obtém status dinâmico das fontes (ex: presença da chave no servidor)
   */
  async obterStatusFontes(): Promise<{
    portal_transparencia: { chave_presente: boolean; requer_chave: boolean }
  }> {
    return await pb.send('/backend/v1/prospeccao/status-fontes', {
      method: 'GET',
    })
  },

  /**
   * Executa teste e prova real do Portal da Transparência (CEIS e CNEP)
   */
  async testarPortalTransparencia(): Promise<{
    ok: boolean
    chave_presente: boolean
    ceis: { status_http: number; registros_lidos: number }
    cnep: { status_http: number; registros_lidos: number }
    total_lidos: number
    message?: string
  }> {
    return await pb.send('/backend/v1/prospeccao/testar-portal-transparencia', {
      method: 'POST',
    })
  },

  /**
   * Consolida métricas de prospecção por fonte a partir das fontes cadastradas e lotes de auditoria
   */
  async obterMetricasConsolidadas(): Promise<MetricPorFonte[]> {
    const [fontes, lotes] = await Promise.all([
      this.listarFontes(),
      this.listarAuditoriaLotes(100).catch(() => [] as LoteProspeccaoAuditoriaRecord[]),
    ])

    // Mapa de créditos IA e status por fonte a partir dos lotes
    const creditosPorFonte: Record<string, number> = {}
    const ultimoStatusPorFonte: Record<string, string> = {}

    for (const lote of lotes) {
      if (lote.fonte_slug) {
        creditosPorFonte[lote.fonte_slug] =
          (creditosPorFonte[lote.fonte_slug] || 0) + (lote.creditos_ia_gastos || 0)
        if (!ultimoStatusPorFonte[lote.fonte_slug]) {
          ultimoStatusPorFonte[lote.fonte_slug] = lote.status
        }
      }
    }

    return fontes.map((f) => ({
      slug: f.slug,
      nome: f.nome,
      tipo: f.tipo,
      ativo: f.ativo,
      total_lidos: f.total_lidos || 0,
      total_sugeridos: f.total_sugeridos || 0,
      total_incorporados: f.total_incorporados || 0,
      creditos_ia_gastos: creditosPorFonte[f.slug] || 0,
      ultima_execucao: f.ultima_execucao,
      ultimo_status: ultimoStatusPorFonte[f.slug],
    }))
  },
}
