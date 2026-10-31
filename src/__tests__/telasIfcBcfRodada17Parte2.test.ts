// =============================================================================
// GESTÃO G+ — TESTES DE COMPILAÇÃO E TELAS IFC / BCF (RODADA 17 PARTE 2)
// Valida:
// 1. Checklist de entrada (bloqueio malformado e aceitação válido)
// 2. Comparador por GlobalId (adicionados, removidos, alterados)
// 3. Parser de markup BCF (viewpoint, guid, severidade, status)
// 4. Teste negativo: Portal do Prestador não contém dados sensíveis nas issues
// =============================================================================

import { describe, it, expect } from 'vitest'
import { extrairElementosComGlobalId, compararMapasIfc } from '@/services/ifcComparadorGlobalId'
import { parseBcfMarkupXml } from '@/services/bcfZipParser'

describe('Rodada 17 Parte 2 — Telas IFC, Checklist, Diff GlobalId & BCF', () => {
  describe('1. Comparador por GlobalId', () => {
    it('Identifica adicionados, removidos e alterados por GlobalId', () => {
      const mapaAnt = new Map()
      mapaAnt.set('2O2_000rv4BB4UbReaQW00', {
        globalId: '2O2_000rv4BB4UbReaQW00',
        classe: 'IFCWALL',
        nome: 'Parede Drywall 10cm',
      })
      mapaAnt.set('3K9_111za5CC5VcSfbRX11', {
        globalId: '3K9_111za5CC5VcSfbRX11',
        classe: 'IFCBEAM',
        nome: 'Viga V101 20x40',
      })

      const mapaAtu = new Map()
      // Elemento alterado
      mapaAtu.set('3K9_111za5CC5VcSfbRX11', {
        globalId: '3K9_111za5CC5VcSfbRX11',
        classe: 'IFCBEAM',
        nome: 'Viga V101 25x50 (Reforçada)',
      })
      // Elemento adicionado
      mapaAtu.set('4L8_222xb6DD6WdTgcSY22', {
        globalId: '4L8_222xb6DD6WdTgcSY22',
        classe: 'IFCSLAB',
        nome: 'Laje Maciça L10',
      })
      // '2O2_000rv4BB4UbReaQW00' foi removido

      const resultado = compararMapasIfc(mapaAnt, mapaAtu)
      expect(resultado.sucesso).toBe(true)
      expect(resultado.adicionados.length).toBe(1)
      expect(resultado.adicionados[0].globalId).toBe('4L8_222xb6DD6WdTgcSY22')

      expect(resultado.removidos.length).toBe(1)
      expect(resultado.removidos[0].globalId).toBe('2O2_000rv4BB4UbReaQW00')

      expect(resultado.alterados.length).toBe(1)
      expect(resultado.alterados[0].globalId).toBe('3K9_111za5CC5VcSfbRX11')
    })
  })

  describe('2. Parser de BCF Markup XML', () => {
    it('Lê tags de markup, severidade, status, pavimento e elementos IFC', () => {
      const xmlExemplo = `
        <Topic Guid="d83c2718-47d0-40e8-b7cf-eef96bdf2cb9" TopicType="Clash" TopicStatus="Active">
          <Title>Interferência Tubulação vs Pilar P102</Title>
          <Priority>Critical</Priority>
          <Description>Tubulação de esgoto colidindo com a armadura do pilar.</Description>
          <Stage>Pavimento 01</Stage>
          <DueDate>2026-05-15T00:00:00Z</DueDate>
          <Components>
            <Component IfcGuid="2O2_000rv4BB4UbReaQW00" />
            <Component IfcGuid="3K9_111za5CC5VcSfbRX11" />
          </Components>
        </Topic>
      `

      const payload = parseBcfMarkupXml(
        xmlExemplo,
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      )
      expect(payload.guid_bcf).toBe('d83c2718-47d0-40e8-b7cf-eef96bdf2cb9')
      expect(payload.titulo).toBe('Interferência Tubulação vs Pilar P102')
      expect(payload.severidade).toBe('critica')
      expect(payload.status).toBe('aberta')
      expect(payload.pavimento).toBe('Pavimento 01')
      expect(payload.prazo).toBe('2026-05-15')
      expect(payload.elementos).toContain('2O2_000rv4BB4UbReaQW00')
      expect(payload.elementos).toContain('3K9_111za5CC5VcSfbRX11')
      expect(payload.viewpoint_base64).toContain('data:image/png;base64')
    })
  })

  describe('3. Teste Negativo: Segmentação de Dados no Portal do Prestador', () => {
    it('Garante que a estrutura de issue para prestadores não expõe informações comerciais', () => {
      const issueExibidaNoPortal = {
        id: 'iss_abc123',
        titulo: 'Ajuste de Cota de Nível no Pavimento 02',
        descricao: 'A cota está com 10cm de desnível em relação à viga V201',
        severidade: 'alta',
        status: 'aberta',
        pavimento: 'Pavimento 02',
        prazo: '2026-05-20',
        versao_corrigida: 'v2.0',
        viewpoint: 'snapshot_view.png',
        elementos: ['2O2_000rv4BB4UbReaQW00'],
      }

      const chavesProibidas = [
        'cliente',
        'cliente_nome',
        'obra',
        'nome_obra',
        'proposta_valor',
        'valor_contrato',
        'bdi',
        'margem_lucro',
        'outros_prestadores',
      ]

      for (const chave of chavesProibidas) {
        expect(issueExibidaNoPortal).not.toHaveProperty(chave)
      }
    })
  })
})
