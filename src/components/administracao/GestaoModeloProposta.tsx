import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parametrosService } from '@/services/parametros'
import { toast } from '@/hooks/use-toast'
import {
  FileText,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
} from 'lucide-react'

export interface ParcelaPadraoConfig {
  ordem: number
  percentual: number
  gatilho: 'contratacao' | 'entrega' | 'marco'
  descricao: string
}

const DEFAULT_PREMISSAS =
  '1. A CONTRATADA não se responsabiliza por eventuais paralisações, atrasos e/ou cancelamentos decorrentes de exigências imprevistas e/ou extraordinárias dos órgãos competentes, bem como decorrentes de atrasos no fornecimento de dados, informações e subsídios por parte da CONTRATANTE.\n' +
  '2. Não estão inclusos os custos de taxas dos órgãos competentes (Secretarias, Concessionárias, Vigilância Sanitária, etc.) para a aprovação dos projetos e emissão de alvarás, bem como as taxas das Anotações e Registros de Responsabilidade Técnica (ART/RRT) que deverão ser pagas pela CONTRATANTE.\n' +
  '3. Os projetos executivos serão elaborados em conformidade com as normas técnicas vigentes e com os padrões estabelecidos nas orientações da CONTRATANTE.\n' +
  '4. Estão inclusas até 2 (duas) revisões de projeto decorrentes de ajustes de concepção arquitetônica solicitadas pela CONTRATANTE, desde que não configurem alteração substancial de premissas.'

const DEFAULT_CONDICOES_GERAIS =
  'CLÁUSULA 1ª — As alterações no projeto ou nas premissas de cálculo e concepção solicitadas pela CONTRATANTE após a conclusão ou entrega das respectivas fases incorrerão em custos adicionais correspondentes às horas técnicas de retrabalho necessárias, mediante prévia estimativa e aprovação.\n\n' +
  'CLÁUSULA 2ª — Os documentos, desenhos, memoriais e arquivos digitais gerados durante a prestação dos serviços são de uso exclusivo para o empreendimento objeto desta proposta, sendo vedada sua reprodução ou cessão a terceiros sem prévia autorização formal da CONTRATADA.\n\n' +
  'CLÁUSULA 3ª — A rescisão imotivada do contrato sujeitará a parte infratora à quitação integral dos serviços já executados até a data da comunicação formal, acrescida de multa rescisória compensatória de 20% (vinte por cento) sobre o saldo remanescente do valor global do contrato.'

const DEFAULT_NOTA_PRAZO =
  'Os prazos serão contados em dias corridos, a partir da data de assinatura deste contrato e do fornecimento de todos os elementos e subsídios necessários ao desenvolvimento dos serviços.'

const DEFAULT_PARCELAS: ParcelaPadraoConfig[] = [
  {
    ordem: 1,
    percentual: 50,
    gatilho: 'contratacao',
    descricao: '50% (cinquenta por cento) na assinatura do contrato/aceite',
  },
  {
    ordem: 2,
    percentual: 50,
    gatilho: 'entrega',
    descricao: '50% (cinquenta por cento) na entrega final dos projetos executivos',
  },
]

