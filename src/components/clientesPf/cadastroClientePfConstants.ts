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

/** Opções com value e label para componentes select */
export const ESTADOS_CIVIS_OPTIONS: Array<{ value: EstadoCivilOpcao; label: string }> = [
  { value: 'solteiro(a)', label: 'Solteiro(a)' },
  { value: 'casado(a)', label: 'Casado(a)' },
  { value: 'união estável', label: 'União estável' },
  { value: 'divorciado(a)', label: 'Divorciado(a)' },
  { value: 'separado(a)', label: 'Separado(a)' },
  { value: 'viúvo(a)', label: 'Viúvo(a)' },
]

/** Siglas das UFs do Brasil para selects */
export const UFS_BRASIL = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

/** Tipos de documento de identificação aceitos */
export const OPCOES_DOC_TIPO = ['RG', 'CNH', 'Carteira profissional', 'Outro'] as const
export type DocTipoOpcao = (typeof OPCOES_DOC_TIPO)[number]

export const DOC_TIPOS_OPTIONS: Array<{ value: DocTipoOpcao; label: string }> = [
  { value: 'RG', label: 'RG' },
  { value: 'CNH', label: 'CNH' },
  { value: 'Carteira profissional', label: 'Carteira profissional (CREA, CAU, OAB...)' },
  { value: 'Outro', label: 'Outro' },
]

/** Estados civis que anteriormente vinculavam regime de bens (mantido para compatibilidade histórica, não usado na UI) */
export const ESTADOS_CIVIL_COM_REGIME: string[] = ['casado(a)', 'união estável']

/** Texto curto do aceite LGPD na tela pública (obrigatório) */
export const TEXTO_ACEITE_LGPD_PUBLICO =
  'Autorizo o tratamento dos meus dados pessoais pela G+ ENGENHARIA para finalidade de cadastro, ' +
  'contratação e prestação de serviços de engenharia, conforme a Lei Geral de Proteção de Dados ' +
  '(LGPD — Lei 13.709/2018).'

/** Mensagem exata exigida quando o backend recusa por CPF duplicado */
export const MENSAGEM_CPF_DUPLICADO = 'Este CPF já está cadastrado. Fale com a G+ ENGENHARIA.'
