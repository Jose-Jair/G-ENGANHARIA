import pb from '@/lib/pocketbase/client'
import { ClientePfRecord, PropostaRecord } from '@/types'
import { cleanCpf } from '@/lib/cnpj'

import { TelefoneItem } from '@/types'

export interface CreateClientePfData {
  nome: string
  cpf: string
  email?: string
  telefone?: string
  telefones?: TelefoneItem[]
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  base_legal: string
  consentimento_lgpd: boolean
  data_consentimento?: string
  endereco?: string
  observacoes?: string
  // Proposta opcional
  propostaOpcional?: {
    numero: string
    escopo: string
    preco: number
    prazo?: string
  }
}

export interface UpdateClientePfData {
  nome?: string
  cpf?: string
  email?: string
  telefone?: string
  telefones?: TelefoneItem[]
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  base_legal?: string
  consentimento_lgpd?: boolean
  data_consentimento?: string
  endereco?: string
  observacoes?: string
}

export interface ClientePfComMetricas extends ClientePfRecord {
  receitaAcumulada: number
  totalProjetos: number
  totalPropostas: number
}

export const clientesPfService = {
  /**
   * Lista todos os clientes PF
   */
  async list(): Promise<ClientePfRecord[]> {
    return await pb.collection('clientes_pf').getFullList<ClientePfRecord>({
      sort: 'nome',
    })
  },

  /**
   * Busca um cliente PF por ID
   */
  async getById(id: string): Promise<ClientePfRecord> {
    return await pb.collection('clientes_pf').getOne<ClientePfRecord>(id)
  },

  /**
   * Verifica se já existe cliente PF com o mesmo CPF (bloqueio de duplicidade)
   */
  async checkCpfExists(cpf: string, excludeId?: string): Promise<boolean> {
    const rawClean = cleanCpf(cpf)
    if (!rawClean) return false

    const list = await pb.collection('clientes_pf').getFullList<ClientePfRecord>()
    return list.some((c) => {
      if (excludeId && c.id === excludeId) return false
      return cleanCpf(c.cpf) === rawClean
    })
  },

  /**
   * Cria novo cliente PF com validação prévia de duplicidade e registro com proposta opcional
   */
  async create(dados: CreateClientePfData): Promise<ClientePfRecord> {
    const rawClean = cleanCpf(dados.cpf)
    const exists = await this.checkCpfExists(rawClean)
    if (exists) {
      throw new Error(`Já existe um Cliente PF cadastrado com o CPF informado.`)
    }

    // Se foram passados telefones estruturados, extrair o primeiro para o campo telefone legada
    const telefonePrincipal =
      dados.telefone ||
      (dados.telefones && dados.telefones.length > 0 ? dados.telefones[0].numero : '')

    const record = await pb.collection('clientes_pf').create<ClientePfRecord>({
      nome: dados.nome,
      cpf: dados.cpf,
      email: dados.email || '',
      telefone: telefonePrincipal || '',
      telefones: dados.telefones || [],
      cep: dados.cep || '',
      logradouro: dados.logradouro || '',
      numero: dados.numero || '',
      complemento: dados.complemento || '',
      bairro: dados.bairro || '',
      municipio: dados.municipio || '',
      uf: dados.uf || '',
      base_legal: dados.base_legal,
      consentimento_lgpd: Boolean(dados.consentimento_lgpd),
      data_consentimento: dados.data_consentimento || new Date().toISOString().split('T')[0],
      endereco: dados.endereco || '',
      observacoes: dados.observacoes || '',
    })

    // Se forneceu proposta opcional, cria vinculada
    if (dados.propostaOpcional && dados.propostaOpcional.numero && dados.propostaOpcional.escopo) {
      const preco = Number(dados.propostaOpcional.preco) || 0
      const custo = Math.round(preco * 0.6)
      await pb.collection('propostas').create<PropostaRecord>({
        numero: dados.propostaOpcional.numero,
        revisao: 'R00',
        cliente_pf: record.id,
        escopo: dados.propostaOpcional.escopo,
        preco,
        custo,
        margem: 40,
        impostos: 16.5,
        prazo: dados.propostaOpcional.prazo || '30 dias',
        status: 'aceita',
      })
    }

    return record
  },

  /**
   * Atualiza dados de cliente PF
   */
  async update(id: string, dados: UpdateClientePfData): Promise<ClientePfRecord> {
    const payload: Record<string, unknown> = { ...dados }
    if (dados.telefones && dados.telefones.length > 0 && !dados.telefone) {
      payload.telefone = dados.telefones[0].numero
    }
    return await pb.collection('clientes_pf').update<ClientePfRecord>(id, payload)
  },

  /**
   * Exclui cliente PF (restrito a Admin pelas regras da collection)
   */
  async delete(id: string): Promise<boolean> {
    return await pb.collection('clientes_pf').delete(id)
  },

  /**
   * Lista propostas ligadas ao cliente PF
   */
  async listPropostas(clientePfId: string): Promise<PropostaRecord[]> {
    return await pb.collection('propostas').getFullList<PropostaRecord>({
      filter: `cliente_pf = '${clientePfId}'`,
      sort: '-created',
    })
  },

  /**
   * Carrega clientes PF com métricas calculadas (receita acumulada e nº de projetos)
   */
  async listComMetricas(): Promise<ClientePfComMetricas[]> {
    const [clientes, todasPropostas] = await Promise.all([
      this.list(),
      pb.collection('propostas').getFullList<PropostaRecord>({
        filter: "cliente_pf != ''",
      }),
    ])

    const propostasPorCliente: Record<string, PropostaRecord[]> = {}
    for (const p of todasPropostas) {
      if (p.cliente_pf) {
        if (!propostasPorCliente[p.cliente_pf]) propostasPorCliente[p.cliente_pf] = []
        propostasPorCliente[p.cliente_pf].push(p)
      }
    }

    return clientes.map((c) => {
      const props = propostasPorCliente[c.id] || []
      const aceitas = props.filter((p) => p.status === 'aceita')
      const receitaAcumulada = aceitas.reduce((acc, p) => acc + (Number(p.preco) || 0), 0)
      const totalProjetos = aceitas.length

      return {
        ...c,
        receitaAcumulada,
        totalProjetos,
        totalPropostas: props.length,
      }
    })
  },
}
