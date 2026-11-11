/**
 * Teste unitário — ordem de exclusão de cliente PF (dependentes antes do cliente).
 *
 * Cenário reproduzido: cliente PF em pré-cadastro SEM propostas, com
 * (a) 1 convite em clientes_pf_convites (cliente_pf = id) e
 * (b) 1 empresa espelho em empresas (cliente_pf_ref = id).
 *
 * O bug real: a rota /backend/v1/clientes-pf/{id}/excluir-ou-anonimizar chamava
 * $app.delete(cliente) direto; o PocketBase recusa apagar registro referenciado
 * por relação obrigatória (convites.cliente_pf) sem cascade → erro 400 e a lista
 * não recarregava. O hook agora apaga convites → espelho (e dependentes do
 * espelho) → cliente, dentro de $app.runInTransaction.
 *
 * Parte 1: verifica o código real do hook (ordem, transação, padrões do projeto).
 * Parte 2: simula um $app em memória que recusa delete de registro com dependentes
 * sem cascade, provando que a ordem correta remove todos e a ordem errada falha.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const hookPath = resolve(__dirname, '../../pocketbase/hooks/clientes_pf_operations.js')
const hookFonte = readFileSync(hookPath, 'utf-8')

// Extrai só o corpo do handler da rota de exclusão/anonimização
const inicioRota = hookFonte.indexOf('clientes-pf/')
const fimRota = hookFonte.indexOf('excluir-ou-anonimizar')

describe('Hook de exclusão de cliente PF — rota excluir-ou-anonimizar', () => {
  it('apaga dependentes ANTES do cliente, dentro de UMA transação', () => {
    // Transação obrigatória
    expect(hookFonte.includes('runInTransaction')).toBe(true)

    const trechoRota = hookFonte.slice(
      hookFonte.indexOf('/{id}/excluir-ou-anonimizar'),
      hookFonte.length,
    )
    const fimHandler = trechoRota.indexOf('EXCLUSAO_CLIENTE_PF') // auditoria está no fim do sucesso
    expect(fimHandler).toBeGreaterThan(0)
    const corpo = trechoRota.slice(0, fimHandler + 40)

    // Ordem textual: convites antes do espelho, espelho antes do cliente
    const idxConvites = corpo.indexOf("findRecordsByFilter('clientes_pf_convites'")
    const idxEspelho = corpo.indexOf("findRecordsByFilter('empresas'")
    const idxCliente = corpo.indexOf('$app.delete(cliente)')
    expect(idxConvites).toBeGreaterThan(0)
    expect(idxEspelho).toBeGreaterThan(idxConvites)
    expect(idxCliente).toBeGreaterThan(idxEspelho)

    // Espelho apagado só quando a empresa é espelho do próprio cliente (tipo pf)
    expect(corpo.includes("getString('tipo_cliente')")).toBe(true)
    expect(corpo.includes("getString('cliente_pf_ref')")).toBe(true)
  })

  it('não usa requestInfo().remoteIP (padrão PB v0.23)', () => {
    expect(hookFonte.includes('.remoteIP')).toBe(false)
    expect(hookFonte.includes('x-forwarded-for')).toBe(true)
  })

  it('grava auditoria EXCLUSAO_CLIENTE_PF com o que saiu (convites, espelho, notificações, cliente)', () => {
    expect(hookFonte.includes("aRec.set('acao', 'EXCLUSAO_CLIENTE_PF')")).toBe(true)
    expect(hookFonte.includes('registros_removidos: removidos')).toBe(true)
    expect(hookFonte.includes('clientes_pf_convites: []')).toBe(true)
    expect(hookFonte.includes('empresas_espelho: []')).toBe(true)
    expect(hookFonte.includes('notificacoes: []')).toBe(true)
    expect(hookFonte.includes('clientes_pf: [clienteId]')).toBe(true)
    // campo registro_id aponta para o cliente
    expect(hookFonte.includes("aRec.set('registro_id', clienteId)")).toBe(true)
  })

  it('responde erro com message real em português e registra em erros_sistema', () => {
    expect(hookFonte.includes("findCollectionByNameOrId('erros_sistema')")).toBe(true)
    expect(hookFonte.includes('message: mensagem')).toBe(true)
    expect(hookFonte.includes('Ocorreu um erro inesperado no servidor.')).toBe(true)
    // Nunca responde "Something went wrong"
    expect(hookFonte.includes('Something went wrong')).toBe(false)
  })

  it('validação de negócio (espelho com propostas) responde 400 com a mensagem real', () => {
    expect(hookFonte.includes('const statusResposta = erroValidacaoMsg ? 400 : 500')).toBe(true)
    expect(hookFonte.includes('A empresa espelho deste cliente possui propostas vinculadas')).toBe(
      true,
    )
  })
})

describe('Simulação da ordem de exclusão (dependentes antes do cliente)', () => {
  // Mini $app em memória: recusa delete de registro que ainda é referenciado
  // por relação obrigatória de outro registro vivo (sem cascade) — igual PocketBase.
  type Rec = { id: string; col: string }
  function criarAppSimulado() {
    const vivos = new Map<string, Rec>()
    const ordemExclusao: string[] = []
    const adicionar = (r: Rec) => vivos.set(r.id, r)

    // Relações obrigatórias (sem cascade) — clientes_pf_convites.cliente_pf é a que gerou o bug
    const dependenciasObrigatorias: Array<{ col: string; campo: string; alvo: string }> = []

    const app = {
      // registra dependência: um registro de colOrigem.campo aponta para alvo (obrigatório)
      registrarDependencia(colOrigem: string, campo: string, alvo: string) {
        dependenciasObrigatorias.push({ col: colOrigem, campo, alvo })
      },
      delete(rec: Rec) {
        // recusa se algum registro vivo referenciar este (relação obrigatória sem cascade)
        for (const dep of dependenciasObrigatorias) {
          if (dep.alvo === rec.id && vivos.has(rec.id)) {
            // só bloqueia se o DEPENDENTE ainda está vivo
            const dependenteVivo = [...vivos.values()].some(
              (v) => v.col === dep.col && vivos.has(v.id),
            )
            void dep.campo
            if (dependenteVivo) {
              throw new Error(
                `SQLSTATE[23000]: Integrity constraint violation: cannot delete '${rec.col}' referenced by '${dep.col}'`,
              )
            }
          }
        }
        vivos.delete(rec.id)
        ordemExclusao.push(`${rec.col}:${rec.id}`)
      },
      ordem: ordemExclusao,
      vivos,
    }
    return app
  }

  it('com convite + espelho, a ordem convites → espelho → cliente apaga todos', () => {
    const app = criarAppSimulado()
    const cliente = { id: 'ue5fvb4q47gxbgk', col: 'clientes_pf' }
    const convite = { id: 'nwmwim2os0gs23t', col: 'clientes_pf_convites' }
    const espelho = { id: 'lp985l7eio9x3d4', col: 'empresas' }

    adicionar(cliente)
    adicionar(convite)
    adicionar(espelho)
    app.registrarDependencia('clientes_pf_convites', 'cliente_pf', cliente.id)

    // Ordem correta (a do hook, dentro de runInTransaction)
    app.delete(convite)
    app.delete(espelho)
    app.delete(cliente)

    expect(app.ordem).toEqual([
      'clientes_pf_convites:nwmwim2os0gs23t',
      'empresas:lp985l7eio9x3d4',
      'clientes_pf:ue5fvb4q47gxbgk',
    ])
    expect(app.vivos.size).toBe(0)
  })

  it('apagar o cliente ANTES do convite falha (reproduz o bug original)', () => {
    const app = criarAppSimulado()
    const cliente = { id: 'ue5fvb4q47gxbgk', col: 'clientes_pf' }
    const convite = { id: 'nwmwim2os0gs23t', col: 'clientes_pf_convites' }
    const espelho = { id: 'lp985l7eio9x3d4', col: 'empresas' }

    adicionar(cliente)
    adicionar(convite)
    adicionar(espelho)
    app.registrarDependencia('clientes_pf_convites', 'cliente_pf', cliente.id)

    expect(() => app.delete(cliente)).toThrowError(/Integrity constraint violation/)
    // cliente continua na lista
    expect(app.vivos.has('ue5fvb4q47gxbgk')).toBe(true)
  })
})
