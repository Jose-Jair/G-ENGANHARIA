/** Constantes compartilhadas do cadastro do Cliente PF (tela pública + formulário do dono) */

/** Opções exatas de estado civil aceitas pelo backend */
export const OPCOES_ESTADO_CIVIL = [
  'solteiro(a)',
  'casado(a)',
  'união estável',
  'divorciado(a)',
  'separado(a)',
  'viúvo(a)',
] as const

export type EstadoCivilOpcao = (typeof OPCOES_ESTADO_CIVIL)[number]

/** Estados civis que habilitam o campo opcional "regime de bens" */
export const ESTADOS_CIVIL_COM_REGIME: string[] = ['casado(a)', 'união estável']

/** Texto curto do aceite LGPD na tela pública (obrigatório) */
export const TEXTO_ACEITE_LGPD_PUBLICO =
  'Autorizo o tratamento dos meus dados pessoais pela G+ ENGENHARIA para finalidade de cadastro, ' +
  'contratação e prestação de serviços de engenharia, conforme a Lei Geral de Proteção de Dados ' +
  '(LGPD — Lei 13.709/2018).'

/** Mensagem exata exigida quando o backend recusa por CPF duplicado */
export const MENSAGEM_CPF_DUPLICADO = 'Este CPF já está cadastrado. Fale com a G+ ENGENHARIA.'
