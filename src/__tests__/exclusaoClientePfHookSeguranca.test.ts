// Teste de regressão — correção da exclusão de cliente PF (hook de MODELO vs hook de REQUISIÇÃO)
// Causa raiz: a checagem de Admin estava em onRecordDelete (hook de MODELO), onde não há
// contexto HTTP (requestInfo/auth) quando a exclusão vem de rota interna ($app.delete em
// /backend/v1/clientes-pf/{id}/excluir-ou-anonimizar). O try caía no catch, isAdmin ficava
// false e a exclusão legítima do Admin era bloqueada com
// "Apenas usuários com perfil Administrador podem excluir registros de clientes PF."
// Correção: checagem de Admin movida para onRecordDeleteRequest (hook de REQUISIÇÃO,
// onde e.auth existe); no hook de MODELO restou apenas a regra de negócio "não excluir
// se tiver propostas", que vale sempre (inclusive nas rotas internas).

import { describe, it, expect } from 'vitest'

// Lê o código-fonte REAL do hook (pocketbase/hooks/clientes_pf_operations.js) via raw import,
// para os testes auditarem o arquivo de verdade e não apenas um espelho.
import codigoHookReal from '../../pocketbase/hooks/clientes_pf_operations.js?raw'

describe('Exclusão de cliente PF — camadas de segurança do hook', () => {
  it('checagem de Admin fica no hook de REQUISIÇÃO (onRecordDeleteRequest), onde e.auth existe', () => {
    const inicioReq = codigoHookReal.indexOf('onRecordDeleteRequest')
    expect(inicioReq).toBeGreaterThan(-1)
    const fimReq = codigoHookReal.indexOf('onRecordDelete(', inicioReq)
    const trechoReq = codigoHookReal.slice(inicioReq, fimReq)

    // Deve usar e.auth diretamente (contexto HTTP confiável), não requestInfo()
    expect(trechoReq).toContain('e.auth')
    expect(trechoReq).not.toContain('requestInfo')
    // Deve barrar não-admin com a mensagem em português
    expect(trechoReq).toContain(
      'Apenas usuários com perfil Administrador podem excluir registros de clientes PF.',
    )
    expect(trechoReq).toContain('e.next()')
  })

  it('hook de MODELO (onRecordDelete) NÃO faz checagem de admin — só a regra de propostas', () => {
    const inicioModelo = codigoHookReal.lastIndexOf('onRecordDelete(')
    expect(inicioModelo).toBeGreaterThan(-1)
    const trechoModelo = codigoHookReal.slice(inicioModelo)

    // A armadilha: requestInfo/auth dentro do hook de modelo
    expect(trechoModelo).not.toContain('requestInfo')
    expect(trechoModelo).not.toContain('e.auth')
    expect(trechoModelo).not.toContain('isAdmin')
    // Mantém a regra de negócio (vale sempre, inclusive nas rotas internas)
    expect(trechoModelo).toContain('propostas')
    expect(trechoModelo).toContain('Anonimização LGPD')
    expect(trechoModelo).toContain('e.next()')
  })

  it('rota interna /excluir-ou-anonimizar continua validando Admin antes de chamar $app.delete', () => {
    const inicioRota = codigoHookReal.indexOf(
      "routerAdd('POST', '/backend/v1/clientes-pf/{id}/excluir-ou-anonimizar'",
    )
    expect(inicioRota).toBeGreaterThan(-1)
    const trechoRota = codigoHookReal.slice(
      inicioRota,
      codigoHookReal.indexOf('onRecordDeleteRequest'),
    )

    expect(trechoRota).toContain("role !== 'admin'")
    expect(trechoRota).toContain(
      'Apenas usuários com perfil Administrador podem excluir ou anonimizar clientes PF.',
    )
    expect(trechoRota).toContain('$app.delete(cliente)')
  })

  it('hook de MODELO não usa mais requestInfo().remoteIP (incompatível com PB v0.23)', () => {
    expect(codigoHookReal).not.toContain('reqInfo.remoteIP')
    expect(codigoHookReal).not.toContain('remoteIP ||')
  })

  it('hook de MODELO não chama requestInfo()/e.auth para DECIDIR permissão (padrão da auditoria do projeto)', () => {
    // Nos demais hooks de MODELO do projeto (audit_record_lifecycle.js, contratos_duplicidade.js)
    // requestInfo()/e.auth aparecem apenas para ENRIQUECER auditoria, dentro de try/catch,
    // com e.next() no finally — nunca para bloquear a operação. Este teste fixa esse padrão
    // para o arquivo corrigido: nenhum throw de permissão dentro de hooks de modelo.
    const trechoModelo = codigoHookReal.slice(codigoHookReal.lastIndexOf('onRecordDelete('))
    expect(trechoModelo).not.toContain("getString('role') === 'admin'")
    // O hook de modelo mantém o BadRequestError da regra de propostas (não de permissão):
    expect(trechoModelo).toContain('BadRequestError')
    expect(trechoModelo).toContain('propostas vinculadas')
  })
})
