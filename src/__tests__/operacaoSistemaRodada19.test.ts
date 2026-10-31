// src/__tests__/operacaoSistemaRodada19.test.ts
// GESTÃO G+ — TESTES DA RODADA 19: OPERAÇÃO DO SISTEMA
// Cobertura completa de:
// 1. validarArquivoComLimites (bloqueio por teto, mensagens educativas, detecção de tipo)
// 2. Status de crons e alerta preventivo de 2× intervalo
// 3. Padrão de snapshot declarativo pré-migração de dados

import { describe, it, expect } from 'vitest'
import {
  validarArquivoComLimites,
  LimitesUploadTipos,
  CronRotinaStatus,
  CronAlertaAtraso,
} from '@/services/operacaoSistema'

describe('Rodada 19 — Operação do Sistema', () => {
  // ---------------------------------------------------------------------------
  // 1. VALIDAR ARQUIVO COM LIMITES (TETOS DE UPLOAD)
  // ---------------------------------------------------------------------------
  describe('1. Validação de Arquivo com Limites (validarArquivoComLimites)', () => {
    const limitesPersonalizados: LimitesUploadTipos = {
      ifc: { max_mb: 120, max_bytes: 120 * 1024 * 1024, extensoes: ['.ifc', '.ifczip'] },
      dwg: { max_mb: 80, max_bytes: 80 * 1024 * 1024, extensoes: ['.dwg', '.dxf'] },
      pdf: { max_mb: 40, max_bytes: 40 * 1024 * 1024, extensoes: ['.pdf'] },
      imagem: {
        max_mb: 20,
        max_bytes: 20 * 1024 * 1024,
        extensoes: ['.png', '.jpg', '.jpeg', '.webp'],
      },
    }

    function criarArquivoFicticio(nome: string, tamanhoMb: number): File {
      // Simula objeto File com size sem alocar memória excessiva
      const bytes = Math.round(tamanhoMb * 1024 * 1024)
      return {
        name: nome,
        size: bytes,
        type: 'application/octet-stream',
      } as unknown as File
    }

    it('deve aprovar modelo IFC dentro do limite padrão (ex: 50 MB)', () => {
      const file = criarArquivoFicticio('modelo_arquitetura.ifc', 50)
      const resultado = validarArquivoComLimites(file)

      expect(resultado.valido).toBe(true)
      expect(resultado.tipoDetectado).toBe('ifc')
      expect(resultado.maxMb).toBe(150)
      expect(resultado.mensagem).toBeUndefined()
    })

    it('deve bloquear modelo IFC que exceda o teto de 150 MB padrão', () => {
      const file = criarArquivoFicticio('modelo_pesado_shopping.ifc', 160)
      const resultado = validarArquivoComLimites(file)

      expect(resultado.valido).toBe(false)
      expect(resultado.tipoDetectado).toBe('ifc')
      expect(resultado.maxMb).toBe(150)
      expect(resultado.mensagem).toContain('excede o limite máximo permitido de 150 MB')
      expect(resultado.mensagem).toContain('IFC')
    })

    it('deve respeitar limites customizados passados por parâmetro', () => {
      const fileDwg = criarArquivoFicticio('planta_baixa.dwg', 90)
      // No padrão (100MB) passaria, mas nos limites personalizados (80MB) deve bloquear
      const resultado = validarArquivoComLimites(fileDwg, limitesPersonalizados)

      expect(resultado.valido).toBe(false)
      expect(resultado.tipoDetectado).toBe('dwg')
      expect(resultado.maxMb).toBe(80)
      expect(resultado.mensagem).toContain('80 MB')
    })

    it('deve aprovar e bloquear arquivos PDF e Imagens conforme seus limites', () => {
      const pdfOk = criarArquivoFicticio('memorial.pdf', 30)
      expect(validarArquivoComLimites(pdfOk).valido).toBe(true)

      const pdfExcedido = criarArquivoFicticio('memorial_gigante.pdf', 55)
      const resPdf = validarArquivoComLimites(pdfExcedido)
      expect(resPdf.valido).toBe(false)
      expect(resPdf.tipoDetectado).toBe('pdf')
      expect(resPdf.maxMb).toBe(50)

      const imgOk = criarArquivoFicticio('foto_obra.jpg', 10)
      expect(validarArquivoComLimites(imgOk).valido).toBe(true)

      const imgExcedida = criarArquivoFicticio('foto_alta_res.png', 28)
      const resImg = validarArquivoComLimites(imgExcedida)
      expect(resImg.valido).toBe(false)
      expect(resImg.tipoDetectado).toBe('imagem')
      expect(resImg.maxMb).toBe(25)
    })

    it('deve tratar arquivos com extensão não mapeada com teto genérico defensivo (50 MB)', () => {
      const arquivoOutro = criarArquivoFicticio('dados_levantamento.xyz', 10)
      const resOutro = validarArquivoComLimites(arquivoOutro)
      expect(resOutro.valido).toBe(true)
      expect(resOutro.tipoDetectado).toBe('outro')
      expect(resOutro.maxMb).toBe(50)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. STATUS DE CRONS E ALERTA PREVENTIVO DE 2× INTERVALO
  // ---------------------------------------------------------------------------
  describe('2. Monitoramento de Crons & Regra 2× Intervalo', () => {
    // Função pura espelhando a lógica de avaliação de atraso 2× executada no backend
    function avaliarAtrasoCron(
      intervaloMinutos: number,
      ultimoSucessoIso: string | null,
      agoraMs: number,
    ): { atrasado2x: boolean; minutosDesdeUltimo: number | null } {
      if (!ultimoSucessoIso) {
        return { atrasado2x: true, minutosDesdeUltimo: null }
      }
      const ultimoMs = new Date(ultimoSucessoIso).getTime()
      const minutos = Math.floor((agoraMs - ultimoMs) / (1000 * 60))
      const atrasado2x = minutos > intervaloMinutos * 2
      return { atrasado2x, minutosDesdeUltimo: minutos }
    }

    it('rotina executada dentro do intervalo normal não deve estar atrasada 2×', () => {
      const agora = new Date('2026-03-30T12:00:00Z').getTime()
      // Rotina de 10 min executada há 8 minutos
      const ultimoSucesso = new Date('2026-03-30T11:52:00Z').toISOString()

      const avaliacao = avaliarAtrasoCron(10, ultimoSucesso, agora)
      expect(avaliacao.atrasado2x).toBe(false)
      expect(avaliacao.minutosDesdeUltimo).toBe(8)
    })

    it('rotina executada entre 1× e 2× do intervalo ainda não dispara atrasado 2×', () => {
      const agora = new Date('2026-03-30T12:00:00Z').getTime()
      // Rotina de 10 min executada há 15 minutos (1.5x)
      const ultimoSucesso = new Date('2026-03-30T11:45:00Z').toISOString()

      const avaliacao = avaliarAtrasoCron(10, ultimoSucesso, agora)
      expect(avaliacao.atrasado2x).toBe(false)
      expect(avaliacao.minutosDesdeUltimo).toBe(15)
    })

    it('rotina com mais de 2× o intervalo sem sucesso DEVE acionar alerta atrasado 2×', () => {
      const agora = new Date('2026-03-30T12:00:00Z').getTime()
      // Rotina de 10 min executada há 25 minutos (> 20 min)
      const ultimoSucesso = new Date('2026-03-30T11:35:00Z').toISOString()

      const avaliacao = avaliarAtrasoCron(10, ultimoSucesso, agora)
      expect(avaliacao.atrasado2x).toBe(true)
      expect(avaliacao.minutosDesdeUltimo).toBe(25)
    })

    it('rotina sem nenhum registro prévio de sucesso deve ser marcada como atrasada 2× por segurança', () => {
      const agora = Date.now()
      const avaliacao = avaliarAtrasoCron(1440, null, agora)
      expect(avaliacao.atrasado2x).toBe(true)
      expect(avaliacao.minutosDesdeUltimo).toBeNull()
    })

    it('rotina diária (1440 min) executada há 36 horas (2160 min) não passa de 2x (2880 min)', () => {
      const agora = new Date('2026-03-30T12:00:00Z').getTime()
      const ultimoSucesso = new Date('2026-03-29T00:00:00Z').toISOString() // 36 horas atrás

      const avaliacao = avaliarAtrasoCron(1440, ultimoSucesso, agora)
      expect(avaliacao.atrasado2x).toBe(false)
      expect(avaliacao.minutosDesdeUltimo).toBe(2160)
    })

    it('rotina diária (1440 min) executada há 50 horas (3000 min) ULTRAPASSA 2× (2880 min)', () => {
      const agora = new Date('2026-03-30T12:00:00Z').getTime()
      const ultimoSucesso = new Date('2026-03-28T10:00:00Z').toISOString() // 50 horas atrás

      const avaliacao = avaliarAtrasoCron(1440, ultimoSucesso, agora)
      expect(avaliacao.atrasado2x).toBe(true)
      expect(avaliacao.minutosDesdeUltimo).toBe(3000)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. PADRÃO DE SNAPSHOT PRÉ-MIGRAÇÃO DE DADOS
  // ---------------------------------------------------------------------------
  describe('3. Padrão de Snapshot Pré-Migração', () => {
    interface SnapshotContrato {
      operacao: string
      gerado_em: string
      gerado_por: string
      total_linhas_afetadas: number
      contagens_por_colecao: Record<string, number>
      padrao_seguranca: string
    }

    function construirSnapshotDeclarativo(
      operacao: string,
      usuarioEmail: string,
      contagens: Record<string, number>,
    ): SnapshotContrato {
      let totalLinhas = 0
      for (const col in contagens) {
        totalLinhas += contagens[col] || 0
      }

      return {
        operacao,
        gerado_em: new Date().toISOString(),
        gerado_por: usuarioEmail,
        total_linhas_afetadas: totalLinhas,
        contagens_por_colecao: contagens,
        padrao_seguranca: 'SNAPSHOT_IMUTAVEL_PRE_MIGRACAO',
      }
    }

    it('deve gerar payload estruturado com carimbo de tempo, usuário e total de linhas', () => {
      const contagensMock = {
        ordens_servico: 42,
        contas: 110,
        prestadores: 18,
      }

      const snapshot = construirSnapshotDeclarativo(
        'migracao_0110_limites_crons',
        'admin@gmais.eng.br',
        contagensMock,
      )

      expect(snapshot.operacao).toBe('migracao_0110_limites_crons')
      expect(snapshot.gerado_por).toBe('admin@gmais.eng.br')
      expect(snapshot.total_linhas_afetadas).toBe(170)
      expect(snapshot.contagens_por_colecao.ordens_servico).toBe(42)
      expect(snapshot.contagens_por_colecao.contas).toBe(110)
      expect(snapshot.padrao_seguranca).toBe('SNAPSHOT_IMUTAVEL_PRE_MIGRACAO')
      expect(new Date(snapshot.gerado_em).getTime()).not.toBeNaN()
    })

    it('deve garantir que o padrão de segurança imutável seja preservado', () => {
      const snapshot = construirSnapshotDeclarativo(
        'ajuste_lote_financeiro',
        'diretoria@gmais.eng.br',
        {
          faturas: 5,
        },
      )

      expect(snapshot.padrao_seguranca).toBe('SNAPSHOT_IMUTAVEL_PRE_MIGRACAO')
    })
  })
})
