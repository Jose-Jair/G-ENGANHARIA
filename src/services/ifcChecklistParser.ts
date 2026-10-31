// =============================================================================
// GESTÃO G+ — PARSER E CHECKLIST DE ENTRADA IFC NO NAVEGADOR (RODADA 17)
// Executado inteiramente no cliente antes de enviar o arquivo ao servidor.
// 1. Cálculo de Hash SHA-256 (Web Crypto API)
// 2. Extração de Schema (IFC2X3, IFC4, etc.)
// 3. Validação de Unidade Métrica (METRE / MILLIMETRE)
// 4. Extração de Pavimentos Nomeados (IfcBuildingStorey)
// 5. Contagem de Classes e Elementos sem pavimento associado
// 6. Verificação de classes esperadas por disciplina técnica
// =============================================================================

import type { ResumoIfcContagem } from '@/types'

export interface ItemChecklistResultado {
  regra: string
  descricao: string
  aprovado: boolean
  detalhes?: string
  bloqueante: boolean
}

export interface ChecklistIfcResultado {
  valido: boolean
  schema: string
  unidadeMetrica: boolean
  totalElementos: number
  pavimentos: string[]
  classes: Record<string, number>
  elementosSemPavimento: number
  disciplinasDetectadas: string[]
  itensChecklist: ItemChecklistResultado[]
  avisos: string[]
  bloqueios: string[]
  hashSha256: string
  tamanhoBytes: number
  tempoProcessamentoMs: number
}

// Classes mínimas esperadas por disciplina
export const CLASSES_ESPERADAS_DISCIPLINA: Record<string, string[]> = {
  arquitetura: ['IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCSLAB', 'IFCDOOR', 'IFCWINDOW', 'IFCSPACE'],
  estrutural: ['IFCBEAM', 'IFCCOLUMN', 'IFCSLAB', 'IFCFOOTING', 'IFCREINFORCINGBAR', 'IFCPILE'],
  hidraulica: [
    'IFCPIPESEGMENT',
    'IFCPIPEFITTING',
    'IFCSANITARYTERMINAL',
    'IFCFLOWCONTROLLER',
    'IFCVALVE',
  ],
  eletrica: [
    'IFCCABLESEGMENT',
    'IFCJUNCTIONBOX',
    'IFCOUTLET',
    'IFCSWITCHINGDEVICE',
    'IFCLIGHTFIXTURE',
  ],
  climatizacao: [
    'IFCDUCTSEGMENT',
    'IFCDUCTFITTING',
    'IFCAIRTERMINAL',
    'IFCFAN',
    'IFCUNITARYEQUIPMENT',
  ],
}

/**
 * Calcula o hash SHA-256 do arquivo no navegador usando a Web Crypto API nativa
 */
