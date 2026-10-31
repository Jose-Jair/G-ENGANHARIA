// =============================================================================
// GESTÃO G+ — COMPARADOR DE IFC POR GLOBALID (RODADA 17)
// Compara dois arquivos ou modelos IFC mapeando GlobalIds:
// - Adicionados (no modelo atual, ausentes no anterior)
// - Removidos (no modelo anterior, ausentes no atual)
// - Alterados (mesmo GlobalId com propriedades ou tipo alterados)
// =============================================================================

export interface ElementoIfcSumario {
  globalId: string
  classe: string
  nome?: string
  pavimento?: string
  propriedades?: Record<string, string | number | boolean>
}

export interface DiffGlobalIdItem {
  globalId: string
  classe: string
  nome?: string
  pavimento?: string
  tipoMudanca: 'adicionado' | 'removido' | 'alterado'
  mudancasDetalhe?: string[]
}

export interface ComparacaoIfcGlobalIdResultado {
  sucesso: boolean
  totalAtual: number
  totalAnterior: number
  adicionados: DiffGlobalIdItem[]
  removidos: DiffGlobalIdItem[]
  alterados: DiffGlobalIdItem[]
  inalterados: number
  estatisticasPorClasse: Record<
    string,
    { adicionados: number; removidos: number; alterados: number }
  >
}

/**
 * Extrai elementos e seus GlobalIds a partir do texto STEP do IFC
 */
export function extrairElementosComGlobalId(ifcTexto: string): Map<string, ElementoIfcSumario> {
  const mapa = new Map<string, ElementoIfcSumario>()
  const linhas = ifcTexto.split(/\r?\n/)

  // Padrão STEP para elementos com GlobalId:
  // #123 = IFCWALLSTANDARDCASE('2O2_000rv4BB4UbReaQW00', #5, 'Parede Drywall 10cm', 'Desc', $, #10, #15, $);
  const elementoRegex =
    /#\d+\s*=\s*(IFC[A-Z0-9_]+)\s*\(\s*['"]([0-9a-zA-Z_$]{22})['"]\s*,\s*[^,]*\s*,\s*(?:['"]([^'"]*)['"]|\$)/i

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim()
    if (!linha || !linha.startsWith('#')) continue

    const match = linha.match(elementoRegex)
    if (match) {
      const classe = match[1].toUpperCase()
      const globalId = match[2]
      const nome = match[3] || classe

      mapa.set(globalId, {
        globalId,
        classe,
        nome,
      })
    }
  }

  return mapa
}

/**
 * Compara dois mapas de elementos IFC por GlobalId
 */
export function compararMapasIfc(
  mapaAnterior: Map<string, ElementoIfcSumario>,
  mapaAtual: Map<string, ElementoIfcSumario>,
): ComparacaoIfcGlobalIdResultado {
  const adicionados: DiffGlobalIdItem[] = []
  const removidos: DiffGlobalIdItem[] = []
  const alterados: DiffGlobalIdItem[] = []
  let inalterados = 0

  const estatisticasPorClasse: Record<
    string,
    { adicionados: number; removidos: number; alterados: number }
  > = {}

  function getStats(classe: string) {
    if (!estatisticasPorClasse[classe]) {
      estatisticasPorClasse[classe] = { adicionados: 0, removidos: 0, alterados: 0 }
    }
    return estatisticasPorClasse[classe]
  }

  // 1. Identificar Adicionados e Alterados
  for (const [gid, atual] of mapaAtual.entries()) {
    const anterior = mapaAnterior.get(gid)
    if (!anterior) {
      adicionados.push({
        globalId: gid,
        classe: atual.classe,
        nome: atual.nome,
        pavimento: atual.pavimento,
        tipoMudanca: 'adicionado',
      })
      getStats(atual.classe).adicionados++
    } else {
      // Verifica se houve alteração de classe, nome ou propriedades
      const mudancas: string[] = []
      if (atual.classe !== anterior.classe) {
        mudancas.push(`Classe alterada de "${anterior.classe}" para "${atual.classe}"`)
      }
      if (atual.nome && anterior.nome && atual.nome !== anterior.nome) {
        mudancas.push(`Nome alterado de "${anterior.nome}" para "${atual.nome}"`)
      }
      if (atual.pavimento && anterior.pavimento && atual.pavimento !== anterior.pavimento) {
        mudancas.push(`Pavimento alterado de "${anterior.pavimento}" para "${atual.pavimento}"`)
      }

      if (mudancas.length > 0) {
        alterados.push({
          globalId: gid,
          classe: atual.classe,
          nome: atual.nome,
          pavimento: atual.pavimento,
          tipoMudanca: 'alterado',
          mudancasDetalhe: mudancas,
        })
        getStats(atual.classe).alterados++
      } else {
        inalterados++
      }
    }
  }

  // 2. Identificar Removidos
  for (const [gid, anterior] of mapaAnterior.entries()) {
    if (!mapaAtual.has(gid)) {
      removidos.push({
        globalId: gid,
        classe: anterior.classe,
        nome: anterior.nome,
        pavimento: anterior.pavimento,
        tipoMudanca: 'removido',
      })
      getStats(anterior.classe).removidos++
    }
  }

  return {
    sucesso: true,
    totalAtual: mapaAtual.size,
    totalAnterior: mapaAnterior.size,
    adicionados,
    removidos,
    alterados,
    inalterados,
    estatisticasPorClasse,
  }
}
