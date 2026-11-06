import { ClientePfRecord } from '@/types'

/**
 * Montagem da qualificação do contratante pessoa física (B2b).
 * Padrão único usado no contrato e na proposta:
 * '{NOME}, {nacionalidade}, {estado civil}, {profissão},
 *  portador(a) do {documento} nº {número} {órgão}/{UF}, inscrito(a) no CPF sob o nº {cpf},
 *  residente e domiciliado(a) em {logradouro}, nº {número}[, {complemento}],
 *  {bairro}, {município}/{UF}, CEP {cep}'
 */

export interface QualificacaoPf {
  texto: string
  /** Dados ausentes, em português, item a item */
  faltando: string[]
}

const limpar = (v: unknown): string =>
  String(v ?? '')
    .replace(/[^\d]/g, '')
    .trim()

export function formatarCpfPf(cpf: string): string {
  const digitos = limpar(cpf)
  if (digitos.length !== 11) return (cpf || '').trim()
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`
}

const texto = (v: unknown): string => String(v ?? '').trim()

/**
 * Monta o trecho do documento de identificação com o artigo e formato gramatical correto:
 * - CIN: 'portador(a) da Carteira de Identidade Nacional' (não repete o número)
 * - Se número do documento for igual ao CPF (apenas dígitos):
 *     CIN → 'portador(a) da Carteira de Identidade Nacional'
 *     RG  → 'portador(a) do RG {órgão}/{UF}'
 * - RG normal: 'portador(a) do RG nº X SSP/CE'
 * - CNH: 'portador(a) da CNH nº X DETRAN/CE'
 * - Carteira profissional: 'portador(a) da carteira profissional nº X CREA/CE'
 * - Outro: 'portador(a) do documento {doc_tipo_outro} nº X {órgão}/{UF}'
 */
export function flexionarPortador(genero?: string): string {
  const g = (genero || '').trim().toLowerCase()
  if (g === 'masculino') return 'portador'
  if (g === 'feminino') return 'portadora'
  return 'portador(a)'
}

export function flexionarInscrito(genero?: string): string {
  const g = (genero || '').trim().toLowerCase()
  if (g === 'masculino') return 'inscrito'
  if (g === 'feminino') return 'inscrita'
  return 'inscrito(a)'
}

export function flexionarResidente(genero?: string): string {
  const g = (genero || '').trim().toLowerCase()
  if (g === 'masculino') return 'residente e domiciliado'
  if (g === 'feminino') return 'residente e domiciliada'
  return 'residente e domiciliado(a)'
}

export function flexionarNacionalidade(nacionalidade: string, genero?: string): string {
  const nac = (nacionalidade || '').trim()
  if (!nac) return ''
  const g = (genero || '').trim().toLowerCase()
  const nacLower = nac.toLowerCase()
  const ehBrasileiro = nacLower === 'brasileiro' || nacLower === 'brasileira'

  if (g === 'masculino') {
    return ehBrasileiro ? 'brasileiro' : nacLower
  }
  if (g === 'feminino') {
    return ehBrasileiro ? 'brasileira' : nacLower
  }
  // Sem gênero: manter a forma neutra atual com '(a)' e 'de nacionalidade {nacionalidade}'
  // Se for brasileiro/brasileira, a forma neutra padrão é 'de nacionalidade brasileira' ou 'de nacionalidade {nacionalidade}'
  return `de nacionalidade ${nacLower}`
}

export function flexionarEstadoCivil(estadoCivil: string, genero?: string): string {
  const ec = (estadoCivil || '').trim().toLowerCase()
  if (!ec) return ''
  const g = (genero || '').trim().toLowerCase()

  if (ec.includes('união estável') || ec.includes('uniao estavel')) {
    return 'em união estável'
  }

  if (g === 'masculino') {
    if (ec.startsWith('solteir')) return 'solteiro'
    if (ec.startsWith('casad')) return 'casado'
    if (ec.startsWith('divorciad')) return 'divorciado'
    if (ec.startsWith('separad')) return 'separado'
    if (ec.startsWith('viúv') || ec.startsWith('viuv')) return 'viúvo'
    return ec
  }

  if (g === 'feminino') {
    if (ec.startsWith('solteir')) return 'solteira'
    if (ec.startsWith('casad')) return 'casada'
    if (ec.startsWith('divorciad')) return 'divorciada'
    if (ec.startsWith('separad')) return 'separada'
    if (ec.startsWith('viúv') || ec.startsWith('viuv')) return 'viúva'
    return ec
  }

  // Sem gênero: mantém a forma neutra atual com '(a)'
  if (ec.startsWith('solteir')) return 'solteiro(a)'
  if (ec.startsWith('casad')) return 'casado(a)'
  if (ec.startsWith('divorciad')) return 'divorciado(a)'
  if (ec.startsWith('separad')) return 'separado(a)'
  if (ec.startsWith('viúv') || ec.startsWith('viuv')) return 'viúvo(a)'
  return ec
}

/**
 * Monta o trecho do documento de identificação com o artigo e formato gramatical correto:
 * - CIN: '{portador/portadora/portador(a)} da Carteira de Identidade Nacional'
 * - RG: '{portador/portadora/portador(a)} do RG nº X SSP/CE'
 * - CNH: '{portador/portadora/portador(a)} da CNH nº X DETRAN/CE'
 * - Carteira profissional: '{portador/portadora/portador(a)} da carteira profissional nº X CREA/CE'
 * - Outro: '{portador/portadora/portador(a)} do documento {doc_tipo_outro} nº X {órgão}/{UF}'
 */
export function montarTrechoDocumentoIdentificacao(
  docTipo: string,
  docTipoOutro: string,
  numero: string,
  orgao: string,
  uf: string,
  cpf?: string,
  genero?: string,
): string {
  const tipo = (docTipo || '').trim()
  const orgaoUf = orgao && uf ? ` ${orgao}/${uf}` : orgao ? ` ${orgao}` : uf ? ` /${uf}` : ''
  const termoPortador = flexionarPortador(genero)

  const numDigitos = limpar(numero)
  const cpfDigitos = limpar(cpf)
  const numeroIgualAoCpf = Boolean(numDigitos && cpfDigitos && numDigitos === cpfDigitos)

  if (tipo === 'CIN' || (numeroIgualAoCpf && tipo === 'CIN')) {
    return `${termoPortador} da Carteira de Identidade Nacional`
  }

  if (numeroIgualAoCpf && (!tipo || tipo === 'RG')) {
    return `${termoPortador} do RG${orgaoUf}`
  }

  if (!numero) return ''

  if (tipo === 'CNH') {
    return `${termoPortador} da CNH nº ${numero}${orgaoUf}`
  }
  if (tipo === 'Carteira profissional') {
    return `${termoPortador} da carteira profissional nº ${numero}${orgaoUf}`
  }
  if (tipo === 'Outro') {
    const nomeDoc = (docTipoOutro || '').trim() || 'de identificação'
    return `${termoPortador} do documento ${nomeDoc} nº ${numero}${orgaoUf}`
  }
  // Padrão ou 'RG': '{portador(a)} do RG nº X SSP/CE'
  return `${termoPortador} do RG nº ${numero}${orgaoUf}`
}

export function montarQualificacaoPf(cliente: ClientePfRecord): QualificacaoPf {
  const faltando: string[] = []

  const nome = texto(cliente?.nome)
  const nacionalidade = texto(cliente?.nacionalidade)
  const estadoCivil = texto(cliente?.estado_civil)
  const profissao = texto(cliente?.profissao)
  const docTipo = texto(cliente?.doc_tipo) || (cliente?.rg ? 'RG' : '')
  const docTipoOutro = texto(cliente?.doc_tipo_outro)
  const rgNumero = texto(cliente?.rg)
  const rgOrgao = texto(cliente?.rg_orgao_emissor || cliente?.orgao_emissor)
  const rgUf = texto(cliente?.rg_uf || cliente?.uf_rg)
  const cpfFormatado = formatarCpfPf(cliente?.cpf || '')
  const logradouro = texto(cliente?.logradouro)
  const numero = texto(cliente?.numero)
  const complemento = texto(cliente?.complemento)
  const bairro = texto(cliente?.bairro)
  const municipio = texto(cliente?.municipio)
  const uf = texto(cliente?.uf)
  const cep = texto(cliente?.cep)

  if (!nacionalidade) faltando.push('nacionalidade')
  if (!estadoCivil) faltando.push('estado civil')
  if (!profissao) faltando.push('profissão')
  if (!docTipo) faltando.push('tipo de documento de identificação')
  if (docTipo === 'Outro' && !docTipoOutro) faltando.push('especificação do documento')
  if (!rgNumero) faltando.push('número do documento')
  if (!rgOrgao || !rgUf) faltando.push('órgão emissor/UF do documento')
  if (!cpfFormatado) faltando.push('CPF')
  if (!logradouro) faltando.push('logradouro do endereço')
  if (!numero) faltando.push('número do endereço')
  if (!bairro) faltando.push('bairro do endereço')
  if (!municipio) faltando.push('município do endereço')
  if (!uf) faltando.push('UF do endereço')
  if (!cep) faltando.push('CEP do endereço')
  if ((cliente?.cadastro_status || '') !== 'completo') {
    const statusAtual = texto(cliente?.cadastro_status) || 'não informado'
    faltando.push(`cadastro completo (status atual: ${statusAtual})`)
  }

  const genero = texto(cliente?.genero)
  const termoInscrito = flexionarInscrito(genero)
  const termoResidente = flexionarResidente(genero)
  const nacFlex = flexionarNacionalidade(nacionalidade, genero)
  const ecFlex = flexionarEstadoCivil(estadoCivil, genero)

  const partes: string[] = []
  if (nome) partes.push(nome)
  else faltando.unshift('nome')
  if (nacFlex) partes.push(nacFlex)
  if (ecFlex) partes.push(ecFlex)
  if (profissao) partes.push(profissao)
  if (rgNumero) {
    const trechoDoc = montarTrechoDocumentoIdentificacao(
      docTipo || 'RG',
      docTipoOutro,
      rgNumero,
      rgOrgao,
      rgUf,
      cliente?.cpf,
      genero,
    )
    if (trechoDoc) partes.push(trechoDoc)
  }
  if (cpfFormatado) partes.push(`${termoInscrito} no CPF sob o nº ${cpfFormatado}`)

  const partesEndereco: string[] = []
  if (logradouro) partesEndereco.push(logradouro)
  if (numero) partesEndereco.push(`nº ${numero}`)
  if (complemento) partesEndereco.push(complemento)
  if (bairro) partesEndereco.push(bairro)
  if (municipio || uf) partesEndereco.push(`${municipio}${uf ? `/${uf}` : ''}`)
  if (cep) partesEndereco.push(`CEP ${cep}`)

  if (partesEndereco.length > 0) {
    partes.push(`${termoResidente} em ${partesEndereco.join(', ')}`)
  }

  return {
    texto: partes.join(', '),
    faltando,
  }
}
