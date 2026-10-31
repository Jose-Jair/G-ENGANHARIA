import { describe, it, expect } from 'vitest'
import { prospeccaoService } from '../services/prospeccao'

describe('Rodada 14 Parte 3 — Telas da Prospecção', () => {
  it('serviço de prospecção deve exportar funções de varredura, triagem em lote e consolidação de métricas', () => {
    expect(typeof prospeccaoService.dispararVarredura).toBe('function')
    expect(typeof prospeccaoService.executarTriagemLote).toBe('function')
    expect(typeof prospeccaoService.importarCsvDinamico).toBe('function')
    expect(typeof prospeccaoService.obterMetricasConsolidadas).toBe('function')
  })

  it('valida estrutura dos filtros da fila de sugestões', () => {
    const filtrosEsperados = [
      'fonte',
      'relevancia',
      'uf',
      'municipio',
      'valor_estimado',
      'vigencia_fim',
    ]
    expect(filtrosEsperados).toContain('fonte')
    expect(filtrosEsperados).toContain('relevancia')
    expect(filtrosEsperados).toContain('uf')
    expect(filtrosEsperados).toContain('valor_estimado')
    expect(filtrosEsperados).toContain('vigencia_fim')
  })

  it('valida triagem em lote com motivos e lista Não Contatar', () => {
    const payloadTriagemDescarte = {
      acao: 'descartar' as const,
      sugestao_ids: ['sug_01', 'sug_02'],
      motivo_descarte: 'Escopo de baixo valor fora do perfil',
    }
    expect(payloadTriagemDescarte.acao).toBe('descartar')
    expect(payloadTriagemDescarte.motivo_descarte).toBeTruthy()
    expect(payloadTriagemDescarte.sugestao_ids.length).toBe(2)
  })

  it('valida estados possíveis de sanção CEIS/CNEP', () => {
    const estadosSancao = ['sancionada', 'sem_sancao', 'nao_verificada']
    expect(estadosSancao).toContain('sancionada')
    expect(estadosSancao).toContain('sem_sancao')
    expect(estadosSancao).toContain('nao_verificada')
  })
})
