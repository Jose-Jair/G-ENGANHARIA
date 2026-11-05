import React, { useEffect, useState, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { clientesPfService, ClientePfRecord, ConviteClientePfRecord } from '@/services/clientesPf'
import { formatCpf, formatPhoneBr } from '@/lib/cnpj'
import {
  ModalRevisaoCadastroClientePfView,
  LinhaComparacao,
} from './ModalRevisaoCadastroClientePfView'

interface ModalRevisaoCadastroClientePfProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: ClientePfRecord | null
  onSuccess: () => void
  onGerarNovoLink?: (cliente: ClientePfRecord) => void
}

function formatarDataIsoBr(dataIso?: string | null): string {
  if (!dataIso) return '-'
  try {
    const d = new Date(dataIso)
    if (isNaN(d.getTime())) return dataIso
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dataIso
  }
}

function formatarDataNascBr(str?: string | null): string {
  if (!str) return '-'
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`
  }
  return str
}

export function ModalRevisaoCadastroClientePf({
  open,
  onOpenChange,
  cliente,
  onSuccess,
  onGerarNovoLink,
}: ModalRevisaoCadastroClientePfProps) {
  const { toast } = useToast()

  const [carregandoConvite, setCarregandoConvite] = useState(false)
  const [convite, setConvite] = useState<ConviteClientePfRecord | null>(null)
  const [erroConvite, setErroConvite] = useState<string | null>(null)

  const [processandoAprovacao, setProcessandoAprovacao] = useState(false)
  const [confirmandoAprovacao, setConfirmandoAprovacao] = useState(false)

  const [modoRecusa, setModoRecusa] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [processandoRecusa, setProcessandoRecusa] = useState(false)
  const [recusaConcluida, setRecusaConcluida] = useState(false)

  const [erroApi, setErroApi] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !cliente) {
      setConvite(null)
      setErroConvite(null)
      setConfirmandoAprovacao(false)
      setModoRecusa(false)
      setMotivoRecusa('')
      setRecusaConcluida(false)
      setErroApi(null)
      return
    }

    let cancelado = false
    const carregar = async () => {
      setCarregandoConvite(true)
      setErroConvite(null)
      setErroApi(null)
      try {
        const c = await clientesPfService.getConviteUsadoMaisRecente(cliente.id)
        if (cancelado) return
        if (!c) {
          setErroConvite('Nenhum convite preenchido pelo cliente foi localizado para revisão.')
        } else {
          setConvite(c)
        }
      } catch (err: unknown) {
        if (cancelado) return
        const msg =
          err instanceof Error ? err.message : 'Erro ao carregar dados do convite para revisão.'
        setErroConvite(msg)
      } finally {
        if (!cancelado) setCarregandoConvite(false)
      }
    }

    carregar()
    return () => {
      cancelado = true
    }
  }, [open, cliente?.id])

  const dados = useMemo(() => {
    return (convite?.dados_enviados as Record<string, unknown> | undefined) || {}
  }, [convite])

  const linhasComparacao: LinhaComparacao[] = useMemo(() => {
    if (!cliente) return []

    const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim())

    const atualTelefone = (() => {
      if (cliente.telefones && cliente.telefones.length > 0) {
        return cliente.telefones.map((t) => formatPhoneBr(t.numero) || t.numero).join(', ')
      }
      return formatPhoneBr(cliente.telefone) || str(cliente.telefone)
    })()

    const enviadoTelefone = formatPhoneBr(str(dados.telefone)) || str(dados.telefone)

    const itens: { campo: string; atual: string; enviado: string }[] = [
      { campo: 'Nome', atual: str(cliente.nome), enviado: str(dados.nome) },
      {
        campo: 'CPF',
        atual: cliente.cpf ? formatCpf(cliente.cpf) : '',
        enviado: dados.cpf ? formatCpf(str(dados.cpf)) : '',
      },
      {
        campo: 'Documento de identificação',
        atual: str(cliente.doc_tipo) || (cliente.rg ? 'RG' : ''),
        enviado: str(dados.doc_tipo) || (dados.rg ? 'RG' : ''),
      },
      ...(str(cliente.doc_tipo) === 'Outro' || str(dados.doc_tipo) === 'Outro'
        ? [
            {
              campo: 'Qual documento?',
              atual: str(cliente.doc_tipo_outro),
              enviado: str(dados.doc_tipo_outro),
            },
          ]
        : []),
      { campo: 'Número do documento', atual: str(cliente.rg), enviado: str(dados.rg) },
      {
        campo: 'Órgão emissor',
        atual: str(cliente.rg_orgao_emissor),
        enviado: str(dados.rg_orgao_emissor),
      },
      { campo: 'UF do documento', atual: str(cliente.rg_uf), enviado: str(dados.rg_uf) },
      { campo: 'Estado civil', atual: str(cliente.estado_civil), enviado: str(dados.estado_civil) },
      { campo: 'Profissão', atual: str(cliente.profissao), enviado: str(dados.profissao) },
      {
        campo: 'Nacionalidade',
        atual: str(cliente.nacionalidade),
        enviado: str(dados.nacionalidade),
      },
      {
        campo: 'Data de nascimento',
        atual: formatarDataNascBr(str(cliente.data_nascimento)),
        enviado: formatarDataNascBr(str(dados.data_nascimento)),
      },
      { campo: 'Telefone(s)', atual: atualTelefone, enviado: enviadoTelefone },
      { campo: 'E-mail', atual: str(cliente.email), enviado: str(dados.email) },
      { campo: 'CEP', atual: str(cliente.cep), enviado: str(dados.cep) },
      { campo: 'Logradouro', atual: str(cliente.logradouro), enviado: str(dados.logradouro) },
      { campo: 'Número', atual: str(cliente.numero), enviado: str(dados.numero) },
      { campo: 'Complemento', atual: str(cliente.complemento), enviado: str(dados.complemento) },
      { campo: 'Bairro', atual: str(cliente.bairro), enviado: str(dados.bairro) },
      { campo: 'Município', atual: str(cliente.municipio), enviado: str(dados.municipio) },
      { campo: 'UF', atual: str(cliente.uf), enviado: str(dados.uf) },
    ]

    return itens.map((item) => {
      const normalizar = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
      const diferente = Boolean(item.enviado && normalizar(item.atual) !== normalizar(item.enviado))
      return {
        campo: item.campo,
        dadoAtual: item.atual || '—',
        dadoEnviado: item.enviado || '—',
        diferente,
      }
    })
  }, [cliente, dados])

  const totalDiferencas = useMemo(() => {
    return linhasComparacao.filter((l) => l.diferente).length
  }, [linhasComparacao])

  const extrairMensagemErro = (err: unknown): string => {
    if (err && typeof err === 'object') {
      const anyErr = err as Record<string, unknown>
      const responseData = (anyErr.response as Record<string, unknown> | undefined)?.data as
        | Record<string, unknown>
        | undefined
      if (responseData && typeof responseData.error === 'string') {
        return responseData.error
      }
      if (typeof anyErr.message === 'string') {
        return anyErr.message
      }
    }
    if (err instanceof Error) return err.message
    return 'Falha na operação.'
  }

  const handleAprovar = async () => {
    if (!convite) return
    setProcessandoAprovacao(true)
    setErroApi(null)
    try {
      const resp = await clientesPfService.aprovarConvite(convite.id)
      toast({
        title: 'Cadastro aprovado com sucesso!',
        description: resp.mensagem || 'Dados copiados para o cliente. Situação: Completo.',
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      const msg = extrairMensagemErro(err)
      setErroApi(msg)
      const descErro =
        err &&
        typeof err === 'object' &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'Não foi possível concluir a aprovação.'
      toast({
        title: 'Erro ao aprovar cadastro',
        description: descErro,
        variant: 'destructive',
      })
    } finally {
      setProcessandoAprovacao(false)
      setConfirmandoAprovacao(false)
    }
  }

  const handleRecusar = async () => {
    if (!convite) return
    if (!motivoRecusa.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo da recusa antes de prosseguir.',
        variant: 'destructive',
      })
      return
    }

    setProcessandoRecusa(true)
    setErroApi(null)
    try {
      const resp = await clientesPfService.recusarConvite(convite.id, motivoRecusa)
      toast({
        title: 'Cadastro recusado',
        description: resp.mensagem || 'O cliente voltou para pré-cadastro.',
      })
      setRecusaConcluida(true)
      onSuccess()
    } catch (err: unknown) {
      const msg = extrairMensagemErro(err)
      setErroApi(msg)
      toast({
        title: 'Erro ao recusar cadastro',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setProcessandoRecusa(false)
    }
  }

  return (
    <ModalRevisaoCadastroClientePfView
      open={open}
      onOpenChange={onOpenChange}
      cliente={cliente}
      carregandoConvite={carregandoConvite}
      erroConvite={erroConvite}
      convite={convite}
      linhasComparacao={linhasComparacao}
      totalDiferencas={totalDiferencas}
      confirmandoAprovacao={confirmandoAprovacao}
      processandoAprovacao={processandoAprovacao}
      modoRecusa={modoRecusa}
      motivoRecusa={motivoRecusa}
      processandoRecusa={processandoRecusa}
      recusaConcluida={recusaConcluida}
      erroApi={erroApi}
      formatarDataIsoBr={formatarDataIsoBr}
      onConfirmarAprovacaoClick={() => setConfirmandoAprovacao(true)}
      onCancelarAprovacaoClick={() => setConfirmandoAprovacao(false)}
      onAprovar={handleAprovar}
      onModoRecusaClick={() => setModoRecusa(true)}
      onCancelarRecusaClick={() => {
        setModoRecusa(false)
        setMotivoRecusa('')
      }}
      onMotivoRecusaChange={setMotivoRecusa}
      onRecusar={handleRecusar}
      onGerarNovoLink={onGerarNovoLink}
    />
  )
}
