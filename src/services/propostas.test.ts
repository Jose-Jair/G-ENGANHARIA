import { describe, it, expect } from 'vitest'
import { propostasService } from './propostas'

describe('propostasService - Novo Modelo de Precificação e Nota Fiscal', () => {
  describe('calcularTotais', () => {
    it('com nota desligada (padrão): impostos não são aplicados e preço total = preço base', () => {
      // Exemplo: Custo direto 20.000, preço de venda itens catálogo 30.000, impostos 16.5%, requerNota = false
      const resultado = propostasService.calcularTotais(20000, 35, 16.5, 30000, false)

      expect(resultado.custo).toBe(20000)
      expect(resultado.precoVendaSemImpostos).toBe(30000)
      expect(resultado.valorImpostos).toBe(0)
      expect(resultado.precoTotal).toBe(30000)
      expect(resultado.margemEfetivaValor).toBe(10000)
      // Margem efetiva % = (10.000 / 30.000) * 100 = 33.3%
      expect(resultado.margemEfetivaPercent).toBe(33.3)
    })

    it('com nota ligada: impostos são aplicados sobre o preço de venda dos itens', () => {
      // Exemplo: Custo direto 20.000, preço de venda itens catálogo 30.000, impostos 10%, requerNota = true
      const resultado = propostasService.calcularTotais(20000, 35, 10, 30000, true)

      expect(resultado.custo).toBe(20000)
      expect(resultado.precoVendaSemImpostos).toBe(30000)
      expect(resultado.valorImpostos).toBe(3000) // 10% de 30.000
      expect(resultado.precoTotal).toBe(33000)
      expect(resultado.margemEfetivaValor).toBe(10000)
    })

    it('compatibilidade com propostas legadas sem precoVendaBase fornecido', () => {
      // Modo legado: precoVendaBase não informado, calcula baseado em custo + margemPercent
      const resultado = propostasService.calcularTotais(10000, 20, 10, undefined, true)

      // Base venda = 10000 + 20% = 12000
      expect(resultado.precoVendaSemImpostos).toBe(12000)
      expect(resultado.valorImpostos).toBe(1200) // 10% de 12000
      expect(resultado.precoTotal).toBe(13200)
      expect(resultado.margemEfetivaValor).toBe(2000)
    })

    it('quando custo direto for zero (apenas preço de venda informado)', () => {
      const resultado = propostasService.calcularTotais(0, 0, 16.5, 15000, false)

      expect(resultado.custo).toBe(0)
      expect(resultado.precoVendaSemImpostos).toBe(15000)
      expect(resultado.valorImpostos).toBe(0)
      expect(resultado.precoTotal).toBe(15000)
      expect(resultado.margemEfetivaValor).toBe(15000)
      expect(resultado.margemEfetivaPercent).toBe(100)
    })
  })

  describe('avaliarAlcada com margem efetiva e custo informado', () => {
    it('aprovação autônoma do Comercial quando dentro do teto e margem >= 20%', () => {
      const aval = propostasService.avaliarAlcada(80000, 25, 100000, 20, true)
      expect(aval.requerAdmin).toBe(false)
      expect(aval.motivoAlcada).toContain('Dentro da alçada autônoma')
    })

    it('requer Admin quando valor acima de R$ 100 mil', () => {
      const aval = propostasService.avaliarAlcada(120000, 25, 100000, 20, true)
      expect(aval.requerAdmin).toBe(true)
      expect(aval.motivoAlcada).toContain('superior à alçada comercial')
    })

    it('requer Admin quando margem efetiva abaixo do piso de 20%', () => {
      const aval = propostasService.avaliarAlcada(50000, 15, 100000, 20, true)
      expect(aval.requerAdmin).toBe(true)
      expect(aval.motivoAlcada).toContain('inferior ao piso mínimo')
    })

    it('quando custo NÃO for informado, avalia alçada estritamente pelo valor total', () => {
      // Margem informada é 0%, mas custoInformado = false -> não deve barrar por margem baixa
      const avalAbaixoTeto = propostasService.avaliarAlcada(90000, 0, 100000, 20, false)
      expect(avalAbaixoTeto.requerAdmin).toBe(false)
      expect(avalAbaixoTeto.motivoAlcada).toContain('por valor total')

      const avalAcimaTeto = propostasService.avaliarAlcada(150000, 0, 100000, 20, false)
      expect(avalAcimaTeto.requerAdmin).toBe(true)
      expect(avalAcimaTeto.motivoAlcada).toContain('superior à alçada comercial')
    })
  })
})