export const GestaoModeloProposta: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [premissas, setPremissas] = useState(DEFAULT_PREMISSAS)
  const [condicoesGerais, setCondicoesGerais] = useState(DEFAULT_CONDICOES_GERAIS)
  const [notaPrazo, setNotaPrazo] = useState(DEFAULT_NOTA_PRAZO)
  const [parcelas, setParcelas] = useState<ParcelaPadraoConfig[]>(DEFAULT_PARCELAS)

  const carregarParametros = async () => {
    setLoading(true)
    try {
      const params = await parametrosService.list()
      const mapa = new Map(params.map((p) => [p.chave, p.valor]))

      if (mapa.has('modelo_proposta_premissas')) {
        setPremissas(mapa.get('modelo_proposta_premissas') || '')
      }
      if (mapa.has('modelo_proposta_condicoes_gerais')) {
        setCondicoesGerais(mapa.get('modelo_proposta_condicoes_gerais') || '')
      }
      if (mapa.has('modelo_proposta_nota_prazo')) {
        setNotaPrazo(mapa.get('modelo_proposta_nota_prazo') || '')
      }
      if (mapa.has('modelo_proposta_parcelas_padrao')) {
        try {
          const parsed = JSON.parse(mapa.get('modelo_proposta_parcelas_padrao') || '[]')
          if (Array.isArray(parsed) && parsed.length > 0) {
            setParcelas(parsed)
          }
        } catch {
          /* intentionally ignored */
        }
      }
    } catch (err) {
      console.error('Erro ao carregar parâmetros do modelo:', err)
      toast({
        title: 'Erro ao carregar modelo',
        description: 'Não foi possível carregar os textos padrão da proposta.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarParametros()
  }, [])

  const somaPercentuais = parcelas.reduce((acc, p) => acc + (Number(p.percentual) || 0), 0)
  const percentualValido = Math.abs(somaPercentuais - 100) < 0.01

  const handleAddParcela = () => {
    const proximaOrdem = parcelas.length + 1
    const restante = Math.max(0, 100 - somaPercentuais)
    setParcelas([
      ...parcelas,
      {
        ordem: proximaOrdem,
        percentual: restante,
        gatilho: 'marco',
        descricao: `${restante}% na conclusão do marco ${proximaOrdem}`,
      },
    ])
  }

  const handleRemoveParcela = (index: number) => {
    if (parcelas.length <= 1) {
      toast({
        title: 'Aviso',
        description: 'Deve haver ao menos uma parcela padrão configurada.',
        variant: 'destructive',
      })
      return
    }
    const novas = parcelas.filter((_, i) => i !== index).map((p, i) => ({ ...p, ordem: i + 1 }))
    setParcelas(novas)
  }

  const handleUpdateParcela = (
    index: number,
    field: keyof ParcelaPadraoConfig,
    value: string | number,
  ) => {
    setParcelas((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p
        return {
          ...p,
          [field]: value,
        }
      }),
    )
  }

  const handleRestaurarPadroesGMAIS = () => {
    if (
      !confirm(
        'Deseja restaurar os textos e parcelas para a redação padrão oficial do modelo GMAIS da empresa?',
      )
    ) {
      return
    }
    setPremissas(DEFAULT_PREMISSAS)
    setCondicoesGerais(DEFAULT_CONDICOES_GERAIS)
    setNotaPrazo(DEFAULT_NOTA_PRAZO)
    setParcelas(DEFAULT_PARCELAS)
    toast({
      title: 'Padrões restaurados na tela',
      description: 'Clique em "Salvar Configuração do Modelo" para persistir as alterações.',
    })
  }

  const handleSalvar = async () => {
    if (!percentualValido) {
      toast({
        title: 'Soma de parcelas inválida',
        description: `A soma dos percentuais das parcelas deve totalizar exatamente 100% (atual: ${somaPercentuais}%).`,
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const params = await parametrosService.list()
      const mapaObj = new Map(params.map((p) => [p.chave, p]))

      const salvarParam = async (chave: string, valor: string, descricao: string) => {
        if (mapaObj.has(chave)) {
          const rec = mapaObj.get(chave)!
          await parametrosService.update(rec.id, { valor, descricao })
        } else {
          await parametrosService.create({ chave, valor, descricao })
        }
      }

      await Promise.all([
        salvarParam(
          'modelo_proposta_premissas',
          premissas,
          'Texto padrão de premissas da proposta técnica GMAIS (editável por proposta)',
        ),
        salvarParam(
          'modelo_proposta_condicoes_gerais',
          condicoesGerais,
          'Texto padrão das condições gerais da proposta técnica GMAIS (3 cláusulas)',
        ),
        salvarParam(
          'modelo_proposta_nota_prazo',
          notaPrazo,
          'Nota explicativa padrão sobre contagem de prazos de execução (dias corridos)',
        ),
        salvarParam(
          'modelo_proposta_parcelas_padrao',
          JSON.stringify(parcelas),
          'Configuração das parcelas padrão da proposta GMAIS (nº, percentual e gatilhos)',
        ),
      ])

      toast({
        title: 'Modelo da Proposta Salvo',
        description: 'Os textos e a regra de parcelas padrão foram atualizados com sucesso.',
      })
    } catch (err) {
      console.error('Erro ao salvar modelo da proposta:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar os parâmetros do modelo.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        Carregando modelo padrão da proposta...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <Card className="border-slate-200">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                <FileText className="w-5 h-5 text-blue-600" />
                Modelo da Proposta GMAIS (Padrão Oficial da Empresa)
              </CardTitle>
              <CardDescription className="text-xs">
                Configure os textos base, cláusulas jurídicas, notas operacionais e o plano padrão
                de parcelamento (50/50 ou personalizado). Todas as novas propostas nascem
                pré-preenchidas com estes valores e permanecem 100% editáveis no editor.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestaurarPadroesGMAIS}
                className="text-xs gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Restaurar Padrões GMAIS
              </Button>
              <Button
                size="sm"
                onClick={handleSalvar}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-sm"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Salvar Configuração do Modelo
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 1. SEÇÃO DE PREMISSAS TÉCNICAS E CONTRATUAIS */}
      <Card className="border-slate-200">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <span>3. Premissas Técnicas da Proposta (Texto Padrão)</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
            >
              Seção 3 do Dossiê/PDF
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Exonerações de responsabilidade por atrasos de órgãos, indicação de pagamento de taxas
            de alvarás/ART/RRT pela contratante e limite de revisões de arquitetura.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2">
          <Textarea
            rows={7}
            value={premissas}
            onChange={(e) => setPremissas(e.target.value)}
            placeholder="Digite os itens numerados de premissas..."
            className="text-xs font-sans leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* 2. NOTA SOBRE CONTAGEM DE PRAZO */}
      <Card className="border-slate-200">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <span>4. Nota Explicativa de Prazo de Execução</span>
            <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
              Seção 4 do Dossiê/PDF
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Definição da regra de contagem (ex.: dias corridos, contados a partir da assinatura e do
            recebimento dos subsídios). O número de dias é informado caso a caso em cada proposta.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2">
          <Textarea
            rows={3}
            value={notaPrazo}
            onChange={(e) => setNotaPrazo(e.target.value)}
            placeholder="Ex.: Os prazos serão contados em dias corridos..."
            className="text-xs font-sans leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* 3. CONDIÇÕES GERAIS (3 CLÁUSULAS CONTRATUAIS) */}
      <Card className="border-slate-200">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <span>8. Condições Gerais & Cláusulas Rescisórias</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
            >
              Seção 8 do Dossiê/PDF
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Cláusula 1ª (alterações e horas adicionais), Cláusula 2ª (direitos autorais e uso
            exclusivo) e Cláusula 3ª (rescisão e multa compensatória de 20%).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2">
          <Textarea
            rows={9}
            value={condicoesGerais}
            onChange={(e) => setCondicoesGerais(e.target.value)}
            placeholder="Insira as cláusulas contratuais gerais..."
            className="text-xs font-sans leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* 4. CONFIGURAÇÃO DE PARCELAS PADRÃO */}
      <Card className="border-slate-200">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <span>6. Condições de Pagamento — Parcelas Padrão</span>
                <Badge
                  variant="outline"
                  className={
                    percentualValido
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]'
                      : 'bg-red-50 text-red-800 border-red-300 text-[10px]'
                  }
                >
                  Soma: {somaPercentuais}% {percentualValido ? '✓ (OK)' : '— Deve somar 100%'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Estrutura de pagamento pré-configurada para novas propostas. O modelo oficial da
                GMAIS prevê 50% na contratação / 50% na entrega final dos projetos executivos.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddParcela}
              className="text-xs gap-1 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar Parcela
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-2 space-y-3">
          <div className="space-y-2">
            {parcelas.map((parc, index) => (
              <div
                key={index}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
              >
                <div className="sm:col-span-1 font-mono text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    #{parc.ordem}
                  </Badge>
                </div>

                <div className="sm:col-span-2">
                  <Label className="text-[10px] text-slate-500 block mb-0.5 sm:hidden">
                    Percentual (%)
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={parc.percentual}
                      onChange={(e) =>
                        handleUpdateParcela(index, 'percentual', parseFloat(e.target.value) || 0)
                      }
                      className="text-xs h-8 pr-6 font-mono text-right"
                    />
                    <Percent className="w-3 h-3 absolute right-2 top-2.5 text-slate-400" />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <Label className="text-[10px] text-slate-500 block mb-0.5 sm:hidden">
                    Gatilho
                  </Label>
                  <Select
                    value={parc.gatilho}
                    onValueChange={(val: 'contratacao' | 'entrega' | 'marco') =>
                      handleUpdateParcela(index, 'gatilho', val)
                    }
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contratacao">Contratação / Aceite</SelectItem>
                      <SelectItem value="entrega">Entrega Final</SelectItem>
                      <SelectItem value="marco">Marco / Etapa Intermediária</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-5">
                  <Label className="text-[10px] text-slate-500 block mb-0.5 sm:hidden">
                    Descrição da Parcela
                  </Label>
                  <Input
                    value={parc.descricao}
                    onChange={(e) => handleUpdateParcela(index, 'descricao', e.target.value)}
                    placeholder="Descrição da parcela para o cliente..."
                    className="text-xs h-8"
                  />
                </div>

                <div className="sm:col-span-1 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveParcela(index)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                    title="Remover parcela"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {!percentualValido && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                A soma atual das parcelas é de <strong>{somaPercentuais}%</strong>. Ajuste os
                percentuais para atingir exatamente 100%.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
export default GestaoModeloProposta
