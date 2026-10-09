import { describe, it, expect, beforeAll } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { medicoesService } from '@/services/medicoes'

describe('Módulo de Medições Progressivas (Regras de Servidor & Banco)', () => {
  beforeAll(async () => {
    // Autenticar como Admin
    await pb.collection('users').authWithPassword('admin@sistema.eng.br', 'Admin@123456')
  })

  it('deve validar criação, trava de saldo, aprovação gerando conta a pagar e reprovação com observações', async () => {
    // 1. Obter projeto e executor existentes
    const prj = await pb.collection('projetos').getFirstListItem('')
    const exec = await pb.collection('executores').getFirstListItem('')

    // 2. Criar subcontrato assinado fictício de teste com valor total R$ 10.000,00
    const subCol = pb.collection('subcontratos')
    const subTeste = await subCol.create({
      numero: 'SUB-TESTE-MED-01',
      projeto: prj.id,
      executor: exec.id,
      valor_total: 10000,
      status: 'assinado',
      modo_execucao: 'terceirizada_integral',
      parcelas_json: [],
    })

    try {
      // 3. Apresentar Medição 01 dentro do saldo: R$ 4.000,00 (Retenção: R$ 400, Líquido: R$ 3.600)
      const med1Res = await medicoesService.criar({
        subcontrato: subTeste.id,
        periodo_inicio: '2026-10-01',
        periodo_fim: '2026-10-15',
        percentual_executado: 40,
        valor_bruto: 4000,
        retencao_impostos: 400,
      })

      expect(med1Res.success).toBe(true)
      expect(med1Res.medicao.numero_medicao).toBe(1)
      expect(med1Res.medicao.valor_bruto).toBe(4000)
      expect(med1Res.medicao.retencao_impostos).toBe(400)
      expect(med1Res.medicao.valor_liquido).toBe(3600)
      expect(med1Res.medicao.numero).toMatch(/^MED-\d{4}-\d{4}$/)

      const med1Id = med1Res.medicao.id

      // 4. Testar Trava de Saldo no Servidor: tentar emitir medição de R$ 7.000 (4.000 + 7.000 = 11.000 > 10.000)
      let erroBloqueio = null
      try {
        await medicoesService.criar({
          subcontrato: subTeste.id,
          periodo_inicio: '2026-10-16',
          periodo_fim: '2026-10-31',
          percentual_executado: 70,
          valor_bruto: 7000,
          retencao_impostos: 0,
        })
      } catch (err: any) {
        erroBloqueio = err
      }

      expect(erroBloqueio).not.toBeNull()
      const msgErro = erroBloqueio?.data?.message || erroBloqueio?.message || ''
      expect(msgErro).toContain('BLOQUEIO')
      expect(msgErro).toContain('excede o valor total do subcontrato')

      // 5. Testar Aprovação da Medição 01 (Admin/Gestor)
      const aprovRes = await medicoesService.aprovar(med1Id)
      expect(aprovRes.success).toBe(true)
      expect(aprovRes.conta_pagar_id).toBeDefined()

      // Verificar no banco que a medição foi aprovada
      const med1Rec = await pb.collection('medicoes').getOne(med1Id)
      expect(med1Rec.status).toBe('aprovada')
      expect(med1Rec.data_aprovacao).toBeDefined()

      // Verificar que a conta a pagar foi gerada com medicao_aprovada_origem = med1Id
      const contas = await pb.collection('contas').getFullList({
        filter: `medicao_aprovada_origem = '${med1Id}'`,
      })
      expect(contas.length).toBe(1)
      const conta = contas[0]
      expect(conta.tipo).toBe('pagar')
      expect(conta.status).toBe('rascunho')
      expect(conta.valor).toBe(4000)
      expect(conta.retencao_impostos).toBe(400)
      expect(conta.valor_liquido).toBe(3600)
      expect(conta.subcontrato).toBe(subTeste.id)
      expect(conta.medicao_aprovada_origem).toBe(med1Id)

      // Testar Idempotência da Aprovação: aprovar novamente não duplica a conta
      const aprovIdempotente = await medicoesService.aprovar(med1Id)
      expect(aprovIdempotente.success).toBe(true)
      const contasAposReaprovacao = await pb.collection('contas').getFullList({
        filter: `medicao_aprovada_origem = '${med1Id}'`,
      })
      expect(contasAposReaprovacao.length).toBe(1)

      // 6. Testar Medição 02 com Reprovação
      const med2Res = await medicoesService.criar({
        subcontrato: subTeste.id,
        periodo_inicio: '2026-10-16',
        periodo_fim: '2026-10-31',
        percentual_executado: 30,
        valor_bruto: 3000,
        retencao_impostos: 300,
      })
      expect(med2Res.success).toBe(true)
      expect(med2Res.medicao.numero_medicao).toBe(2)
      const med2Id = med2Res.medicao.id

      // Reprovar sem justificativa deve falhar
      let errRepSemJust = null
      try {
        await medicoesService.reprovar(med2Id, '   ')
      } catch (err: any) {
        errRepSemJust = err
      }
      expect(errRepSemJust).not.toBeNull()

      // Reprovar com justificativa
      const repRes = await medicoesService.reprovar(
        med2Id,
        'Relatório fotográfico incompleto e prancha 03 sem carimbo do responsável técnico.',
      )
      expect(repRes.success).toBe(true)

      const med2Rec = await pb.collection('medicoes').getOne(med2Id)
      expect(med2Rec.status).toBe('reprovada')
      expect(med2Rec.observacoes_gestor).toContain('Relatório fotográfico incompleto')

      // 7. Testar que Executor NÃO consegue aprovar medição (403)
      await pb.collection('users').authWithPassword('executor@sistema.eng.br', 'Executor@123456')
      let errExecAprovar = null
      try {
        await medicoesService.aprovar(med1Id)
      } catch (err: any) {
        errExecAprovar = err
      }
      expect(errExecAprovar).not.toBeNull()
      expect(errExecAprovar.status).toBe(403)

      // Reconectar como admin para limpar os registros de teste
      await pb.collection('users').authWithPassword('admin@sistema.eng.br', 'Admin@123456')
      await pb.collection('contas').delete(conta.id)
      await pb.collection('medicoes').delete(med1Id)
      await pb.collection('medicoes').delete(med2Id)
    } finally {
      // Limpeza final do subcontrato de teste
      try {
        await pb.collection('subcontratos').delete(subTeste.id)
      } catch {
        /* intentionally ignored */
      }
    }
  })
})
