import { formatarCpfPf, montarQualificacaoPf } from './qualificacaoPf'
import { formatCnpj } from './cnpj'

export interface SnapshotContratada {
  nome: string
  cnpj: string
  email: string
  endereco: string
  telefone: string
  responsavel_tecnico: string
  slogan: string
  texto_qualificacao: string
}

export interface SnapshotContratante {
  tipo: 'pf' | 'pj'
  nome: string
  documento: string
  endereco: string
  texto_qualificacao: string
}

export interface SnapshotSignatario {
  nome: string
  qualificacao: string
  documento: string
  data_assinatura: string
  ip: string
  hash: string
}

export interface SnapshotParcela {
  ordem?: number
  percentual?: number
  valor?: number
  gatilho?: string
  descricao?: string
}

export interface SnapshotAssinaturaContrato {
  versao_schema: number
  contrato_id: string
  contrato_numero: string
  proposta_numero?: string
  gerado_em: string
  contratada: SnapshotContratada
  contratante: SnapshotContratante
  objeto: string
  escopo: string
  prazo_dias: number
  nota_prazo: string
  valor_total: number
  parcelas: SnapshotParcela[]
  clausulas_texto: string
  signatarios: {
    admin: SnapshotSignatario
    cliente: SnapshotSignatario
  }
}

export const DADOS_CONTRATADA_PADRAO: SnapshotContratada = {
  nome: 'GMAIS ENGENHARIA LTDA',
  cnpj: '66.862.835/0001-69',
  email: 'grupomais.sae@gmail.com',
  endereco: 'Av. Juvenco Gomes de Freitas, 354, Planalto Nelândia, Tauá – CE, CEP 63.660-000',
  telefone: '(88) 92188-6547',
  responsavel_tecnico: 'Eng. Civil José Jair Oliveira Alves, CREA-CE 346391',
  slogan: 'Conectando ideias, somando resultados',
  texto_qualificacao:
    'GMAIS ENGENHARIA LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 66.862.835/0001-69, com sede na Av. Juvenco Gomes de Freitas, 354, Planalto Nelândia, Tauá – CE, CEP 63.660-000, neste ato representada por seu Responsável Técnico Eng. Civil José Jair Oliveira Alves, CREA-CE 346391',
}

export function montarQualificacaoPj(dados: {
  razao_social?: string
  nome_fantasia?: string
  cnpj?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
}): string {
  const nome = (dados.razao_social || dados.nome_fantasia || '').trim() || 'Contratante PJ'
  const cnpjFormatado = dados.cnpj ? formatCnpj(dados.cnpj) : 'Não informado'

  const partesEndereco: string[] = []
  if (dados.logradouro) partesEndereco.push(dados.logradouro.trim())
  if (dados.numero) partesEndereco.push(`nº ${dados.numero.trim()}`)
  if (dados.complemento) partesEndereco.push(dados.complemento.trim())
  if (dados.bairro) partesEndereco.push(dados.bairro.trim())
  if (dados.municipio || dados.uf) {
    partesEndereco.push(`${dados.municipio || ''}${dados.uf ? `/${dados.uf}` : ''}`.trim())
  }
  if (dados.cep) partesEndereco.push(`CEP ${dados.cep.trim()}`)

  const enderecoFinal =
    partesEndereco.length > 0 ? partesEndereco.join(', ') : 'Endereço não informado'

  return `${nome}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${cnpjFormatado}, com sede em ${enderecoFinal}`
}

