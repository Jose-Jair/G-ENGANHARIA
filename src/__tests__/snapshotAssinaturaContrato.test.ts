import { describe, it, expect } from 'vitest'
import {
  montarObjetoSnapshotContrato,
  montarQualificacaoPj,
  extrairSnapshotAssinatura,
  formatarSeloSnapshot,
  obterDadosRenderizacaoContrato,
  DADOS_CONTRATADA_PADRAO,
} from '@/lib/snapshotContrato'
import type { ContratoServicoRecord, ClientePfRecord } from '@/types'

describe('Snapshot de Assinatura de Contrato de Serviço (Item C - Etapas 2 e 3)', () => {
  it('monta snapshot completo para contratante PF com doc_tipo CIN', () => {
    const clientePf = {
      id: 'cpf123',
      nome: 'Maria Eduarda Silveira',
      genero: 'feminino',
      nacionalidade: 'brasileira',
      estado_civil: 'casada',
      profissao: 'Engenheira Civil',
      doc_tipo: 'CIN',
      rg: '12345678901',
      rg_orgao_emissor: 'SSP',
      rg_uf: 'CE',
      cpf: '12345678901',
      logradouro: 'Rua das Flores',
      numero: '120',
      complemento: 'Apto 301',
      bairro: 'Centro',
      municipio: 'Tauá',
      uf: 'CE',
      cep: '63660-000',
      cadastro_status: 'completo',
    }

    const snapshot = montarObjetoSnapshotContrato({
      contratoId: 'ctr_001',
      contratoNumero: 'CTR-2026-0005',
      propostaNumero: 'PROP-2026-0010',
      clientePf,
      objeto: 'Elaboração de projetos complementares de engenharia civil',
      prazoDias: 45,
      notaPrazo: 'Prazos contados a partir da entrega dos arquivos base.',
      valorTotal: 15000,
      parcelas: [
        {
          ordem: 1,
          percentual: 50,
          valor: 7500,
          gatilho: 'Assinatura',
          descricao: 'Entrada na assinatura',
        },
        {
          ordem: 2,
          percentual: 50,
          valor: 7500,
          gatilho: 'Entrega final',
          descricao: 'Saldo na aprovação',
        },
      ],
      clausulasTexto: 'Cláusula de teste',
      signatarioAdmin: {
        nome: 'José Jair Oliveira Alves',
        dataAssinatura: '2026-11-10T14:30:00.000Z',
        ip: '187.19.20.21',
        hash: 'adminhash123',
      },
      signatarioCliente: {
        nome: 'Maria Eduarda Silveira',
        documento: '123.456.789-01',
        dataAssinatura: '2026-11-10T15:00:00.000Z',
        ip: '177.10.11.12',
        hash: 'clienthash456',
      },
      agoraIso: '2026-11-10T15:00:01.000Z',
    })

    expect(snapshot.versao_schema).toBe(1)
    expect(snapshot.contrato_id).toBe('ctr_001')
    expect(snapshot.contrato_numero).toBe('CTR-2026-0005')
    expect(snapshot.proposta_numero).toBe('PROP-2026-0010')
    expect(snapshot.gerado_em).toBe('2026-11-10T15:00:01.000Z')

    // Contratada padrão G+
    expect(snapshot.contratada.nome).toBe(DADOS_CONTRATADA_PADRAO.nome)
    expect(snapshot.contratada.cnpj).toBe('66.862.835/0001-69')
    expect(snapshot.contratada.responsavel_tecnico).toContain('José Jair')

    // Contratante PF
    expect(snapshot.contratante.tipo).toBe('pf')
    expect(snapshot.contratante.nome).toBe('Maria Eduarda Silveira')
    expect(snapshot.contratante.documento).toBe('123.456.789-01')

    // Qualificação em texto (padrão qualificacaoPf com CIN e flexão feminina)
    const texto = snapshot.contratante.texto_qualificacao
    expect(texto).toContain('Maria Eduarda Silveira')
    expect(texto).toContain('brasileira')
    expect(texto).toContain('casada')
    expect(texto).toContain('Engenheira Civil')
    expect(texto).toContain('portadora da Carteira de Identidade Nacional')
    // CIN não repete o número quando igual ao CPF
    expect(texto).not.toContain('nº 12345678901')
    expect(texto).toContain('inscrita no CPF sob o nº 123.456.789-01')
    expect(texto).toContain(
      'residente e domiciliada em Rua das Flores, nº 120, Apto 301, Centro, Tauá/CE, CEP 63660-000',
    )

    // Objeto, valores, parcelas
    expect(snapshot.objeto).toBe('Elaboração de projetos complementares de engenharia civil')
    expect(snapshot.prazo_dias).toBe(45)
    expect(snapshot.valor_total).toBe(15000)
    expect(snapshot.parcelas).toHaveLength(2)

    // Signatários com data/hora e metadados
    expect(snapshot.signatarios.admin.nome).toBe('José Jair Oliveira Alves')
    expect(snapshot.signatarios.admin.data_assinatura).toBe('2026-11-10T14:30:00.000Z')
    expect(snapshot.signatarios.admin.ip).toBe('187.19.20.21')
    expect(snapshot.signatarios.admin.hash).toBe('adminhash123')

    expect(snapshot.signatarios.cliente.nome).toBe('Maria Eduarda Silveira')
    expect(snapshot.signatarios.cliente.documento).toBe('123.456.789-01')
    expect(snapshot.signatarios.cliente.data_assinatura).toBe('2026-11-10T15:00:00.000Z')
    expect(snapshot.signatarios.cliente.ip).toBe('177.10.11.12')
    expect(snapshot.signatarios.cliente.hash).toBe('clienthash456')
  })

  it('monta snapshot completo para contratante PJ', () => {
    const empresa = {
      id: 'emp_001',
      razao_social: 'Construtora Exemplo Ltda',
      nome_fantasia: 'Exemplo Engenharia',
      cnpj: '12345678000195',
      logradouro: 'Av. Santos Dumont',
      numero: '2000',
      complemento: 'Sala 801',
      bairro: 'Aldeota',
      municipio: 'Fortaleza',
      uf: 'CE',
      cep: '60150-161',
    }

    const snapshot = montarObjetoSnapshotContrato({
      contratoId: 'ctr_002',
      contratoNumero: 'CTR-2026-0006',
      empresa,
      objeto: 'Consultoria estrutural',
      valorTotal: 50000,
      signatarioAdmin: {
        nome: 'Diretoria G+',
        dataAssinatura: '2026-11-10T10:00:00.000Z',
        ip: '187.19.20.21',
        hash: 'adminhash_pj',
      },
      signatarioCliente: {
        nome: 'Carlos Drummond',
        documento: 'Sócio-Administrador',
        dataAssinatura: '2026-11-10T11:00:00.000Z',
        ip: '177.20.30.40',
        hash: 'clienthash_pj',
      },
    })

    expect(snapshot.contratante.tipo).toBe('pj')
    expect(snapshot.contratante.nome).toBe('Construtora Exemplo Ltda')
    expect(snapshot.contratante.documento).toBe('12.345.678/0001-95')

    const texto = snapshot.contratante.texto_qualificacao
    expect(texto).toContain('Construtora Exemplo Ltda')
    expect(texto).toContain('inscrita no CNPJ sob o nº 12.345.678/0001-95')
    expect(texto).toContain(
      'com sede em Av. Santos Dumont, nº 2000, Sala 801, Aldeota, Fortaleza/CE, CEP 60150-161',
    )

    expect(snapshot.signatarios.cliente.nome).toBe('Carlos Drummond')
    expect(snapshot.signatarios.cliente.documento).toBe('Sócio-Administrador')
    expect(snapshot.signatarios.cliente.data_assinatura).toBe('2026-11-10T11:00:00.000Z')
  })

  it('função auxiliar montarQualificacaoPj formata corretamente campos parciais', () => {
    const texto = montarQualificacaoPj({
      razao_social: 'Alpha Engenharia',
      cnpj: '00000000000191',
      municipio: 'Tauá',
      uf: 'CE',
    })
    expect(texto).toContain('Alpha Engenharia')
    expect(texto).toContain('00.000.000/0001-91')
    expect(texto).toContain('Tauá/CE')
  })

  it('simula validação write-once: snapshot preenchido impede sobrescrita', () => {
    const originalRecord = {
      snapshot_assinatura: '{"versao_schema":1,"contrato_numero":"CTR-2026-0001"}',
      snapshot_em: '2026-11-01T10:00:00.000Z',
    }

    const validarWriteOnce = (
      orig: typeof originalRecord,
      novoValorAssinatura: string,
      novoValorEm: string,
    ) => {
      const origAssinatura = (orig.snapshot_assinatura || '').trim()
      const origEm = (orig.snapshot_em || '').trim()

      if (origAssinatura && novoValorAssinatura !== origAssinatura) {
        throw new Error('O snapshot de assinatura é imutável')
      }
      if (origEm && novoValorEm !== origEm) {
        throw new Error('O snapshot de assinatura é imutável')
      }
      return true
    }

    expect(
      validarWriteOnce(
        originalRecord,
        '{"versao_schema":1,"contrato_numero":"CTR-2026-0001"}',
        '2026-11-01T10:00:00.000Z',
      ),
    ).toBe(true)

    expect(() =>
      validarWriteOnce(
        originalRecord,
        '{"versao_schema":2,"modificado":true}',
        '2026-11-01T10:00:00.000Z',
      ),
    ).toThrow('O snapshot de assinatura é imutável')

    expect(() =>
      validarWriteOnce(
        originalRecord,
        '{"versao_schema":1,"contrato_numero":"CTR-2026-0001"}',
        '2026-11-10T12:00:00.000Z',
      ),
    ).toThrow('O snapshot de assinatura é imutável')

    const originalVazio = { snapshot_assinatura: '', snapshot_em: '' }
    expect(validarWriteOnce(originalVazio, '{"versao_schema":1}', '2026-11-10T12:00:00.000Z')).toBe(
      true,
    )
  })

  describe('Etapa 3 - Renderização a partir do Snapshot vs Ao Vivo', () => {
    it('formata o selo discreto com padrão dd/mm/aaaa', () => {
      const selo = formatarSeloSnapshot('2026-11-10T15:30:00.000Z')
      expect(selo).toBe('Versão assinada em 10/11/2026')

      const seloVazio = formatarSeloSnapshot(null)
      expect(seloVazio).toBe('Versão assinada')
    })

    it('extrai snapshot com segurança tanto de string JSON quanto de objeto parsed', () => {
      const objetoJson = {
        versao_schema: 1,
        contratante: { nome: 'Cliente Teste' },
        signatarios: { admin: {}, cliente: {} },
      }
      expect(extrairSnapshotAssinatura(objetoJson)).not.toBeNull()
      expect(extrairSnapshotAssinatura(JSON.stringify(objetoJson))).not.toBeNull()
      expect(extrairSnapshotAssinatura(null)).toBeNull()
      expect(extrairSnapshotAssinatura('')).toBeNull()
      expect(extrairSnapshotAssinatura('{invalid json')).toBeNull()
    })

    it('imutabilidade: cliente muda de nome após assinatura → dados de renderização continuam mostrando nome e qualificação originais do snapshot', () => {
      // Snapshot congelado na assinatura
      const snapshotOriginal = montarObjetoSnapshotContrato({
        contratoId: 'ctr_imutavel',
        contratoNumero: 'CTR-2026-0088',
        clientePf: {
          nome: 'Nome Antigo do Cliente',
          cpf: '11122233344',
          genero: 'masculino',
          nacionalidade: 'brasileiro',
          estado_civil: 'solteiro',
          profissao: 'Arquiteto',
          municipio: 'Tauá',
          uf: 'CE',
        },
        objeto: 'Objeto original do contrato congelado',
        valorTotal: 12000,
        prazoDias: 20,
        signatarioAdmin: {
          nome: 'Admin Original',
          dataAssinatura: '2026-11-01T10:00:00.000Z',
          ip: '10.0.0.1',
          hash: 'hashadmin',
        },
        signatarioCliente: {
          nome: 'Nome Antigo do Cliente',
          documento: '111.222.333-44',
          dataAssinatura: '2026-11-01T11:00:00.000Z',
          ip: '10.0.0.2',
          hash: 'hashcli',
        },
      })

      // Contrato com snapshot_assinatura e snapshot_em preenchidos
      const contratoComSnapshot: ContratoServicoRecord = {
        id: 'ctr_imutavel',
        numero: 'CTR-2026-0088',
        status: 'assinado',
        objeto: 'Objeto no registro de contrato (alterado)',
        valor_total: 99999, // valor alterado posteriormente no registro
        prazo_dias: 90,
        snapshot_assinatura: JSON.stringify(snapshotOriginal),
        snapshot_em: '2026-11-01T11:00:00.000Z',
        created: '2026-10-25T10:00:00.000Z',
      } as any

      // Cliente PF que teve o cadastro vivo alterado posteriormente (ex: casou e mudou de nome, endereço)
      const clientePfCadastroAlterado: ClientePfRecord = {
        id: 'cpf1',
        nome: 'NOME NOVO TOTALMENTE DIFERENTE DA SILVA',
        cpf: '11122233344',
        profissao: 'Empresário',
        municipio: 'Fortaleza',
        uf: 'CE',
      } as any

      // Executa a resolução dos dados de renderização
      const dados = obterDadosRenderizacaoContrato(contratoComSnapshot, clientePfCadastroAlterado)

      // 1. Fonte deve ser 'snapshot'
      expect(dados.fonte).toBe('snapshot')

      // 2. Selo deve estar presente com a data formatada dd/mm/aaaa
      expect(dados.seloAssinatura).toBe('Versão assinada em 01/11/2026')

      // 3. Nome do cliente deve ser o NOME ANTIGO do snapshot, NÃO o novo
      expect(dados.qualificacaoContratante).toContain('Nome Antigo do Cliente')
      expect(dados.qualificacaoContratante).not.toContain('NOME NOVO TOTALMENTE DIFERENTE')

      // 4. Objeto, prazo e valor total devem refletir o snapshot, não o banco vivo
      expect(dados.objetoTexto).toBe('Objeto original do contrato congelado')
      expect(dados.valorTotal).toBe(12000)
      expect(dados.prazoDias).toBe(20)

      // 5. Signatário reflete o snapshot
      expect(dados.assinaturaCliente?.assinante).toBe('Nome Antigo do Cliente')
    })

    it('contrato sem snapshot (rascunho/não assinado): continua resolvendo ao vivo a partir do cadastro do cliente, sem selo', () => {
      // Contrato em elaboração (sem snapshot)
      const contratoSemSnapshot: ContratoServicoRecord = {
        id: 'ctr_rascunho',
        numero: 'CTR-2026-0099',
        status: 'rascunho',
        objeto: 'Elaboração de projetos ao vivo',
        valor_total: 8500,
        prazo_dias: 30,
        snapshot_assinatura: null,
        snapshot_em: null,
        created: '2026-11-10T10:00:00.000Z',
      } as any

      const clientePfAoVivo: ClientePfRecord = {
        id: 'cpf2',
        nome: 'Cliente Ao Vivo Ativo',
        cpf: '99988877766',
        genero: 'masculino',
        nacionalidade: 'brasileiro',
        estado_civil: 'solteiro',
        profissao: 'Engenheiro',
        logradouro: 'Rua Principal',
        numero: '100',
        bairro: 'Centro',
        municipio: 'Tauá',
        uf: 'CE',
        cep: '63660-000',
      } as any

      const dados = obterDadosRenderizacaoContrato(contratoSemSnapshot, clientePfAoVivo)

      // 1. Fonte deve ser 'cadastro_vivo'
      expect(dados.fonte).toBe('cadastro_vivo')

      // 2. Selo deve ser null (não assinado)
      expect(dados.seloAssinatura).toBeNull()

      // 3. Qualificação reflete os dados vivos do cliente
      expect(dados.qualificacaoContratante).toContain('Cliente Ao Vivo Ativo')
      expect(dados.qualificacaoContratante).toContain('999.888.777-66')
      expect(dados.qualificacaoContratante).toContain('Rua Principal, nº 100')

      // 4. Objeto e valores refletem o registro vivo do contrato
      expect(dados.objetoTexto).toBe('Elaboração de projetos ao vivo')
      expect(dados.valorTotal).toBe(8500)
      expect(dados.prazoDias).toBe(30)
    })
  })
})
