import React, { useEffect, useState } from 'react'
import { ParametroScorecardRecord, TipoEntidadeScorecard } from '@/types'
import { scorecardsService } from '@/services/scorecards'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Award,
  History,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Layers,
  Sliders,
  Calendar,
  Lock,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatDateTimeBr } from '@/lib/formatters'
import { useToast } from '@/hooks/use-toast'

export const PainelParametrosScorecards: React.FC = () => {
  const { toast } = useToast()
  const [perfilAtivo, setPerfilAtivo] = useState<TipoEntidadeScorecard>('prestador_externo')
  const [versaoAtiva, setVersaoAtiva] = useState<ParametroScorecardRecord | null>(null)
  const [historico, setHistorico] = useState<ParametroScorecardRecord[]>([])
  const [carregando, setCarregando] = useState(true)

  // Modal de Nova Versão
  const [modalNovaVersaoOpen, setModalNovaVersaoOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [motivoVersao, setMotivoVersao] = useState('')

  // Campos do formulário de nova versão (baseados na ativa)
  const [pesosForm, setPesosForm] = useState<Record<string, number>>({})
  const [metasForm, setMetasForm] = useState<Record<string, number>>({})

  const carregar = async () => {
    setCarregando(true)
    try {
      const res = await scorecardsService.listarParametros()
      const doPerfil = (res.parametros || []).filter((p) => p.tipo_entidade === perfilAtivo)
      const ativa = doPerfil.find((p) => p.ativo) || doPerfil[0] || null
      const anteriores = doPerfil.filter((p) => p.id !== ativa?.id)
      setVersaoAtiva(ativa)
      setHistorico(anteriores)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar parâmetros do scorecard',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [perfilAtivo])

  // Abre modal clonando os pesos da versão ativa
  const abrirNovaVersao = () => {
    if (versaoAtiva) {
      setPesosForm({ ...(versaoAtiva.pesos_json || {}) })
      setMetasForm({ ...(versaoAtiva.metas_json || {}) })
    } else {
      setPesosForm({})
      setMetasForm({})
    }
    setMotivoVersao('')
    setModalNovaVersaoOpen(true)
  }

  // Submissão de nova versão (imutável, preserva histórico)
  const handleCriarNovaVersao = async (e: React.FormEvent) => {
    e.preventDefault()

    // Valida soma dos pesos = 100%
    const totalPesos = Object.values(pesosForm).reduce((acc, val) => acc + (Number(val) || 0), 0)
    if (Math.abs(totalPesos - 100) > 0.5) {
      toast({
        title: 'Soma de pesos inválida',
        description: `A soma de todos os pesos ponderados deve ser exatamente 100% (atual: ${totalPesos.toFixed(1)}%).`,
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
try {
  await scorecardsService.criarNovaVersaoParametros({
    tipo_entidade: perfilAtivo,
    pesos_json: pesosForm,
    metas_json: metasForm,
    descricao: motivoVersao.trim() || 'Ajuste de pesos e metas aprovado pela gestão técnica',
  })

  toast({
        title: 'Nova Versão de Parâmetros Publicada!',
        description: 'A versão anterior foi arquivada e o histórico mantido intacto.',
      })
      setModalNovaVersaoOpen(false)
      carregar()
    } catch (err: any) {
      toast({
        title: 'Erro ao publicar versão',
        description: err.message || 'Falha ao gravar parâmetros.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#D95A2B]" />
              Parâmetros, Pesos e Metas de Scorecard
            </h3>
            <Badge className="bg-[#1E2A4A] text-white text-[10px]">Versionamento Imutável</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure as ponderações por perfil (externo, interno, parceiro). Nenhuma alteração
            sobrescreve dados: cada mudança gera uma nova versão auditada.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={abrirNovaVersao}
            disabled={carregando || !versaoAtiva}
            className="text-xs bg-[#D95A2B] hover:bg-[#b84820] text-white shadow-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar Nova Versão de Pesos
          </Button>
        </div>
      </div>

      {/* Seletor de Perfil */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setPerfilAtivo('prestador_externo')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            perfilAtivo === 'prestador_externo'
              ? 'bg-[#D95A2B] text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Prestador Externo (OS Terceirizada)
        </button>
        <button
          onClick={() => setPerfilAtivo('prestador_interno')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            perfilAtivo === 'prestador_interno'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Equipe Interna (Engenharia Própria)
        </button>
        <button
          onClick={() => setPerfilAtivo('empresa_parceira')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            perfilAtivo === 'empresa_parceira'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Empresa Parceira (Cliente Demandante)
        </button>
      </div>

      {carregando ? (
        <div className="py-12 text-center text-xs text-slate-400">
          <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#D95A2B]" />
          Carregando versões de parâmetros...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1 & 2: Versão Atual Ativa */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Versão Atual Ativa: v{versaoAtiva?.versao || 1}
                    </CardTitle>
                    <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Ativa
                    </Badge>
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Criada em{' '}
                    {versaoAtiva?.criado_em
                      ? formatDateTimeBr(versaoAtiva.criado_em)
                      : 'Inicial'}{' '}
                    • Motivo: "{versaoAtiva?.descricao || 'Parâmetros iniciais homologados'}"
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Pesos Ponderados Vigentes */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#D95A2B]" />
                    Ponderação dos Indicadores (Soma: 100%)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {versaoAtiva?.pesos_json &&
                      Object.entries(versaoAtiva.pesos_json).map(([chave, peso]) => (
                        <div
                          key={chave}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200/80"
                        >
                          <span className="text-[11px] text-slate-500 font-medium block truncate capitalize">
                            {chave.replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-xl font-extrabold text-[#D95A2B]">
                              {Number(peso)}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">%</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Metas Técnicas Vigentes */}
                {versaoAtiva?.metas_json && Object.keys(versaoAtiva.metas_json).length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Metas Operacionais de Referência
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {Object.entries(versaoAtiva.metas_json).map(([metaKey, valor]) => (
                        <div
                          key={metaKey}
                          className="p-2.5 bg-slate-50 rounded border border-slate-200"
                        >
                          <span className="text-[10px] text-slate-400 block truncate capitalize">
                            {metaKey.replace(/_/g, ' ')}
                          </span>
                          <strong className="text-slate-800 font-mono text-sm">
                            {String(valor)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna 3: Histórico de Versões Preservadas (Apenas Leitura) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                Histórico de Versões ({historico.length})
              </h4>
              <span className="text-[10px] text-slate-400">Imutável</span>
            </div>

            {historico.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                Nenhuma versão arquivada. Esta é a versão 1 inicial.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {historico.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span className="font-bold text-slate-900">Versão v{v.versao}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600">
                        Arquivada
                      </Badge>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {v.descricao || 'Sem justificativa gravada.'}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Criado: {v.criado_em ? formatDateTimeBr(v.criado_em) : '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Criar Nova Versão */}
      <Dialog open={modalNovaVersaoOpen} onOpenChange={setModalNovaVersaoOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#D95A2B]" />
              Nova Versão de Parâmetros ({perfilAtivo.replace(/_/g, ' ')})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ajuste os pesos ponderados para o perfil. A soma de todos os pesos deve totalizar
              100%. A versão atual será arquivada e os scorecards passarão a usar a nova versão.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCriarNovaVersao} className="space-y-4 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Motivo / Justificativa da Alteração *
              </Label>
              <Input
                required
                value={motivoVersao}
                onChange={(e) => setMotivoVersao(e.target.value)}
                placeholder="Ex.: Aumento do peso de pontualidade após alinhamento de diretoria..."
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 block">
                Pesos dos Indicadores (%)
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                {Object.keys(pesosForm).map((chave) => (
                  <div key={chave} className="p-2.5 bg-slate-50 rounded border border-slate-200">
                    <Label className="text-[10px] text-slate-500 capitalize block mb-1 truncate">
                      {chave.replace(/_/g, ' ')}
                    </Label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        required
                        value={pesosForm[chave] ?? 0}
                        onChange={(e) =>
                          setPesosForm({
                            ...pesosForm,
                            [chave]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-8 text-xs font-mono"
                      />
                      <span className="text-xs text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Soma total em tempo real */}
              <div className="p-2 bg-slate-100 rounded flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Soma Total dos Pesos:</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    Math.abs(
                      Object.values(pesosForm).reduce((acc, v) => acc + (Number(v) || 0), 0) - 100,
                    ) < 0.5
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {Object.values(pesosForm)
                    .reduce((acc, v) => acc + (Number(v) || 0), 0)
                    .toFixed(0)}
                  % / 100%
                </span>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNovaVersaoOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="text-xs bg-[#D95A2B] hover:bg-[#b84820] text-white gap-1"
              >
                {salvando && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Publicar Nova Versão
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PainelParametrosScorecards
