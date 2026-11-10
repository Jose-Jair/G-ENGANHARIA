/**
 * Mapeamento puro da sincronização do "espelho" empresa ↔ cliente PF.
 *
 * A coleção `empresas` tem registros espelho dos clientes pessoa física
 * (tipo_cliente='pf', cliente_pf_ref → clientes_pf), usados pela visão
 * unificada PJ/PF. Este módulo documenta e testa o MESMO mapeamento aplicado
 * pelo hook backend `pocketbase/hooks/clientes_pf_espelho.js`
 * (onRecordAfterUpdateSuccess de clientes_pf), que é o ponto ÚNICO de
 * sincronização — cobre tanto a aprovação pelo link público (rota /aprovar,
 * que grava o nome já formatado no cliente) quanto a edição interna.
 */

/** Campos do cliente PF que, quando mudam, são sincronizados no espelho. */
export const CAMPOS_ESPELHO_CLIENTE_PF = [
  'nome',
  'cpf',
  'email',
  'telefone',
  'telefones',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'municipio',
  'uf',
] as const

export type CampoEspelho = (typeof CAMPOS_ESPELHO_CLIENTE_PF)[number]

/** Payload parcial a gravar no registro espelho de empresas (null = nada a fazer). */
export interface PayloadEspelhoEmpresas {
  razao_social?: string
  nome_fantasia?: string
  cnpj?: string
  email?: string
  telefone?: string
  telefones?: unknown[]
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
}

export interface DadosClientePfParaEspelho {
  nome?: string
  cpf?: string
  email?: string
  telefone?: string
  telefones?: unknown[]
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  [key: string]: unknown
}

/** Somente dígitos (usado para comparar CPF do cliente com cnpj do espelho). */
export function soDigitosEspelho(v: unknown): string {
  return (v || '').toString().replace(/\D/g, '')
}

/**
 * Constrói o payload de atualização do espelho empresas a partir do estado
 * JÁ normalizado do cliente PF (nome formatado com formatarNomeProprio pelo
 * fluxo de aprovação/edição — aqui não se reformata nada).
 *
 * Regras:
 * - nome → razao_social + nome_fantasia (somente quando o nome veio);
 * - cpf → cnpj (somente dígitos; não mexe quando o CPF não veio);
 * - contato/endereço copiados quando presentes nos dados do cliente;
 * - null quando NENHUM campo mapeado mudou (evita update redundante).
 */
export function construirEspelhoEmpresasDoClientePf(
  cliente: DadosClientePfParaEspelho,
  espelhoAtual: Record<string, unknown>,
): PayloadEspelhoEmpresas | null {
  const payload: PayloadEspelhoEmpresas = {}

  // Nome → razao_social + nome_fantasia
  const nome = (cliente.nome || '').toString().trim()
  const razaoAtual = ((espelhoAtual.razao_social as string) || '').toString().trim()
  if (nome && nome !== razaoAtual) {
    payload.razao_social = nome
    payload.nome_fantasia = nome
  }

  // CPF → cnpj (apenas dígitos; espelho guarda no campo cnpj)
  const cpfCliente = soDigitosEspelho(cliente.cpf)
  const cnpjEspelho = soDigitosEspelho(espelhoAtual.cnpj)
  if (cpfCliente && cpfCliente !== cnpjEspelho) {
    payload.cnpj = cpfCliente
  }

  // Contato e endereço
  const CAMPOS_CONTATO = [
    'email',
    'telefone',
    'cep',
    'logradouro',
    'numero',
    'complemento',
    'bairro',
    'municipio',
    'uf',
  ] as const
  for (const campo of CAMPOS_CONTATO) {
    const valor = cliente[campo]
    if (valor === undefined || valor === null) continue
    const normalizado =
      campo === 'uf' ? valor.toString().trim().toUpperCase() : valor.toString().trim()
    if (normalizado !== ((espelhoAtual[campo] as string) || '').toString().trim()) {
      ;(payload as Record<string, unknown>)[campo] = normalizado
    }
  }

  return Object.keys(payload).length > 0 ? payload : null
}
