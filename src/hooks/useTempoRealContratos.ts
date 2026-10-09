import { useEffect, useRef, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { ContratoServicoRecord, PropostaRecord } from '@/types'

export interface UseTempoRealContratosOptions {
  /**
   * Chamado quando um contrato ou proposta relevante for atualizado
   */
  onContratoAtualizado?: (contrato: ContratoServicoRecord, evento: string) => void
  onPropostaAtualizada?: (proposta: PropostaRecord, evento: string) => void
  /**
   * Se fornecido, filtra updates para o contrato específico
   */
  contratoId?: string
  /**
   * Se fornecido, filtra updates para a proposta específica
   */
  propostaId?: string
  /**
   * Callback genérico de recarga local
   */
  onRecarregar?: () => void
  /**
   * Ativar/desativar escuta (padrão true)
   */
  ativo?: boolean
  /**
   * Se true, também assina empresas e clientes_pf para capturar pré-cadastros validados/completados
   */
  escutarPreCadastros?: boolean
}

/**
 * Hook utilitário para escuta SSE em tempo real de Contratos de Serviço, Propostas e Pré-cadastros.
 * - Assina pb.collection('contratos_servico').subscribe('*')
 * - Assina pb.collection('propostas').subscribe('*')
 * - Opcionalmente assina pb.collection('empresas') e pb.collection('clientes_pf') para pré-cadastros
 * - Notifica com toast quando cliente completa cadastro ou assina contrato
 * - Notifica com toast quando proposta é aceita ou muda de status
 * - Fallback: setInterval de 30s recarregando caso conexão caia ou para manter paridade
 * - Dispara evento customizado para atualizar badge/sininho global ('gmais:notificacao_atualizada')
 * - Cancela subscriptions no unmount
 */
export function useTempoRealContratos({
  onContratoAtualizado,
  onPropostaAtualizada,
  contratoId,
  propostaId,
  onRecarregar,
  ativo = true,
  escutarPreCadastros = true,
}: UseTempoRealContratosOptions = {}) {
  const { toast } = useToast()
  const sseConectadoRef = useRef<boolean>(false)
  const ultimosContratosStatusRef = useRef<Map<string, string>>(new Map())
  const ultimasPropostasStatusRef = useRef<Map<string, string>>(new Map())

  // Disparar evento para atualizar contadores no AppLayout / sininho
  const notificarSininho = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent('gmais:notificacao_atualizada'))
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!ativo) return

    let isMounted = true
    let unsubscribeContratos: (() => void) | null = null
    let unsubscribePropostas: (() => void) | null = null
    let unsubscribeEmpresas: (() => void) | null = null
    let unsubscribeClientesPf: (() => void) | null = null

    const handleContratoUpdate = (data: { action: string; record: any }) => {
      if (!isMounted) return
      const c = data.record as ContratoServicoRecord
      const oldStatus = ultimosContratosStatusRef.current.get(c.id)
      ultimosContratosStatusRef.current.set(c.id, c.status)

      // Se for específico e não bater, ignore
      if (contratoId && c.id !== contratoId) {
        return
      }

      // Notificações específicas quando status muda
      if (data.action === 'update' && oldStatus && oldStatus !== c.status) {
        if (c.status === 'aguardando_assinatura_admin') {
          toast({
            title: 'Cadastro do cliente concluído!',
            description: `O cliente preencheu os dados do contrato ${c.numero}. Liberado para assinatura da Diretoria.`,
          })
          notificarSininho()
        } else if (c.status === 'aguardando_assinatura_cliente') {
          toast({
            title: 'Contrato liberado para cliente!',
            description: `O contrato ${c.numero} aguarda a assinatura digital do cliente.`,
          })
          notificarSininho()
        } else if (c.status === 'assinado') {
          toast({
            title: 'Contrato assinado pelo cliente!',
            description: `O contrato ${c.numero} foi assinado com sucesso.`,
          })
          notificarSininho()
        }
      } else if (data.action === 'create') {
        notificarSininho()
      }

      onContratoAtualizado?.(c, data.action)
      onRecarregar?.()
    }

    const handlePropostaUpdate = (data: { action: string; record: any }) => {
      if (!isMounted) return
      const p = data.record as PropostaRecord
      const oldStatus = ultimasPropostasStatusRef.current.get(p.id)
      ultimasPropostasStatusRef.current.set(p.id, p.status)

      if (propostaId && p.id !== propostaId) {
        return
      }

      if (data.action === 'update' && oldStatus && oldStatus !== p.status) {
        if (p.status === 'aceita') {
          toast({
            title: 'Proposta Aceita!',
            description: `A proposta ${p.numero} recebeu o aceite digital do cliente.`,
          })
          notificarSininho()
        }
      }

      onPropostaAtualizada?.(p, data.action)
      onRecarregar?.()
    }

    const handleEmpresaUpdate = (data: { action: string; record: any }) => {
      if (!isMounted) return
      // Quando empresa sai de pre_cadastro=true para pre_cadastro=false
      if (data.action === 'update' && data.record && data.record.pre_cadastro === false) {
        notificarSininho()
      }
      onRecarregar?.()
    }

    const handleClientePfUpdate = (data: { action: string; record: any }) => {
      if (!isMounted) return
      // Quando cliente PF sai de pre_cadastro=true para pre_cadastro=false
      if (data.action === 'update' && data.record && data.record.pre_cadastro === false) {
        notificarSininho()
      }
      onRecarregar?.()
    }

    // Iniciar subscriptions SSE
    const setupSubscriptions = async () => {
      try {
        const unsubC = await pb.collection('contratos_servico').subscribe('*', handleContratoUpdate)
        unsubscribeContratos = () => unsubC()
        sseConectadoRef.current = true
      } catch (err) {
        console.warn('Erro ao conectar SSE de contratos_servico:', err)
        sseConectadoRef.current = false
      }

      try {
        const unsubP = await pb.collection('propostas').subscribe('*', handlePropostaUpdate)
        unsubscribePropostas = () => unsubP()
        sseConectadoRef.current = true
      } catch (err) {
        console.warn('Erro ao conectar SSE de propostas:', err)
        sseConectadoRef.current = false
      }

      if (escutarPreCadastros) {
        try {
          const unsubEmp = await pb.collection('empresas').subscribe('*', handleEmpresaUpdate)
          unsubscribeEmpresas = () => unsubEmp()
        } catch (err) {
          console.warn('Erro ao conectar SSE de empresas:', err)
        }

        try {
          const unsubPf = await pb.collection('clientes_pf').subscribe('*', handleClientePfUpdate)
          unsubscribeClientesPf = () => unsubPf()
        } catch (err) {
          console.warn('Erro ao conectar SSE de clientes_pf:', err)
        }
      }
    }

    setupSubscriptions()

    // Fallback: setInterval de 30s recarregando quando a conexão cair ou periodicamente
    const fallbackInterval = setInterval(() => {
      if (isMounted && onRecarregar) {
        onRecarregar()
      }
    }, 30000)

    return () => {
      isMounted = false
      clearInterval(fallbackInterval)
      if (unsubscribeContratos) {
        try {
          unsubscribeContratos()
        } catch {
          /* ignore */
        }
      }
      if (unsubscribePropostas) {
        try {
          unsubscribePropostas()
        } catch {
          /* ignore */
        }
      }
      if (unsubscribeEmpresas) {
        try {
          unsubscribeEmpresas()
        } catch {
          /* ignore */
        }
      }
      if (unsubscribeClientesPf) {
        try {
          unsubscribeClientesPf()
        } catch {
          /* ignore */
        }
      }
      try {
        pb.collection('contratos_servico').unsubscribe('*')
      } catch {
        /* ignore */
      }
      try {
        pb.collection('propostas').unsubscribe('*')
      } catch {
        /* ignore */
      }
      if (escutarPreCadastros) {
        try {
          pb.collection('empresas').unsubscribe('*')
        } catch {
          /* ignore */
        }
        try {
          pb.collection('clientes_pf').unsubscribe('*')
        } catch {
          /* ignore */
        }
      }
    }
  }, [
    ativo,
    contratoId,
    propostaId,
    escutarPreCadastros,
    onContratoAtualizado,
    onPropostaAtualizada,
    onRecarregar,
    toast,
    notificarSininho,
  ])
}
