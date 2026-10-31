import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pncpService } from '../services/pncp'
import { recrutamentoService } from '../services/prestadores'
import pb from '../lib/pocketbase/client'

describe('Correções de Teste de Uso — Link Público e PNCP', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('(1) Link Público de Recrutamento', () => {
    it('deve priorizar endpoint público /backend/v1/recrutamento/link-publico/:slug sem token', async () => {
      const spySend = vi.spyOn(pb, 'send').mockResolvedValue({
        valido: true,
        link: {
          id: 'link_geral_1',
          slug: 'geral',
          titulo: 'Banco de Talentos e Especialistas — G+ Engenharia',
          disciplina_alvo: '',
          ativo: true,
          expira_em: null,
        },
      } as any)

      const link = await recrutamentoService.getLinkBySlug('geral')

      expect(spySend).toHaveBeenCalledWith('/backend/v1/recrutamento/link-publico/geral', {
        method: 'GET',
      })
      expect(link).toBeDefined()
      expect(link?.slug).toBe('geral')
      expect(link?.ativo).toBe(true)
      expect(link?.titulo).toContain('Banco de Talentos e Especialistas')
    })

    it('deve retornar null se o endpoint público falhar e fallback na coleção não encontrar', async () => {
      vi.spyOn(pb, 'send').mockRejectedValue(new Error('404 Not Found'))
      vi.spyOn(pb.collection('links_recrutamento'), 'getList').mockResolvedValue({
        items: [],
        page: 1,
        perPage: 1,
        totalItems: 0,
        totalPages: 0,
      } as any)

      const link = await recrutamentoService.getLinkBySlug('slug-inexistente')
      expect(link).toBeNull()
    })
  })

  describe('(2) Consulta PNCP', () => {
    it('deve limitar tamanhoPagina a no máximo 50 e passar formato AAAAMMDD', async () => {
      let chamadaUrl = ''
      vi.spyOn(pb, 'send').mockImplementation((url: string) => {
        chamadaUrl = url
        return Promise.resolve({
          totalRegistros: 2,
          data: [
            {
              objetoCompra: 'Contratação de serviços de engenharia civil e projetos estruturais',
              valorTotalEstimado: 250000,
              orgaoEntidade: { razaoSocial: 'Prefeitura Municipal' },
              unidadeOrgao: { ufSigla: 'CE', municipioNome: 'Fortaleza' },
            },
            {
              objetoCompra: 'Aquisição de material de expediente e papelaria',
              valorTotalEstimado: 12000,
              orgaoEntidade: { razaoSocial: 'Secretaria de Saúde' },
            },
          ],
        })
      })

      const res = await pncpService.consultarContratacoes({
        termo: 'engenharia',
        tamanhoPagina: 100, // Deve ser limitado para 50
        dataInicial: '20261020',
        dataFinal: '20261027',
      })

      expect(chamadaUrl).toContain('tamanhoPagina=50')
      expect(chamadaUrl).toContain('dataInicial=20261020')
      expect(chamadaUrl).toContain('dataFinal=20261027')
      expect(res.success).toBe(true)
      // Deve filtrar 'engenharia' no objetoCompra, retornando apenas o primeiro
      expect(res.items.length).toBe(1)
      expect(res.items[0].objetoCompra).toContain('engenharia')
    })
  })
})
