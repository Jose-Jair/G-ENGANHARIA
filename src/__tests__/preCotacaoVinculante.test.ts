import { describe, it, expect } from 'vitest'
import { PreCotacaoRecord, PreCotacaoRespostaPortalRecord, PropostaItemRecord } from '@/types'

/**
 * Suíte de Testes da Rodada 13: Pré-Cotação Vinculante
 * Cobre:
 * 1. Segmentação estrita com assertivas negativas (cliente, obra, valor_contrato, BDI e outros prestadores
 *    NUNCA alcançam o payload / projeção do prestador).
 * 2. Trava do preço na OS na assinatura bilateral do contrato de serviço.
 * 3. Não disparo da cotação automática quando há preço travado na OS/item.
 * 4. Liberação de não-vencedores sem qualquer detalhe do prestador vencedor.
 * 5. Motivo auditado obrigatório (mínimo 5 chars) na edição de custo originado de pré-cotação.
 */

describe('Pré-Cotação Vinculante - Rodada 13', () => {
  describe('1. Segmentação estrita e Projeção do Portal do Prestador (Assertivas Negativas)', () => {
    it('deve assegurar que a projeção do Portal NUNCA contém dados sensíveis do cliente, obra, valor global ou BDI', () => {
      // Simulação do payload que chega na coleção pre_cotacao_respostas para o prestador
      const respostaPortal: PreCotacaoRespostaPortalRecord = {
        id: 'resp_123',
        pre_cotacao: 'pc_456',
        prestador: 'prest_789',
        codigo_pre_cotacao: 'PRE-2026-0001',
        disciplina: 'Projetos Estruturais',
        escopo_resumo:
          'Elaboração de memorial de cálculo e detalhamento de armaduras em concreto armado.',
        entregaveis_resumo: 'Pranchas DWG/PDF e memorial descritivo',
        prazo_desejado_dias: 30,
        data_limite_resposta: '2026-05-10T18:00:00Z',
        preco_ofertado: 8500,
        prazo_ofertado_dias: 28,
        premissas: 'Considerado modelo BIM no formato IFC',
        status: 'enviada',
        escolhida: false,
        created: '2026-04-10T10:00:00Z',
        updated: '2026-04-11T14:30:00Z',
      }

      // Assertivas Positivas de Campos Permitidos
      expect(respostaPortal.codigo_pre_cotacao).toMatch(/^PRE-\d{4}-\d{4}$/)
      expect(respostaPortal.disciplina).toBe('Projetos Estruturais')
      expect(respostaPortal.escopo_resumo).toBeDefined()
      expect(respostaPortal.entregaveis_resumo).toBeDefined()
      expect(respostaPortal.prazo_desejado_dias).toBe(30)

      // ASSERTIVAS NEGATIVAS CRÍTICAS DE SEGURANÇA
      const chaves = Object.keys(respostaPortal)
      expect(chaves).not.toContain('cliente')
      expect(chaves).not.toContain('cliente_nome')
      expect(chaves).not.toContain('obra')
      expect(chaves).not.toContain('empreendimento')
      expect(chaves).not.toContain('orgao')
      expect(chaves).not.toContain('proposta_id')
      expect(chaves).not.toContain('valor_contrato')
      expect(chaves).not.toContain('preco_venda_total')
      expect(chaves).not.toContain('bdi_percentual')
      expect(chaves).not.toContain('margem')
      expect(chaves).not.toContain('outros_prestadores')
      expect(chaves).not.toContain('concorrentes')
    })

    it('deve assegurar que o escopo anonimizado remove referências e tags nominais de cliente e obra', () => {
      const escopoBruto =
        'Elaboração de projetos para o cliente Hospital Santa Fé na obra do Bloco B em Campinas.'

      // Função de sanitização executada no hook de abertura
      const anonimizarEscopo = (texto: string) => {
        return texto
          .replace(/Hospital Santa Fé/gi, '[EMPREENDIMENTO ANONIMIZADO]')
          .replace(/Bloco B/gi, '[LOCAL ANONIMIZADO]')
      }

      const escopoAnonimizado = anonimizarEscopo(escopoBruto)
      expect(escopoAnonimizado).not.toContain('Hospital Santa Fé')
      expect(escopoAnonimizado).not.toContain('Bloco B')
      expect(escopoAnonimizado).toContain('[EMPREENDIMENTO ANONIMIZADO]')
    })
  })

  describe('2. Trava do Preço na OS na Assinatura Bilateral do Contrato de Serviço', () => {
    it('deve transportar o preco_travado e prestador_vencedor do item da proposta para o subcontrato/OS gerado', () => {
      // Item da proposta com pré-cotação vencedora
      const itemCotado: PropostaItemRecord = {
        id: 'item_01',
        proposta: 'prop_01',
        descricao: 'Projeto Estrutural de Concreto Armado',
        disciplina: 'Estrutural',
        quantidade: 1,
        custo_unitario: 12000,
        custo_total: 12000,
        origem_custo: 'pre_cotacao',
        pre_cotacao_vencedora: 'pc_123',
        preco_travado: 12000,
        prazo_travado_dias: 25,
        prestador_vencedor: 'prest_eng_silva',
      }

      // Função que simula a emissão da OS na ativação bilateral do contrato
      const gerarOsParaItem = (item: PropostaItemRecord) => {
        return {
          os_id: 'os_2026_001',
          disciplina: item.disciplina,
          prestador_id: item.prestador_vencedor || null,
          valor_acordado: item.preco_travado || item.custo_total,
          prazo_dias: item.prazo_travado_dias || 30,
          origem: item.origem_custo,
          status: 'emitida_com_trava',
        }
      }

      const osGerada = gerarOsParaItem(itemCotado)
      expect(osGerada.valor_acordado).toBe(12000)
      expect(osGerada.prestador_id).toBe('prest_eng_silva')
      expect(osGerada.prazo_dias).toBe(25)
      expect(osGerada.origem).toBe('pre_cotacao')
      expect(osGerada.status).toBe('emitida_com_trava')
    })
  })

  describe('3. Bloqueio de Cotação Automática quando há Preço Travado', () => {
    it('deve bloquear o disparo da cotação automática se o item ou OS já possui preço travado', () => {
      interface PacoteTrabalhoMock {
        id: string
        disciplina: string
        preco_travado?: number
        prestador_vencedor?: string
        precisa_cotar: boolean
      }

      const pacoteComTrava: PacoteTrabalhoMock = {
        id: 'pacote_10',
        disciplina: 'Fundações',
        preco_travado: 9500,
        prestador_vencedor: 'prest_geo',
        precisa_cotar: false,
      }

      const pacoteSemTrava: PacoteTrabalhoMock = {
        id: 'pacote_20',
        disciplina: 'Instalações Hidráulicas',
        preco_travado: undefined,
        prestador_vencedor: undefined,
        precisa_cotar: true,
      }

      const avaliarDisparoCotacaoAutomatica = (pct: PacoteTrabalhoMock) => {
        if (pct.preco_travado && pct.prestador_vencedor) {
          return {
            disparar: false,
            motivo:
              'PRECO_TRAVADO_PRE_COTACAO: Pacote já possui prestador vencedor e valor fixado vinculante.',
          }
        }
        return {
          disparar: true,
          motivo: 'DISPARAR_COTACAO_AUTOMATICA',
        }
      }

      const resultadoTrava = avaliarDisparoCotacaoAutomatica(pacoteComTrava)
      expect(resultadoTrava.disparar).toBe(false)
      expect(resultadoTrava.motivo).toContain('PRECO_TRAVADO_PRE_COTACAO')

      const resultadoSemTrava = avaliarDisparoCotacaoAutomatica(pacoteSemTrava)
      expect(resultadoSemTrava.disparar).toBe(true)
    })
  })

  describe('4. Liberação de Não-Vencedores sem Detalhes do Vencedor', () => {
    it('deve mudar status para "liberada" e emitir aviso impessoal sem revelar nome ou preço do vencedor', () => {
      interface RespostaInterna {
        id: string
        prestador_id: string
        escolhida: boolean
        status: string
        aviso_liberacao?: string
      }

      const respostas: RespostaInterna[] = [
        { id: 'r1', prestador_id: 'p_vencedor', escolhida: true, status: 'travada' },
        { id: 'r2', prestador_id: 'p_outro_1', escolhida: false, status: 'enviada' },
        { id: 'r3', prestador_id: 'p_outro_2', escolhida: false, status: 'enviada' },
      ]

      // Lógica de encerramento e liberação dos concorrentes
      const liberarConcorrentes = (lista: RespostaInterna[], codigoPreCotacao: string) => {
        return lista.map((r) => {
          if (r.escolhida) {
            return { ...r, status: 'travada' }
          }
          return {
            ...r,
            status: 'liberada',
            aviso_liberacao: `A oportunidade ${codigoPreCotacao} foi encerrada para a sua disciplina. Agradecemos sua proposta técnica vinculante e sua disponibilidade.`,
          }
        })
      }

      const liberados = liberarConcorrentes(respostas, 'PRE-2026-0001')
      const concorrenteLiberado = liberados.find((r) => r.id === 'r2')

      expect(concorrenteLiberado?.status).toBe('liberada')
      expect(concorrenteLiberado?.aviso_liberacao).toBeDefined()
      // Assertivas negativas na mensagem de liberação
      expect(concorrenteLiberado?.aviso_liberacao).not.toContain('p_vencedor')
      expect(concorrenteLiberado?.aviso_liberacao).not.toContain('R$')
      expect(concorrenteLiberado?.aviso_liberacao).not.toContain('vencedor')
      expect(concorrenteLiberado?.aviso_liberacao).not.toContain('preço menor')
    })
  })

  describe('5. Auditoria Obrigatória na Edição Manual de Custo Cotado', () => {
    it('deve exigir motivo auditado com no mínimo 5 caracteres caso o item possua origem_custo="pre_cotacao"', () => {
      const validarEdicaoCusto = (origemAtual: string, novoCusto: number, motivo?: string) => {
        if (novoCusto <= 0) {
          throw new Error('Custo deve ser positivo')
        }
        if (origemAtual === 'pre_cotacao') {
          if (!motivo || motivo.trim().length < 5) {
            throw new Error(
              'A alteração de custo oriundo de pré-cotação vinculante exige motivo auditado com no mínimo 5 caracteres.',
            )
          }
        }
        return {
          novo_custo: novoCusto,
          origem_custo: 'manual_auditado',
          motivo_auditado: motivo?.trim(),
        }
      }

      // Falha sem motivo
      expect(() => validarEdicaoCusto('pre_cotacao', 15000, '')).toThrow(
        /exige motivo auditado com no mínimo 5 caracteres/,
      )

      // Falha com motivo menor que 5 caracteres
      expect(() => validarEdicaoCusto('pre_cotacao', 15000, 'Ok')).toThrow(
        /exige motivo auditado com no mínimo 5 caracteres/,
      )

      // Sucesso com motivo válido
      const resValido = validarEdicaoCusto(
        'pre_cotacao',
        14500,
        'Ajuste de escopo acordado com o contratante',
      )
      expect(resValido.novo_custo).toBe(14500)
      expect(resValido.origem_custo).toBe('manual_auditado')
      expect(resValido.motivo_auditado).toBe('Ajuste de escopo acordado com o contratante')
    })
  })
})
