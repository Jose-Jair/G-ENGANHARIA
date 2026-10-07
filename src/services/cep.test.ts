import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cepService } from './cep'

describe('cepService', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('formata e limpa CEP corretamente', () => {
    expect(cepService.cleanCep('01310-100')).toBe('01310100')
    expect(cepService.cleanCep('abc 01.310-100')).toBe('01310100')
    expect(cepService.formatCep('01310100')).toBe('01310-100')
    expect(cepService.formatCep('01310')).toBe('01310')
  })

  it('consulta CEP com sucesso na ViaCEP', async () => {
    const mockResponse = {
      cep: '01310-100',
      logradouro: 'Avenida Paulista',
      complemento: 'de 611 a 1045 - lado ímpar',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as any

    const res = await cepService.consultarCep('01310-100')
    expect(res).not.toBeNull()
    expect(res?.cep).toBe('01310-100')
    expect(res?.logradouro).toBe('Avenida Paulista')
    expect(res?.municipio).toBe('São Paulo')
    expect(res?.uf).toBe('SP')
  })

  it('lança erro descritivo quando CEP não é localizado (erro: true)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ erro: true }),
    }) as any

    await expect(cepService.consultarCep('99999-999')).rejects.toThrow(
      'CEP não localizado na base dos Correios',
    )
  })

  it('lança erro quando ViaCEP está fora do ar sem travar a aplicação', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(cepService.consultarCep('01310100')).rejects.toThrow(
      'Falha de conexão com o serviço ViaCEP',
    )
  })

  it('lista municípios por UF via API pública do IBGE', async () => {
    const mockMunicipios = [
      { id: 3550308, nome: 'São Paulo' },
      { id: 3509502, nome: 'Campinas' },
    ]

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMunicipios,
    }) as any

    const municipios = await cepService.listarMunicipiosPorUf('SP')
    expect(municipios).toEqual(['São Paulo', 'Campinas'])
  })
})
