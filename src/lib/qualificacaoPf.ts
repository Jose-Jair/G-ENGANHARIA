import { ClientePfRecord } from '@/types'
import { ESTADOS_CIVIL_COM_REGIME } from '@/components/clientesPf/cadastroClientePfConstants'

/**
 * Montagem da qualificação do contratante pessoa física (B2b).
 * Padrão único usado no contrato e na proposta:
 * '{NOME}, {nacionalidade}, {estado civil}[, sob o regime de {regime de bens}],
 *  {profissão}, portador(a) do RG nº {rg} {órgão}/{UF}, inscrito(a) no CPF sob o nº {cpf},
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

const REGIME_APENAS_PARA = ESTADOS_CIVIL_COM_REGIME

export function montarQualificacaoPf(cliente: ClientePfRecord): QualificacaoPf {
  const faltando: string[] = []

  const nome = texto(cliente?.nome)
  const nacionalidade = texto(cliente?.nacionalidade)
  const estadoCivil = texto(cliente?.estado_civil)
  const regimeBens = texto(cliente?.regime_bens)
  const profissao = texto(cliente?.profissao)
  const rg = texto(cliente?.rg)
  const rgOrgao = texto(cliente?.rg_orgao_emissor)
  const rgUf = texto(cliente?.rg_uf)
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
  if (!rg) faltando.push('número do RG')
  if (!rgOrgao || !rgUf) faltando.push('órgão emissor/UF do RG')
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

  // Regra do regime de bens: só entra para casado(a)/união estável E regime preenchido
  const usaRegime = REGIME_APENAS_PARA.includes(estadoCivil) && Boolean(regimeBens)
  if (REGIME_APENAS_PARA.includes(estadoCivil) && !regimeBens) {
    faltando.push('regime de bens (casado(a)/união estável)')
  }

  const partes: string[] = []
  if (nome) partes.push(nome)
  else faltando.unshift('nome')
  if (nacionalidade) partes.push(nacionalidade)
  if (estadoCivil) partes.push(estadoCivil)
  if (usaRegime) partes.push(`sob o regime de ${regimeBens}`)
  if (profissao) partes.push(profissao)
  if (rg) {
    const orgaoUf = rgOrgao && rgUf ? ` ${rgOrgao}/${rgUf}` : rgOrgao ? ` ${rgOrgao}` : ''
    partes.push(`portador(a) do RG nº ${rg}${orgaoUf}`)
  }
  if (cpfFormatado) partes.push(`inscrito(a) no CPF sob o nº ${cpfFormatado}`)

  const partesEndereco: string[] = []
  if (logradouro) partesEndereco.push(logradouro)
  if (numero) partesEndereco.push(`nº ${numero}`)
  if (complemento) partesEndereco.push(complemento)
  if (bairro) partesEndereco.push(bairro)
  if (municipio || uf) partesEndereco.push(`${municipio}${uf ? `/${uf}` : ''}`)
  if (cep) partesEndereco.push(`CEP ${cep}`)

  if (partesEndereco.length > 0) {
    partes.push(`residente e domiciliado(a) em ${partesEndereco.join(', ')}`)
  }

  return {
    texto: partes.join(', '),
    faltando,
  }
}
