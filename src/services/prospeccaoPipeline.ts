export function limparCnpj(val: string | null | undefined): string {
  if (!val) return ''
  return String(val).replace(/\D/g, '')
}

export function isPessoaFisica(tipoPessoa?: string, niFornecedor?: string): boolean {
  const ni = limparCnpj(niFornecedor)
  if (
    tipoPessoa &&
    (tipoPessoa === 'PF' || tipoPessoa === 'F' || tipoPessoa.toLowerCase().includes('física'))
  ) {
    return true
  }
  if (ni.length === 11) {
    return true
  }
  return false
}

export const DICIONARIO_TERMOS_PESOS = [
  { termo: 'projeto executivo', peso: 35 },
  { termo: 'projeto basico', peso: 30 },
  { termo: 'projeto básico', peso: 30 },
  { termo: 'elaboracao de projetos', peso: 30 },
  { termo: 'elaboração de projetos', peso: 30 },
  { termo: 'estrutural', peso: 20 },
  { termo: 'eletrico', peso: 18 },
  { termo: 'elétrico', peso: 18 },
  { termo: 'hidrossanitario', peso: 18 },
  { termo: 'hidrossanitário', peso: 18 },
  { termo: 'drenagem', peso: 18 },
  { termo: 'pavimentacao', peso: 18 },
  { termo: 'pavimentação', peso: 18 },
  { termo: 'orcamento', peso: 15 },
  { termo: 'orçamento', peso: 15 },
  { termo: 'laudo', peso: 15 },
  { termo: 'engenharia consultiva', peso: 25 },
  { termo: 'gerenciamento de obras', peso: 20 },
  { termo: 'supervisao', peso: 15 },
  { termo: 'supervisão', peso: 15 },
]

export function classificarPorDicionario(objetoTexto: string): {
  score: number
  termos: string[]
} {
  const texto = (objetoTexto || '').toLowerCase()
  if (!texto) return { score: 10, termos: [] }

  let pontuacao = 0
  const termosEncontrados: string[] = []

  for (let i = 0; i < DICIONARIO_TERMOS_PESOS.length; i++) {
    const item = DICIONARIO_TERMOS_PESOS[i]
    if (texto.includes(item.termo)) {
      pontuacao += item.peso
      termosEncontrados.push(item.termo)
    }
  }

  if (termosEncontrados.length > 0) {
    pontuacao = Math.max(30, pontuacao)
  } else {
    pontuacao = 15
  }

  return {
    score: Math.min(100, Math.max(0, pontuacao)),
    termos: termosEncontrados,
  }
}

export function calcularScoreCurvaProvisorio(
  valorContrato: number,
  mesesVigencia: number = 12,
): { score: number; curva: 'A' | 'B' | 'C' } {
  const valor = Number(valorContrato) || 0
  const meses = Number(mesesVigencia) || 12

  const normValor = Math.min(100, Math.max(0, (valor / 10000000) * 100))
  const normVigencia = Math.min(100, Math.max(0, (meses / 36) * 100))
  const normQtd = 20

  const indiceFloat = normValor * 0.5 + normVigencia * 0.3 + normQtd * 0.2
  const score = Math.min(100, Math.max(0, Math.round(indiceFloat)))

  let curva: 'A' | 'B' | 'C' = 'C'
  if (score >= 40 || valor >= 1000000) {
    curva = 'A'
  } else if (score >= 15 || valor >= 200000) {
    curva = 'B'
  } else {
    curva = 'C'
  }

  return { score, curva }
}

export interface ContratoBrutoProspeccao {
  cnpj: string
  tipoPessoa?: string
  razaoSocial?: string
  orgao?: string
  numero?: string
  objeto?: string
  valor?: number
  vigenciaInicio?: string
  vigenciaFim?: string
  link?: string
  uf?: string
  municipio?: string
}

export interface EmpresaSimulada {
  id: string
  cnpj: string
  razao_social: string
  etapa_funil: string
  status: string
}

export interface ContratoSimulado {
  id: string
  empresa: string
  numero: string
  objeto: string
  valor: number
}

export interface ReativacaoSimulada {
  id: string
  empresa: string
  contrato_numero: string
  status: string
}

export interface SugestaoSimulada {
  id: string
  cnpj: string
  razao_social: string
  numero_contrato: string
  score_relevancia: number
  curva_provisoria: string
  status: string
}

/**
 * Função de processamento puro para teste unitário do pipeline de dedupe, descarte de CPF e idempotência
 */
export function processarLoteProspeccaoPuro(
  itens: ContratoBrutoProspeccao[],
  empresasExistentes: EmpresaSimulada[],
  contratosExistentes: ContratoSimulado[],
  sugestoesExistentes: SugestaoSimulada[],
) {
  let descartadosCpf = 0
  let duplicadosDedupe = 0
  const novosContratos: ContratoSimulado[] = []
  const novasReativacoes: ReativacaoSimulada[] = []
  const novasSugestoes: SugestaoSimulada[] = []

  const contratosMap = new Set(contratosExistentes.map((c) => `${c.empresa}_${c.numero}`))
  const sugestoesMap = new Set(sugestoesExistentes.map((s) => `${s.cnpj}_${s.numero_contrato}`))

  for (const item of itens) {
    const cnpjLimpo = limparCnpj(item.cnpj)

    // 1. Descarte CPF
    if (isPessoaFisica(item.tipoPessoa, item.cnpj)) {
      descartadosCpf++
      continue
    }

    if (!cnpjLimpo || cnpjLimpo.length !== 14) continue

    // 2. Dedupe com empresas existentes
    const emp = empresasExistentes.find((e) => e.cnpj === cnpjLimpo)
    if (emp) {
      duplicadosDedupe++
      const keyCtr = `${emp.id}_${item.numero || ''}`
      if (!contratosMap.has(keyCtr)) {
        contratosMap.add(keyCtr)
        novosContratos.push({
          id: `ctr_${Date.now()}_${Math.random()}`,
          empresa: emp.id,
          numero: item.numero || 'CTR-PROSP',
          objeto: item.objeto || '',
          valor: item.valor || 0,
        })
      }

      // Reativação se inativa ou nutrição
      if (
        emp.status === 'inativa' ||
        emp.etapa_funil === 'inativa' ||
        emp.etapa_funil === 'nutricao_mensal'
      ) {
        novasReativacoes.push({
          id: `reat_${Date.now()}_${Math.random()}`,
          empresa: emp.id,
          contrato_numero: item.numero || '',
          status: 'pendente',
        })
      }
      continue
    }

    // 3. Dedupe sugestões (Idempotência)
    const keySug = `${cnpjLimpo}_${item.numero || ''}`
    if (sugestoesMap.has(keySug)) {
      duplicadosDedupe++
      continue
    }

    sugestoesMap.add(keySug)
    const classif = classificarPorDicionario(item.objeto || '')
    const curva = calcularScoreCurvaProvisorio(item.valor || 0, 12)

    novasSugestoes.push({
      id: `sug_${Date.now()}_${Math.random()}`,
      cnpj: cnpjLimpo,
      razao_social: item.razaoSocial || `Empresa ${cnpjLimpo}`,
      numero_contrato: item.numero || '',
      score_relevancia: classif.score,
      curva_provisoria: curva.curva,
      status: 'pendente',
    })
  }

  return {
    descartadosCpf,
    duplicadosDedupe,
    novosContratos,
    novasReativacoes,
    novasSugestoes,
  }
}
