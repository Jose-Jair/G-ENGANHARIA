/**
 * Utilitários e regras de negócio para mapeamento e normalização dos dados enviados
 * pelo cliente no cadastro público antes da gravação e aprovação em clientes_pf.
 */

export interface DadosEnviadosClientePf {
  doc_tipo?: string
  doc_tipo_outro?: string
  cpf?: string
  rg?: string
  rg_orgao_emissor?: string
  rg_uf?: string
  estado_civil?: string
  regime_bens?: string
  profissao?: string
  nacionalidade?: string
  data_nascimento?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  telefone?: string
  email?: string
  aceite_lgpd?: boolean
  submetido_em?: string
  [key: string]: unknown
}

export interface ClientePfExistente {
  id?: string
  cpf?: string
  rg?: string
  doc_tipo?: string
  nome?: string
  [key: string]: unknown
}

export function soDigitos(v: unknown): string {
  return (v || '').toString().replace(/\D/g, '')
}

/**
 * Normaliza data de nascimento para o formato aceito pelo PocketBase ('AAAA-MM-DD').
 * Aceita:
 * - 'AAAA-MM-DD' (ex: '1995-06-01')
 * - 'DD/MM/AAAA' (ex: '01/06/1995')
 * - 'DD-MM-AAAA' (ex: '01-06-1995')
 * Retorna string vazia ou lança/invalida se não conseguir normalizar.
 */
export function normalizarDataNascimento(raw: string | undefined | null): string {
  if (!raw) return ''
  const limpo = raw.trim()
  if (!limpo) return ''

  // Formato ISO 'AAAA-MM-DD'
  const isoMatch = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(limpo)
  if (isoMatch) {
    const [, ano, mes, dia] = isoMatch
    const y = parseInt(ano, 10)
    const m = parseInt(mes, 10)
    const d = parseInt(dia, 10)
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }
  }

  // Formato BR 'DD/MM/AAAA' ou 'DD-MM-AAAA'
  const brMatch = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(limpo)
  if (brMatch) {
    const [, dia, mes, ano] = brMatch
    const y = parseInt(ano, 10)
    const m = parseInt(mes, 10)
    const d = parseInt(dia, 10)
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }
  }

  return ''
}

/**
 * Normaliza data/hora para o formato seguro aceito pelo campo date do PocketBase:
 * 'AAAA-MM-DD HH:mm:ss.000Z'
 */
export function normalizarDataHoraPb(d: Date = new Date()): string {
  return d.toISOString().replace('T', ' ')
}

export interface CamposAtualizacaoClientePf {
  cpf?: string
  rg?: string
  doc_tipo?: string
  doc_tipo_outro?: string
  rg_orgao_emissor?: string
  rg_uf?: string
  estado_civil?: string
  regime_bens?: string
  profissao?: string
  nacionalidade?: string
  data_nascimento?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  telefone?: string
  email?: string
  consentimento_lgpd: boolean
  data_consentimento: string
  cadastro_status: string
}

/**
 * Mapeia os dados enviados pelo cliente para os campos a serem atualizados no registro do cliente.
 * Respeita a regra A4:
 * - Se o cliente já tiver CPF igual (apenas dígitos), NÃO inclui `cpf` no objeto de atualização.
 * - Se doc_tipo for 'CIN', rg recebe o CPF (apenas dígitos); se o cliente já tiver RG igual, não seta.
 */
/**
 * Extrai dados enviados de forma segura, suportando tanto string JSON (como o JSVM
 * do PocketBase entrega via getString) quanto objeto já parseado.
 */
export function extrairDadosEnviadosSeguro(rawOuObjeto: unknown): DadosEnviadosClientePf {
  if (!rawOuObjeto) return {}
  if (typeof rawOuObjeto === 'string') {
    try {
      const parsed = JSON.parse(rawOuObjeto)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  if (typeof rawOuObjeto === 'object') {
    return rawOuObjeto as DadosEnviadosClientePf
  }
  return {}
}

export function mapearDadosAprovacaoClientePf(
  dados: DadosEnviadosClientePf,
  clienteExistente?: ClientePfExistente,
): CamposAtualizacaoClientePf {
  const cpfNovo = soDigitos(dados.cpf)
  const cpfAtual = soDigitos(clienteExistente?.cpf)

  const campos: CamposAtualizacaoClientePf = {
    consentimento_lgpd: true,
    data_consentimento: normalizarDataHoraPb(),
    cadastro_status: 'completo',
  }

  // Regra A4: Só atualiza CPF se o cliente existente NÃO possuir o mesmo CPF já gravado
  if (cpfNovo && cpfNovo !== cpfAtual) {
    campos.cpf = cpfNovo
  }

  const docTipo = dados.doc_tipo || 'RG'
  campos.doc_tipo = docTipo

  if (dados.doc_tipo_outro !== undefined) {
    campos.doc_tipo_outro = dados.doc_tipo_outro || ''
  }

  // CIN usa como número o próprio CPF (11 dígitos)
  const rgFinal = docTipo === 'CIN' ? cpfNovo : (dados.rg || '').toString().trim()
  const rgAtual = soDigitos(clienteExistente?.rg)

  if (docTipo === 'CIN') {
    if (rgFinal && rgFinal !== rgAtual) {
      campos.rg = rgFinal
    }
  } else if (rgFinal) {
    campos.rg = rgFinal
  }

  if (dados.rg_orgao_emissor) campos.rg_orgao_emissor = dados.rg_orgao_emissor.trim()
  if (dados.rg_uf) campos.rg_uf = dados.rg_uf.trim().toUpperCase()
  if (dados.estado_civil) campos.estado_civil = dados.estado_civil.trim().toLowerCase()
  if (dados.regime_bens) campos.regime_bens = dados.regime_bens.trim()
  if (dados.profissao) campos.profissao = dados.profissao.trim()
  if (dados.nacionalidade) campos.nacionalidade = dados.nacionalidade.trim()

  const dataNascimentoNorm = normalizarDataNascimento(dados.data_nascimento)
  if (dataNascimentoNorm) {
    campos.data_nascimento = dataNascimentoNorm
  }

  if (dados.cep) campos.cep = dados.cep.trim()
  if (dados.logradouro) campos.logradouro = dados.logradouro.trim()
  if (dados.numero) campos.numero = dados.numero.trim()
  if (dados.complemento !== undefined) campos.complemento = (dados.complemento || '').trim()
  if (dados.bairro) campos.bairro = dados.bairro.trim()
  if (dados.municipio) campos.municipio = dados.municipio.trim()
  if (dados.uf) campos.uf = dados.uf.trim().toUpperCase()
  if (dados.telefone) campos.telefone = dados.telefone.trim()
  if (dados.email) campos.email = dados.email.trim().toLowerCase()

  return campos
}
