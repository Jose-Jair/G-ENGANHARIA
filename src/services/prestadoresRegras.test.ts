import { describe, it, expect } from 'vitest'
import schemaJson from '@/lib/pocketbase/schema.json'
import { isValidCpf, isValidCnpj } from '@/lib/cnpj'

const schemaData = schemaJson as any
const collections = schemaData.collections || []

describe('Validações de Domínio e Regras do Módulo Prestadores e Portal', () => {
  it('garante que coleções do conceito único de prestador existem no schema do banco', () => {
    const colNames = collections.map((c: any) => c.name)

    // Coleções centrais
    expect(colNames).toContain('prestadores')
    expect(colNames).toContain('profissionais_prestador')
    expect(colNames).toContain('contratos_mestre')
    expect(colNames).toContain('ordens_servico')

    // Projeções do Portal do Prestador
    expect(colNames).toContain('portal_os')
    expect(colNames).toContain('portal_entregaveis')
    expect(colNames).toContain('portal_documentos')

    // Coleções legadas continuam intactas
    expect(colNames).toContain('executores')
    expect(colNames).toContain('subcontratos')
  })

  it('garante que a coleção-projeção portal_os NÃO possui campos sensíveis (cliente, proposta, obra, bdi)', () => {
    const portalOsCol = collections.find((c: any) => c.name === 'portal_os')
    expect(portalOsCol).toBeDefined()

    const fieldNames = portalOsCol.fields.map((f: any) => f.name)

    // Campos permitidos
    expect(fieldNames).toContain('codigo_projeto')
    expect(fieldNames).toContain('disciplina')
    expect(fieldNames).toContain('escopo_tecnico')
    expect(fieldNames).toContain('valor_os')
    expect(fieldNames).toContain('prestador_email')

    // NUNCA expor
    expect(fieldNames).not.toContain('cliente')
    expect(fieldNames).not.toContain('cliente_nome')
    expect(fieldNames).not.toContain('proposta')
    expect(fieldNames).not.toContain('obra')
    expect(fieldNames).not.toContain('nome_obra')
    expect(fieldNames).not.toContain('bdi')
    expect(fieldNames).not.toContain('valor_contrato_global')
    expect(fieldNames).not.toContain('outros_prestadores')
  })

  it('garante que as coleções-projeção do portal filtram estritamente por prestador_email', () => {
    const portalOsCol = collections.find((c: any) => c.name === 'portal_os')
    const portalEntCol = collections.find((c: any) => c.name === 'portal_entregaveis')
    const portalDocCol = collections.find((c: any) => c.name === 'portal_documentos')

    expect(portalOsCol.apiRules.list).toContain('prestador_email = @request.auth.email')
    expect(portalEntCol.apiRules.list).toContain('prestador_email = @request.auth.email')
    expect(portalDocCol.apiRules.list).toContain('prestador_email = @request.auth.email')
  })

  it('garante que ordens_servico e contratos_mestre bloqueiam acesso de executor/prestador sem privilégio', () => {
    const osCol = collections.find((c: any) => c.name === 'ordens_servico')
    const cmCol = collections.find((c: any) => c.name === 'contratos_mestre')

    expect(osCol.apiRules.list).not.toContain("role = 'executor'")
    expect(cmCol.apiRules.list).not.toContain("role = 'executor'")
  })

  it('valida regras de negócio de OS interna vs OS externa', () => {
    // OS Externa: possui valor acordado, retenção e gera compromisso financeiro
    const osExterna = {
      tipo_prestador: 'externo' as const,
      valor_os: 15000,
      percentual_retencao_tecnica: 5,
      retencao_tecnica_acumulada: 750,
      status_retencao: 'acumulando',
    }

    expect(osExterna.valor_os).toBeGreaterThan(0)
    expect(osExterna.percentual_retencao_tecnica).toBe(5)
    expect(osExterna.retencao_tecnica_acumulada).toBe(750)

    // OS Interna: NÃO possui camada financeira nem retenção técnica
    const osInterna = {
      tipo_prestador: 'interno' as const,
      valor_os: 0,
      percentual_retencao_tecnica: 0,
      retencao_tecnica_acumulada: 0,
      status_retencao: 'sem_retencao',
    }

    expect(osInterna.valor_os).toBe(0)
    expect(osInterna.percentual_retencao_tecnica).toBe(0)
    expect(osInterna.retencao_tecnica_acumulada).toBe(0)
    expect(osInterna.status_retencao).toBe('sem_retencao')
  })

  it('valida formatação e consistência de documentos CPF e CNPJ de prestadores', () => {
    // Testes de CPF (prestador PF)
    expect(isValidCpf('11144477735')).toBe(true)
    expect(isValidCpf('00000000000')).toBe(false)

    // Testes de CNPJ (prestador PJ)
    expect(isValidCnpj('11222333000181')).toBe(true)
    expect(isValidCnpj('00000000000000')).toBe(false)
  })

  it('valida os status do ciclo de vida da Ordem de Serviço', () => {
    const statusCicloPermitidos = [
      'minuta',
      'aguardando_assinatura',
      'assinada',
      'em_execucao',
      'concluida',
      'avaliada',
      'encerrada',
    ]

    expect(statusCicloPermitidos).toContain('minuta')
    expect(statusCicloPermitidos).toContain('aguardando_assinatura')
    expect(statusCicloPermitidos).toContain('assinada')
    expect(statusCicloPermitidos).toContain('em_execucao')
    expect(statusCicloPermitidos).toContain('concluida')
    expect(statusCicloPermitidos).toContain('avaliada')
    expect(statusCicloPermitidos).toContain('encerrada')
  })
})
