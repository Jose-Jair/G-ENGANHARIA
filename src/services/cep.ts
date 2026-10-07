/**
 * Serviço de integração com serviços públicos de CEP e Localidades
 * - ViaCEP (https://viacep.com.br/ws/{cep}/json/) — busca de logradouro, bairro, município e UF
 * - API IBGE Localidades — UFs e Municípios para fallback manual ("Não sei o CEP")
 */

export interface ViaCepResponse {
  cep?: string
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
  ibge?: string
  gia?: string
  ddd?: string
  siafi?: string
  erro?: boolean | string
}

export interface EnderecoCepResult {
  cep: string
  logradouro: string
  bairro: string
  municipio: string
  uf: string
  complemento?: string
}

export interface IbgeUf {
  id: number
  sigla: string
  nome: string
}

export interface IbgeMunicipio {
  id: number
  nome: string
}

export const ESTADOS_BRASIL: Array<{ sigla: string; nome: string }> = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]

// Cache em memória para municípios de UFs já consultadas
const cacheMunicipiosPorUf: Record<string, string[]> = {}

export const cepService = {
  /**
   * Limpa formatação do CEP deixando apenas dígitos
   */
  cleanCep(val: string | undefined | null): string {
    if (!val) return ''
    return val.replace(/\D/g, '')
  },

  /**
   * Formata CEP no formato 00000-000
   */
  formatCep(val: string | undefined | null): string {
    const clean = this.cleanCep(val)
    if (!clean) return ''
    if (clean.length <= 5) return clean
    return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`
  },

  /**
   * Consulta endereço completo pelo CEP na ViaCEP (API pública, sem autenticação)
   */
  async consultarCep(cepRaw: string): Promise<EnderecoCepResult | null> {
    const clean = this.cleanCep(cepRaw)
    if (clean.length !== 8) {
      throw new Error('CEP deve conter exatamente 8 dígitos numéricos.')
    }

    let res: Response
    try {
      res = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
        headers: { Accept: 'application/json' },
      })
    } catch {
      throw new Error('Falha de conexão com o serviço ViaCEP. Preencha os campos manualmente.')
    }

    if (!res.ok) {
      throw new Error(`Serviço ViaCEP indisponível (código ${res.status}). Preencha manualmente.`)
    }

    const data: ViaCepResponse = await res.json()
    if (data.erro === true || data.erro === 'true') {
      throw new Error(
        'CEP não localizado na base dos Correios. Verifique o número ou preencha manualmente.',
      )
    }

    return {
      cep: this.formatCep(data.cep || clean),
      logradouro: (data.logradouro || '').trim(),
      bairro: (data.bairro || '').trim(),
      municipio: (data.localidade || '').trim(),
      uf: (data.uf || '').toUpperCase().trim(),
      complemento: (data.complemento || '').trim(),
    }
  },

  /**
   * Lista todos os municípios de uma UF usando a API pública do IBGE
   * https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios
   */
  async listarMunicipiosPorUf(uf: string): Promise<string[]> {
    const cleanUf = (uf || '').toUpperCase().trim()
    if (!cleanUf || cleanUf.length !== 2) return []

    if (cacheMunicipiosPorUf[cleanUf]) {
      return cacheMunicipiosPorUf[cleanUf]
    }

    try {
      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${cleanUf}/municipios?orderBy=nome`,
        { headers: { Accept: 'application/json' } },
      )
      if (!res.ok) return []
      const lista: IbgeMunicipio[] = await res.json()
      const nomes = lista.map((m) => m.nome).filter(Boolean)
      cacheMunicipiosPorUf[cleanUf] = nomes
      return nomes
    } catch {
      return []
    }
  },
}
