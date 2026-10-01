import pb from '@/lib/pocketbase/client'
import { SugestaoFunilRecord, SugestaoFonte, SugestaoStatus, EmpresaRecord } from '@/types'
import { CreateEmpresaData } from './empresas'
import { cleanCnpj } from '@/lib/cnpj'

export interface CreateSugestaoData {
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  uf?: string
  municipio?: string
  email?: string
  telefone?: string
  cnae?: string
  porte?: string
  orgao_contrato?: string
  numero_contrato?: string
  objeto_contrato?: string
  valor_estimado?: number
  fonte: SugestaoFonte
  status?: SugestaoStatus
  observacoes?: string
}

export const sugestoesService = {
  async list(status?: string): Promise<SugestaoFunilRecord[]> {
    const filterClauses: string[] = []
    if (status && status !== 'todas') {
      filterClauses.push(`status = '${status}'`)
    }
    const filter = filterClauses.join(' && ')

    return await pb.collection('sugestoes_funil').getFullList<SugestaoFunilRecord>({
      filter,
      sort: '-created',
      expand: 'empresa_criada,decidido_por',
    })
  },

  async create(data: CreateSugestaoData): Promise<SugestaoFunilRecord> {
    return await pb.collection('sugestoes_funil').create<SugestaoFunilRecord>({
      ...data,
      status: data.status || 'pendente',
    })
  },

  async createBatch(items: CreateSugestaoData[]): Promise<{ created: number; errors: number }> {
    let created = 0
    let errors = 0
    for (const item of items) {
      try {
        await this.create(item)
        created++
      } catch (e) {
        console.error('Erro ao criar sugestao em lote:', e)
        errors++
      }
    }
    return { created, errors }
  },

  /**
   * Incorpora uma sugestão ao funil: cria a empresa na etapa 'identificada'
   * e marca a sugestão como 'incorporada' com vínculo à empresa
   */
  async incorporarAoFunil(
    sugestaoId: string,
    usuarioId: string,
    empresaCustomData?: Partial<CreateEmpresaData>,
  ): Promise<{ empresa: EmpresaRecord; sugestao: SugestaoFunilRecord }> {
    const sugestao = await pb.collection('sugestoes_funil').getOne<SugestaoFunilRecord>(sugestaoId)

    // Criar empresa
    const novaEmpresaData: CreateEmpresaData = {
      razao_social: sugestao.razao_social,
      nome_fantasia: sugestao.nome_fantasia || sugestao.razao_social,
      cnpj: sugestao.cnpj || '',
      situacao_cadastral: 'ATIVA',
      cnae: sugestao.cnae || '',
      porte: sugestao.porte || 'DEMAIS',
      uf: sugestao.uf || '',
      municipio: sugestao.municipio || '',
      email: sugestao.email || '',
      telefone: sugestao.telefone || '',
      etapa_funil: 'identificada',
      curva: 'C',
      score: 60,
      status: 'ativa',
      responsavel: usuarioId,
      observacoes: `Empresa originada da fila de sugestões (${sugestao.fonte.toUpperCase()}). ${sugestao.observacoes || ''}`,
      proxima_acao_desc: 'Primeiro contato de prospecção e qualificação',
      ...empresaCustomData,
    }

    const empresa = await pb.collection('empresas').create<EmpresaRecord>(novaEmpresaData)

    // Se tiver dados de contrato da sugestão, criar o contrato correspondente
    if (sugestao.orgao_contrato || sugestao.numero_contrato) {
      try {
        await pb.collection('contratos').create({
          empresa: empresa.id,
          orgao: sugestao.orgao_contrato || 'Órgão Público',
          numero: sugestao.numero_contrato || `CONT-${Date.now().toString().slice(-6)}`,
          objeto: sugestao.objeto_contrato || 'Objeto do contrato de engenharia',
          valor: sugestao.valor_estimado || 0,
          saldo: sugestao.valor_estimado || 0,
          situacao: 'Em Execução',
          fonte: sugestao.fonte === 'pncp' ? 'PNCP' : 'Planilha Externa',
        })
      } catch (err) {
        console.warn('Erro ao criar contrato vinculado da sugestao:', err)
      }
    }

    // Atualizar sugestão
    const sugestaoAtualizada = await pb
      .collection('sugestoes_funil')
      .update<SugestaoFunilRecord>(sugestaoId, {
        status: 'incorporada',
        empresa_criada: empresa.id,
        decidido_por: usuarioId,
        data_decisao: new Date().toISOString(),
      })

    return { empresa, sugestao: sugestaoAtualizada }
  },

  /**
   * Aprova sugestão para inclusão (especialmente usada para PNCP antes de incorporar)
   */
  async aprovarParaInclusao(sugestaoId: string, usuarioId: string): Promise<SugestaoFunilRecord> {
    return await pb.collection('sugestoes_funil').update<SugestaoFunilRecord>(sugestaoId, {
      status: 'aprovada_para_inclusao',
      decidido_por: usuarioId,
      data_decisao: new Date().toISOString(),
    })
  },

  /**
   * Descarta sugestão com motivo obrigatório
   */
  async descartar(
    sugestaoId: string,
    motivo: string,
    usuarioId: string,
  ): Promise<SugestaoFunilRecord> {
    return await pb.collection('sugestoes_funil').update<SugestaoFunilRecord>(sugestaoId, {
      status: 'descartada',
      motivo_descarte: motivo,
      decidido_por: usuarioId,
      data_decisao: new Date().toISOString(),
    })
  },
}
