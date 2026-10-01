import pb from '@/lib/pocketbase/client'
import { ReativacaoSugeridaRecord, EtapaFunil } from '@/types'

export const reativacoesService = {
  async listPendentes(): Promise<ReativacaoSugeridaRecord[]> {
    return await pb.collection('reativacoes_sugeridas').getFullList<ReativacaoSugeridaRecord>({
      filter: "status = 'pendente'",
      sort: '-created',
      expand: 'empresa,contrato,decidido_por',
    })
  },

  async listPorEmpresa(empresaId: string): Promise<ReativacaoSugeridaRecord[]> {
    return await pb.collection('reativacoes_sugeridas').getFullList<ReativacaoSugeridaRecord>({
      filter: `empresa = '${empresaId}'`,
      sort: '-created',
      expand: 'empresa,contrato,decidido_por',
    })
  },

  /**
   * Comercial/Admin aceita a sugestão de reativação:
   * Move a empresa para o destino escolhido ('em_conversa' ou 'identificada')
   * e se estiver com status='inativa', reativa para 'ativa'.
   */
  async aceitar(
    reativacaoId: string,
    destino: 'em_conversa' | 'identificada',
    usuarioId: string,
    observacao?: string,
  ): Promise<ReativacaoSugeridaRecord> {
    const reativacao = await pb
      .collection('reativacoes_sugeridas')
      .getOne<ReativacaoSugeridaRecord>(reativacaoId, {
        expand: 'empresa',
      })

    // Atualiza empresa
    if (reativacao.empresa) {
      await pb.collection('empresas').update(reativacao.empresa, {
        etapa_funil: destino,
        status: 'ativa',
        motivo_inativacao: '',
        proxima_acao_desc: `Reativada após identificação do contrato ${reativacao.contrato_numero || ''} (${reativacao.contrato_orgao || ''})`,
      })
    }

    // Atualiza registro de sugestão de reativação
    return await pb
      .collection('reativacoes_sugeridas')
      .update<ReativacaoSugeridaRecord>(reativacaoId, {
        status: 'aceita',
        destino_aceito: destino,
        observacao_decisao: observacao || 'Reativação aceita pelo Comercial',
        decidido_por: usuarioId,
        data_decisao: new Date().toISOString(),
      })
  },

  /**
   * Comercial/Admin descarta com observação obrigatória
   */
  async descartar(
    reativacaoId: string,
    observacao: string,
    usuarioId: string,
  ): Promise<ReativacaoSugeridaRecord> {
    return await pb
      .collection('reativacoes_sugeridas')
      .update<ReativacaoSugeridaRecord>(reativacaoId, {
        status: 'descartada',
        observacao_decisao: observacao,
        decidido_por: usuarioId,
        data_decisao: new Date().toISOString(),
      })
  },
}