export async function calcularSha256(arquivo: File | Blob): Promise<string> {
  const buffer = await arquivo.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Analisa e valida um arquivo IFC textual (.ifc STEP Physical File)
 */
export async function analisarEValidarIfc(
  arquivo: File,
  disciplinaSugerida?: string,
): Promise<ChecklistIfcResultado> {
  const inicio = performance.now()
  const hashSha256 = await calcularSha256(arquivo)
  const tamanhoBytes = arquivo.size

  // Lemos o texto em blocos ou completo se < 50MB
  const texto = await arquivo.text()

  const linhas = texto.split(/\r?\n/)
  let schema = 'DESCONHECIDO'
  let unidadeMetrica = false
  const pavimentosSet = new Set<string>()
  const classesCount: Record<string, number> = {}
  let totalElementos = 0
  let elementosRelacionadosAoPavimento = 0

  // Regexes para STEP / IFC
  // Schema no header: FILE_SCHEMA(('IFC2X3')); ou FILE_SCHEMA(('IFC4'));
  const schemaRegex = /FILE_SCHEMA\s*\(\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/i
  const headerMatch = texto.match(schemaRegex)
  if (headerMatch && headerMatch[1]) {
    schema = headerMatch[1].toUpperCase()
  } else {
    // Tenta encontrar IFC2X3 ou IFC4 solto na seção de header
    const mAlt = texto.slice(0, 4000).match(/(IFC2X3|IFC4X[0-9]|IFC4)/i)
    if (mAlt) schema = mAlt[1].toUpperCase()
  }

  // Unidade Métrica: SI_UNIT(*, .LENGTHUNIT., $, .METRE.) ou MILLI, .METRE.
  if (
    texto.includes('.METRE.') ||
    texto.includes('MILLI, .METRE.') ||
    texto.includes('.MILLIMETRE.') ||
    texto.includes('IFCSIUNIT(*,.LENGTHUNIT.')
  ) {
    unidadeMetrica = true
  }

  // Varredura de entidades #id = IFCCLASS(...)
  // Ex: #123 = IFCBUILDINGSTOREY('guid', #1, 'Pavimento 01', $, $, $, $, $, $, $);
  const entidadeRegex = /#\d+\s*=\s*(IFC[A-Z0-9_]+)\s*\((.*?)\);/i
  const storeyNameRegex = /#\d+\s*=\s*IFCBUILDINGSTOREY\s*\([^,]*,[^,]*,['"]([^'"]+)['"]/i

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim()
    if (!linha || !linha.startsWith('#')) continue

    // Verifica se é Pavimento
    const storeyMatch = linha.match(storeyNameRegex)
    if (storeyMatch && storeyMatch[1]) {
      const nomePav = storeyMatch[1].trim()
      if (nomePav) pavimentosSet.add(nomePav)
    }

    // Contabiliza classes
    const entMatch = linha.match(entidadeRegex)
    if (entMatch) {
      const className = entMatch[1].toUpperCase()
      // Filtra entidades geométricas puras para não poluir contagem de componentes
      if (
        className.startsWith('IFC') &&
        ![
          'IFCLABEL',
          'IFCTEXT',
          'IFCIDENTIFIER',
          'IFCINTEGER',
          'IFCREAL',
          'IFCBOOLEAN',
          'IFCLOGICAL',
        ].includes(className)
      ) {
        classesCount[className] = (classesCount[className] || 0) + 1

        // Componentes construtivos de interesse
        if (
          className.includes('WALL') ||
          className.includes('SLAB') ||
          className.includes('BEAM') ||
          className.includes('COLUMN') ||
          className.includes('DOOR') ||
          className.includes('WINDOW') ||
          className.includes('PIPE') ||
          className.includes('DUCT') ||
          className.includes('CABLE') ||
          className.includes('EQUIPMENT') ||
          className.includes('FITTING') ||
          className.includes('FOOTING') ||
          className.includes('ROOF') ||
          className.includes('STAIR') ||
          className.includes('RAILING')
        ) {
          totalElementos++
        }
      }

      // Relação elemento-pavimento (IFCRELCONTAINEDINSPATIALSTRUCTURE)
      if (className === 'IFCRELCONTAINEDINSPATIALSTRUCTURE') {
        // Conta a quantidade de referências #id dentro da lista de elementos
        const args = entMatch[2]
        const refs = args.match(/#\d+/g)
        if (refs && refs.length > 1) {
          elementosRelacionadosAoPavimento += refs.length - 1
        }
      }
    }
  }

  // Detecta disciplinas presentes a partir das classes existentes
  const disciplinasDetectadas: string[] = []
  for (const [disc, classesDisc] of Object.entries(CLASSES_ESPERADAS_DISCIPLINA)) {
    const temAlguma = classesDisc.some((c) => classesCount[c] && classesCount[c] > 0)
    if (temAlguma) disciplinasDetectadas.push(disc)
  }

  const pavimentos = Array.from(pavimentosSet)
  const elementosSemPavimento = Math.max(0, totalElementos - elementosRelacionadosAoPavimento)

  // Executa as regras do checklist de entrada
  const itensChecklist: ItemChecklistResultado[] = []
  const avisos: string[] = []
  const bloqueios: string[] = []

  // 1. Validação de Schema (IFC2X3 ou IFC4)
  const schemaValido = schema.includes('IFC2X3') || schema.includes('IFC4')
  itensChecklist.push({
    regra: 'schema_ifc_padrao',
    descricao: 'Esquema IFC padronizado (IFC2x3 ou IFC4)',
    aprovado: schemaValido,
    detalhes: schemaValido
      ? `Schema identificado: ${schema}`
      : `Schema não reconhecido ou inválido: ${schema}`,
    bloqueante: true,
  })
  if (!schemaValido) {
    bloqueios.push(
      `O arquivo não possui schema IFC válido (esperado IFC2x3 ou IFC4; encontrado: ${schema}).`,
    )
  }

  // 2. Pavimentos nomeados
  const temPavimentos = pavimentos.length > 0
  itensChecklist.push({
    regra: 'pavimentos_nomeados',
    descricao: 'Pavimentos organizados e nomeados (IfcBuildingStorey)',
    aprovado: temPavimentos,
    detalhes: temPavimentos
      ? `${pavimentos.length} pavimento(s) identificado(s): ${pavimentos.slice(0, 4).join(', ')}${pavimentos.length > 4 ? '...' : ''}`
      : 'Nenhum IfcBuildingStorey nomeado foi encontrado no arquivo IFC.',
    bloqueante: true,
  })
  if (!temPavimentos) {
    bloqueios.push('O arquivo IFC deve conter ao menos um pavimento nomeado (IfcBuildingStorey).')
  }

  // 3. Unidade métrica
  itensChecklist.push({
    regra: 'unidade_metrica',
    descricao: 'Unidade dimensional métrica (Metros ou Milímetros)',
    aprovado: unidadeMetrica,
    detalhes: unidadeMetrica
      ? 'Unidade métrica (.METRE. / MILLIMETRE) confirmada.'
      : 'Não foi possível confirmar unidades métricas no cabeçalho SI_UNIT.',
    bloqueante: true,
  })
  if (!unidadeMetrica) {
    bloqueios.push('O arquivo IFC não está configurado em unidades métricas (m ou mm).')
  }

  // 4. Classes esperadas por disciplina (se informada)
  if (disciplinaSugerida && CLASSES_ESPERADAS_DISCIPLINA[disciplinaSugerida.toLowerCase()]) {
    const esperadas = CLASSES_ESPERADAS_DISCIPLINA[disciplinaSugerida.toLowerCase()]
    const encontradas = esperadas.filter((c) => classesCount[c] && classesCount[c] > 0)
    const aprovadoClasses = encontradas.length > 0
    itensChecklist.push({
      regra: 'classes_esperadas_disciplina',
      descricao: `Classes compatíveis com a disciplina "${disciplinaSugerida}"`,
      aprovado: aprovadoClasses,
      detalhes: aprovadoClasses
        ? `Classes encontradas: ${encontradas.join(', ')}`
        : `Nenhuma das classes esperadas (${esperadas.join(', ')}) foi identificada no modelo.`,
      bloqueante: false, // aviso não bloqueante para permitir modelos conceituais
    })
    if (!aprovadoClasses) {
      avisos.push(`O arquivo não contém as classes habituais da disciplina ${disciplinaSugerida}.`)
    }
  }

  // 5. Elementos sem pavimento associado
  const pctSemPavimento = totalElementos > 0 ? (elementosSemPavimento / totalElementos) * 100 : 0
  const aprovadoSemPav = pctSemPavimento < 50
  itensChecklist.push({
    regra: 'elementos_com_pavimento',
    descricao: 'Associação espacial dos elementos aos pavimentos',
    aprovado: aprovadoSemPav,
    detalhes: `${elementosSemPavimento} de ${totalElementos} elementos construtivos soltos sem vínculo espacial (${pctSemPavimento.toFixed(1)}%).`,
    bloqueante: false,
  })
  if (!aprovadoSemPav) {
    avisos.push(`Mais de 50% dos elementos do IFC estão sem associação a um pavimento específico.`)
  }

  const fim = performance.now()
  const tempoProcessamentoMs = Math.round(fim - inicio)
  const valido = bloqueios.length === 0

  return {
    valido,
    schema,
    unidadeMetrica,
    totalElementos,
    pavimentos,
    classes: classesCount,
    elementosSemPavimento,
    disciplinasDetectadas,
    itensChecklist,
    avisos,
    bloqueios,
    hashSha256,
    tamanhoBytes,
    tempoProcessamentoMs,
  }
}

/**
 * Converte o resultado do checklist no formato aceito pelo endpoint resumo-ifc
 */
export function extrairResumoIfcPayload(resultado: ChecklistIfcResultado): ResumoIfcContagem {
  return {
    classes: resultado.classes,
    contagens_por_classe: resultado.classes,
    pavimentos: resultado.pavimentos,
    disciplinas: resultado.disciplinasDetectadas,
    total_elementos: resultado.totalElementos,
    avisos_checklist: resultado.avisos,
    elementos_sem_pavimento: resultado.elementosSemPavimento,
    schema: resultado.schema,
    unidade_metrica: resultado.unidadeMetrica,
    tempo_processamento_ms: resultado.tempoProcessamentoMs,
  }
}
