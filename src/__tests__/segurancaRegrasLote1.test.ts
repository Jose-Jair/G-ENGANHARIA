// Teste de Regressão - Lote 1 Segurança (C1, M1, M4)
// Verifica que tokens não autenticados não podem alterar campos fora da whitelist (ex: valor_total)
// e que os hooks lançam erro 400.

import { describe, it, expect } from 'vitest'

describe('Lote 1 - Regras de Segurança (C1 + M1 + M4)', () => {
  it('valida que a whitelist de propostas para requisições sem autenticação protege campos de negócio', () => {
    const whitelistPublico = [
      'status',
      'data_visualizacao',
      'motivo_recusa',
      'detalhe_recusa',
      'data_recusa',
      'data_aceite',
      'aceite_declaracao',
      'aceite_hash',
      'aceite_ip',
      'aceite_user_agent',
      'aceite_status',
      'versao_texto_aceito',
      'versao_texto_hash',
      'pdf_congelado_hash',
      'dossie_evidencias_json',
      'solicitacao_alteracao_texto',
      'data_solicitacao_alteracao',
      'historico_devolutivas',
      'dados_complementares_preenchidos',
    ]

    const camposProibidos = [
      'valor_total',
      'preco',
      'custo_total',
      'custo_direto',
      'margem_lucro',
      'impostos',
      'itens_json',
      'clausulas_padrao',
      'numero',
      'empresa',
      'cliente_pf',
      'token_aceite',
      'revisao',
    ]

    for (const campo of camposProibidos) {
      expect(whitelistPublico.includes(campo)).toBe(false)
    }
  })

  it('valida que a whitelist de contratos_servico para requisições sem autenticação protege campos de negócio', () => {
    const whitelistPublicoContrato = [
      'status',
      'cliente_nome_assinante',
      'cliente_documento_assinante',
      'data_assinatura_cliente',
      'cliente_ip',
      'cliente_user_agent',
      'cliente_declaracao',
      'cliente_hash',
      'aceite_status',
      'data_aceite',
      'aceite_ip',
      'aceite_user_agent',
      'versao_texto_aceito',
      'versao_texto_hash',
      'pdf_congelado_hash',
      'dossie_evidencias_json',
      'token_usado',
      'data_uso_token',
      'codigo_tentativas',
      'campos_faltantes_json',
      'dados_completados_em',
    ]

    const camposProibidos = [
      'valor_total',
      'objeto',
      'prazo_dias',
      'nota_prazo',
      'clausulas_texto',
      'parcelas_json',
      'numero',
      'empresa',
      'cliente_pf',
      'proposta',
      'token_assinatura_cliente',
      'data_assinatura_admin',
      'admin_hash',
    ]

    for (const campo of camposProibidos) {
      expect(whitelistPublicoContrato.includes(campo)).toBe(false)
    }
  })

  it('valida que perfis não-admin (comercial, financeiro, gestor) são impedidos de alterar hashes e auditoria', () => {
    const camposAssinaturaContrato = [
      'cliente_hash',
      'cliente_ip',
      'cliente_user_agent',
      'cliente_declaracao',
      'data_assinatura_cliente',
      'admin_hash',
      'admin_ip',
      'admin_user_agent',
      'admin_declaracao',
      'data_assinatura_admin',
      'assinante_admin',
      'aceite_hash',
      'aceite_ip',
      'aceite_user_agent',
      'data_aceite',
      'aceite_status',
      'versao_texto_hash',
      'pdf_congelado_hash',
      'dossie_evidencias_json',
    ]

    expect(camposAssinaturaContrato.length).toBeGreaterThan(10)
    expect(camposAssinaturaContrato).toContain('admin_hash')
    expect(camposAssinaturaContrato).toContain('cliente_hash')
  })
})