export function montarObjetoSnapshotContrato(params: {
  contratoId: string
  contratoNumero: string
  propostaNumero?: string
  clientePf?: any
  empresa?: any
  objeto?: string
  escopo?: string
  prazoDias?: number
  notaPrazo?: string
  valorTotal?: number
  parcelas?: SnapshotParcela[]
  clausulasTexto?: string
  signatarioAdmin: {
    nome: string
    qualificacao?: string
    documento?: string
    dataAssinatura: string
    ip: string
    hash: string
  }
  signatarioCliente: {
    nome: string
    qualificacao?: string
    documento?: string
    dataAssinatura: string
    ip: string
    hash: string
  }
  agoraIso?: string
}): SnapshotAssinaturaContrato {
  const agora = params.agoraIso || new Date().toISOString()

  let contratante: SnapshotContratante

  if (params.clientePf) {
    const qual = montarQualificacaoPf(params.clientePf)
    const endereco = [
      params.clientePf.logradouro,
      params.clientePf.numero ? `nº ${params.clientePf.numero}` : '',
      params.clientePf.complemento,
      params.clientePf.bairro,
      params.clientePf.municipio && params.clientePf.uf
        ? `${params.clientePf.municipio}/${params.clientePf.uf}`
        : params.clientePf.municipio || params.clientePf.uf || '',
      params.clientePf.cep ? `CEP ${params.clientePf.cep}` : '',
    ]
      .filter(Boolean)
      .join(', ')

    contratante = {
      tipo: 'pf',
      nome: params.clientePf.nome || 'Cliente PF',
      documento: formatarCpfPf(params.clientePf.cpf || ''),
      endereco,
      texto_qualificacao: qual.texto,
    }
  } else if (params.empresa) {
    const textoQual = montarQualificacaoPj(params.empresa)
    const endereco = [
      params.empresa.logradouro,
      params.empresa.numero ? `nº ${params.empresa.numero}` : '',
      params.empresa.complemento,
      params.empresa.bairro,
      params.empresa.municipio && params.empresa.uf
        ? `${params.empresa.municipio}/${params.empresa.uf}`
        : params.empresa.municipio || params.empresa.uf || '',
      params.empresa.cep ? `CEP ${params.empresa.cep}` : '',
    ]
      .filter(Boolean)
      .join(', ')

    contratante = {
      tipo: 'pj',
      nome: params.empresa.razao_social || params.empresa.nome_fantasia || 'Empresa Contratante',
      documento: params.empresa.cnpj ? formatCnpj(params.empresa.cnpj) : 'Não informado',
      endereco,
      texto_qualificacao: textoQual,
    }
  } else {
    contratante = {
      tipo: 'pj',
      nome: 'Contratante Não Informado',
      documento: 'Não informado',
      endereco: 'Não informado',
      texto_qualificacao: 'Contratante não qualificado',
    }
  }

  const objetoFinal =
    (params.objeto || '').trim() ||
    'Prestação de serviços técnicos especializados de engenharia consultiva e desenvolvimento de projetos executivos.'

  const escopoFinal = (params.escopo || '').trim() || objetoFinal

  const clausulasFinal =
    (params.clausulasTexto || '').trim() ||
    'CLÁUSULA 1ª — As alterações no projeto ou nas premissas solicitadas pela CONTRATANTE incorrerão em custos adicionais correspondentes às horas técnicas de retrabalho necessárias.\n\nCLÁUSULA 2ª — Os documentos e arquivos digitais são de uso exclusivo para o empreendimento objeto deste contrato.\n\nCLÁUSULA 3ª — A rescisão imotivada sujeitará a parte infratora à quitação dos serviços executados, acrescida de multa rescisória compensatória de 20% sobre o saldo remanescente.'

  const notaPrazoFinal =
    (params.notaPrazo || '').trim() ||
    'Os prazos serão contados em dias corridos a partir da data de assinatura deste contrato e da disponibilização de todos os elementos técnicos necessários.'

  return {
    versao_schema: 1,
    contrato_id: params.contratoId,
    contrato_numero: params.contratoNumero,
    proposta_numero: params.propostaNumero || '',
    gerado_em: agora,
    contratada: DADOS_CONTRATADA_PADRAO,
    contratante,
    objeto: objetoFinal,
    escopo: escopoFinal,
    prazo_dias: params.prazoDias || 30,
    nota_prazo: notaPrazoFinal,
    valor_total: params.valorTotal || 0,
    parcelas: params.parcelas || [],
    clausulas_texto: clausulasFinal,
    signatarios: {
      admin: {
        nome: params.signatarioAdmin.nome || 'Diretoria G+',
        qualificacao: params.signatarioAdmin.qualificacao || 'Diretoria G+ / Responsável Técnico',
        documento: params.signatarioAdmin.documento || 'CREA-CE 346391',
        data_assinatura: params.signatarioAdmin.dataAssinatura,
        ip: params.signatarioAdmin.ip || 'Auditado',
        hash: params.signatarioAdmin.hash,
      },
      cliente: {
        nome: params.signatarioCliente.nome,
        qualificacao: params.signatarioCliente.qualificacao || 'Contratante / Representante Legal',
        documento: params.signatarioCliente.documento,
        data_assinatura: params.signatarioCliente.dataAssinatura,
        ip: params.signatarioCliente.ip || 'Auditado',
        hash: params.signatarioCliente.hash,
      },
    },
  }
}
