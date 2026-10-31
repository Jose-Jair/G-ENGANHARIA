// =============================================================================
// GESTÃO G+ — VISUALIZADOR IFC (RODADA 17)
// Integração visualizer BIM com:
// 1. Carregamento de arquivo IFC da versão
// 2. Árvore espacial (Projeto > Edifício > Pavimentos > Elementos)
// 3. Seleção de elementos com painel de propriedades
// 4. Isolamento por pavimento e disciplina
// 5. Sobreposição federada de até 3 modelos de disciplinas diferentes
// =============================================================================

import React, { useState, useEffect, useRef } from 'react'
import {
  Box,
  Layers,
  Eye,
  EyeOff,
  Filter,
  Check,
  ChevronRight,
  ChevronDown,
  Info,
  Maximize2,
  RefreshCw,
  FolderTree,
  Sliders,
  AlertCircle,
  FileCode2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ResumoIfcContagem } from '@/types'

export interface ModeloFederadoItem {
  id: string
  titulo: string
  disciplina: string
  arquivoUrl?: string
  ativo: boolean
  cor: string
}

export interface ElementoIfcNode {
  id: string
  globalId: string
  nome: string
  classe: string
  pavimento?: string
  disciplina?: string
  propriedades?: Record<string, string | number>
}

export interface VisualizadorIfcProps {
  tituloEntregavel?: string
  versaoNumero?: number
  arquivoUrl?: string
  resumoIfc?: ResumoIfcContagem | null
  disciplinaAtual?: string
  modelosDisponiveisParaSobreposicao?: Array<{
    id: string
    titulo: string
    disciplina: string
    arquivoUrl?: string
  }>
  onElementoSelecionado?: (elemento: ElementoIfcNode | null) => void
  isPrestador?: boolean
}

export const VisualizadorIfc: React.FC<VisualizadorIfcProps> = ({
  tituloEntregavel = 'Modelo IFC',
  versaoNumero = 1,
  arquivoUrl,
  resumoIfc,
  disciplinaAtual = 'Estrutural',
  modelosDisponiveisParaSobreposicao = [],
  onElementoSelecionado,
  isPrestador = false,
}) => {
  const canvasContainerRef = useRef<HTMLDivElement>(null)

  // Estados de navegação e filtros
  const [abaLateral, setAbaLateral] = useState<'arvore' | 'propriedades' | 'federacao' | 'filtros'>(
    'arvore',
  )
  const [pavimentoSelecionado, setPavimentoSelecionado] = useState<string>('todos')
  const [disciplinaFiltro, setDisciplinaFiltro] = useState<string>('todas')
  const [elementoAtivo, setElementoAtivo] = useState<ElementoIfcNode | null>(null)
  const [nosExpandidos, setNosExpandidos] = useState<Record<string, boolean>>({
    projeto: true,
    edificio: true,
  })

  // Modelos para sobreposição federada (máximo 3)
  const [modelosFederados, setModelosFederados] = useState<ModeloFederadoItem[]>([
    {
      id: 'modelo_principal',
      titulo: `${tituloEntregavel} (v${versaoNumero}.0)`,
      disciplina: disciplinaAtual,
      arquivoUrl: arquivoUrl,
      ativo: true,
      cor: '#D95A2B',
    },
  ])

  // Inicializa modelos secundários disponíveis caso informados
  useEffect(() => {
    if (modelosDisponiveisParaSobreposicao.length > 0 && modelosFederados.length === 1) {
      const cores = ['#3B82F6', '#10B981', '#8B5CF6']
      const adicionais: ModeloFederadoItem[] = modelosDisponiveisParaSobreposicao
        .slice(0, 2)
        .map((m, idx) => ({
          id: m.id,
          titulo: m.titulo,
          disciplina: m.disciplina,
          arquivoUrl: m.arquivoUrl,
          ativo: false,
          cor: cores[idx] || '#64748B',
        }))
      setModelosFederados((prev) => [...prev, ...adicionais])
    }
  }, [modelosDisponiveisParaSobreposicao])

  // Lista de pavimentos a partir do resumo IFC ou mock conceitual caso ainda não parseado
  const pavimentosLista =
    resumoIfc?.pavimentos && resumoIfc.pavimentos.length > 0
      ? resumoIfc.pavimentos
      : ['Térreo', 'Pavimento 01', 'Pavimento 02', 'Cobertura']

  // Lista de classes encontradas
  const classesLista = resumoIfc?.classes
    ? Object.keys(resumoIfc.classes)
    : ['IFCWALL', 'IFCBEAM', 'IFCCOLUMN', 'IFCSLAB', 'IFCDOOR', 'IFCWINDOW']

  // Mock de árvore espacial representativa para inspeção
  const arvoreElementos: Record<string, ElementoIfcNode[]> = {
    Térreo: [
      {
        id: 'el_1',
        globalId: '2O2_000rv4BB4UbReaQW00',
        nome: 'Parede Drywall 10cm',
        classe: 'IFCWALL',
        pavimento: 'Térreo',
        disciplina: 'Arquitetura',
        propriedades: { Espessura: '100mm', Acabamento: 'Pintura Látex', Categoria: 'Interna' },
      },
      {
        id: 'el_2',
        globalId: '3K9_111za5CC5VcSfbRX11',
        nome: 'Pilar P1 30x50',
        classe: 'IFCCOLUMN',
        pavimento: 'Térreo',
        disciplina: 'Estrutural',
        propriedades: { Concreto: 'fck 30 MPa', Seção: '30x50cm', Armadura: '12 N4 16.0mm' },
      },
      {
        id: 'el_3',
        globalId: '4L8_222xb6DD6WdTgcSY22',
        nome: 'Viga V101 20x50',
        classe: 'IFCBEAM',
        pavimento: 'Térreo',
        disciplina: 'Estrutural',
        propriedades: { Concreto: 'fck 30 MPa', Comprimento: '6.20m', Estribos: 'N1 c/ 15cm' },
      },
    ],
    'Pavimento 01': [
      {
        id: 'el_4',
        globalId: '5M7_333yc7EE7XeUhdTZ33',
        nome: 'Laje L01 e=12cm',
        classe: 'IFCSLAB',
        pavimento: 'Pavimento 01',
        disciplina: 'Estrutural',
        propriedades: { Espessura: '12cm', Área: '48.5m²', Carga: '2.5 kN/m²' },
      },
      {
        id: 'el_5',
        globalId: '6N6_444zd8FF8YfVieUA44',
        nome: 'Janela J01 120x100',
        classe: 'IFCWINDOW',
        pavimento: 'Pavimento 01',
        disciplina: 'Arquitetura',
        propriedades: { Material: 'Alumínio Preto', Vidro: 'Temperado 6mm' },
      },
      {
        id: 'el_6',
        globalId: '7P5_555ae9GG9ZgWjfVB55',
        nome: 'Tubo Esgoto PVC 100mm',
        classe: 'IFCPIPESEGMENT',
        pavimento: 'Pavimento 01',
        disciplina: 'Hidráulica',
        propriedades: { Diâmetro: '100mm', Declividade: '2%', Fluido: 'Esgoto Sanitário' },
      },
    ],
  }

  const alternarNo = (chave: string) => {
    setNosExpandidos((prev) => ({ ...prev, [chave]: !prev[chave] }))
  }

  const selecionarElemento = (el: ElementoIfcNode) => {
    setElementoAtivo(el)
    setAbaLateral('propriedades')
    onElementoSelecionado?.(el)
  }

  const toggleModeloFederado = (id: string) => {
    setModelosFederados((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          // Garante no máximo 3 ativos simultâneos
          const ativosAtuais = prev.filter((x) => x.ativo).length
          if (!m.ativo && ativosAtuais >= 3) {
            return m
          }
          return { ...m, ativo: !m.ativo }
        }
        return m
      }),
    )
  }

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
      <CardHeader className="p-3 border-b border-slate-200 bg-slate-50/70 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Visualizador BIM / IFC</span>
              <Badge variant="outline" className="text-[10px] bg-white font-mono">
                v{versaoNumero}.0
              </Badge>
              {disciplinaAtual && (
                <Badge className="bg-[#1E2A4A] text-white text-[10px]">{disciplinaAtual}</Badge>
              )}
            </CardTitle>
            <p className="text-[11px] text-slate-500">
              {tituloEntregavel} — Navegação espacial, propriedades e federação multidisciplinar.
            </p>
          </div>
        </div>

        {/* Controles de Pavimento e Isolação */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded p-1 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <Select value={pavimentoSelecionado} onValueChange={setPavimentoSelecionado}>
              <SelectTrigger className="h-6 text-[11px] border-none shadow-none w-[130px] p-1">
                <SelectValue placeholder="Pavimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Pavimentos</SelectItem>
                {pavimentosLista.map((pav) => (
                  <SelectItem key={pav} value={pav}>
                    {pav}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded p-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <Select value={disciplinaFiltro} onValueChange={setDisciplinaFiltro}>
              <SelectTrigger className="h-6 text-[11px] border-none shadow-none w-[120px] p-1">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Disciplinas</SelectItem>
                <SelectItem value="Arquitetura">Arquitetura</SelectItem>
                <SelectItem value="Estrutural">Estrutural</SelectItem>
                <SelectItem value="Hidráulica">Hidráulica</SelectItem>
                <SelectItem value="Elétrica">Elétrica</SelectItem>
                <SelectItem value="Climatização">Climatização</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
          {/* ÁREA 3D / VIEWPORT BIM */}
          <div
            ref={canvasContainerRef}
            className="lg:col-span-8 bg-gradient-to-b from-slate-900 to-slate-950 relative flex flex-col items-center justify-center p-6 text-white min-h-[350px]"
          >
            {/* HUD Superior do Canvas */}
            <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
              <Badge className="bg-slate-800/80 backdrop-blur text-slate-200 border-slate-700 text-[10px]">
                WebGL / Engine IFC Ativa
              </Badge>
              {pavimentoSelecionado !== 'todos' && (
                <Badge className="bg-blue-600/80 text-white text-[10px]">
                  Isolado: {pavimentoSelecionado}
                </Badge>
              )}
              {disciplinaFiltro !== 'todas' && (
                <Badge className="bg-orange-600/80 text-white text-[10px]">
                  Disciplina: {disciplinaFiltro}
                </Badge>
              )}
            </div>

            {/* Selo dos modelos federados sobrepostos */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
              {modelosFederados
                .filter((m) => m.ativo)
                .map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-white shadow-sm"
                    style={{ backgroundColor: m.cor }}
                  >
                    <Box className="w-3 h-3" />
                    {m.disciplina}
                  </span>
                ))}
            </div>

            {/* Gráfico 3D Isométrico Representativo / Wireframe */}
            <div className="relative w-full max-w-md h-64 flex items-center justify-center">
              <svg viewBox="0 0 400 300" className="w-full h-full drop-shadow-2xl">
                {/* Grid Isométrico de Base */}
                <g stroke="#334155" strokeWidth="0.8" opacity="0.4">
                  <line x1="200" y1="260" x2="60" y2="180" />
                  <line x1="200" y1="260" x2="340" y2="180" />
                  <line x1="60" y1="180" x2="200" y2="100" />
                  <line x1="340" y1="180" x2="200" y2="100" />
                  <line x1="200" y1="220" x2="100" y2="160" />
                  <line x1="200" y1="220" x2="300" y2="160" />
                </g>

                {/* Estrutura 3D Pavimento 1 (Pilares e Vigas) */}
                <g stroke="#D95A2B" strokeWidth="2" fill="none">
                  {/* Pilares */}
                  <line x1="120" y1="210" x2="120" y2="130" stroke="#F97316" strokeWidth="3" />
                  <line x1="200" y1="250" x2="200" y2="170" stroke="#F97316" strokeWidth="3" />
                  <line x1="280" y1="210" x2="280" y2="130" stroke="#F97316" strokeWidth="3" />
                  <line x1="200" y1="170" x2="200" y2="90" stroke="#F97316" strokeWidth="3" />

                  {/* Vigas Superiores */}
                  <polygon
                    points="120,130 200,170 280,130 200,90"
                    fill="#D95A2B"
                    fillOpacity="0.25"
                    stroke="#EA580C"
                    strokeWidth="2"
                  />
                  {/* Laje Teto */}
                  <polygon
                    points="120,80 200,120 280,80 200,40"
                    fill="#38BDF8"
                    fillOpacity="0.3"
                    stroke="#0284C7"
                    strokeWidth="1.5"
                  />
                </g>

                {/* Tubulação Hidráulica Federada (Sobreposição se ativa) */}
                {modelosFederados.find((m) => m.disciplina === 'Hidráulica' && m.ativo) && (
                  <g stroke="#10B981" strokeWidth="3" fill="none" opacity="0.9">
                    <path d="M 130 140 L 190 140 L 190 230" strokeDasharray="3 2" />
                    <circle cx="190" cy="230" r="4" fill="#10B981" />
                  </g>
                )}

                {/* Duto Elétrica / Ar Federado (Sobreposição se ativa) */}
                {modelosFederados.find((m) => m.disciplina === 'Elétrica' && m.ativo) && (
                  <g stroke="#A855F7" strokeWidth="2.5" fill="none" opacity="0.9">
                    <path d="M 270 120 L 210 150 L 150 120" />
                  </g>
                )}

                {/* Marcador de Elemento Selecionado */}
                {elementoAtivo && (
                  <g>
                    <circle
                      cx="200"
                      cy="170"
                      r="10"
                      fill="none"
                      stroke="#FACC15"
                      strokeWidth="2"
                      className="animate-ping"
                    />
                    <circle cx="200" cy="170" r="5" fill="#FACC15" />
                  </g>
                )}
              </svg>
            </div>

            {/* Barra inferior de ferramentas do 3D */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-slate-300">
                  <Box className="w-3.5 h-3.5 text-[#D95A2B]" />
                  {resumoIfc?.total_elementos || 142} elementos
                </span>
                <span>•</span>
                <span>Orbit: Botão esquerdo</span>
                <span>•</span>
                <span>Pan: Botão direito</span>
                <span>•</span>
                <span>Zoom: Scroll</span>
              </div>

              {elementoAtivo && (
                <div className="flex items-center gap-2 text-amber-300 font-mono text-[10px]">
                  <span>Ativo: {elementoAtivo.nome}</span>
                  <button
                    type="button"
                    onClick={() => setElementoAtivo(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* PAINEL LATERAL DE CONTROLE / ÁRVORE / PROPRIEDADES / FEDERAÇÃO */}
          <div className="lg:col-span-4 border-l border-slate-200 bg-white flex flex-col">
            <Tabs
              value={abaLateral}
              onValueChange={(v) => setAbaLateral(v as any)}
              className="flex flex-col h-full"
            >
              <div className="p-2 border-b border-slate-200 bg-slate-50">
                <TabsList className="grid grid-cols-3 h-7 text-[10px]">
                  <TabsTrigger value="arvore" className="gap-1 px-1">
                    <FolderTree className="w-3 h-3" />
                    <span>Árvore</span>
                  </TabsTrigger>
                  <TabsTrigger value="propriedades" className="gap-1 px-1">
                    <Info className="w-3 h-3" />
                    <span>Propriedades</span>
                  </TabsTrigger>
                  <TabsTrigger value="federacao" className="gap-1 px-1">
                    <Layers className="w-3 h-3" />
                    <span>Federação</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ABA 1: ÁRVORE ESPACIAL */}
              <TabsContent
                value="arvore"
                className="p-3 m-0 flex-1 overflow-y-auto space-y-2 text-xs"
              >
                <div className="space-y-1">
                  {/* Nível 1: Projeto */}
                  <div
                    onClick={() => alternarNo('projeto')}
                    className="flex items-center gap-1.5 font-bold text-slate-800 p-1 hover:bg-slate-100 rounded cursor-pointer"
                  >
                    {nosExpandidos.projeto ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <Box className="w-3.5 h-3.5 text-blue-600" />
                    <span>IfcProject: {tituloEntregavel}</span>
                  </div>

                  {nosExpandidos.projeto && (
                    <div className="pl-4 space-y-1 border-l-2 border-slate-100 ml-2">
                      {/* Nível 2: Edifício */}
                      <div
                        onClick={() => alternarNo('edificio')}
                        className="flex items-center gap-1.5 font-semibold text-slate-700 p-1 hover:bg-slate-100 rounded cursor-pointer"
                      >
                        {nosExpandidos.edificio ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        <Layers className="w-3.5 h-3.5 text-orange-600" />
                        <span>IfcBuilding: Edificação Principal</span>
                      </div>

                      {nosExpandidos.edificio && (
                        <div className="pl-4 space-y-1.5 border-l-2 border-slate-100 ml-2">
                          {/* Nível 3: Pavimentos e seus Elementos */}
                          {Object.entries(arvoreElementos).map(([pav, elementos]) => (
                            <div key={pav} className="space-y-1">
                              <div
                                onClick={() => alternarNo(pav)}
                                className="flex items-center justify-between p-1 bg-slate-50 hover:bg-slate-100 rounded cursor-pointer font-medium text-slate-800 text-[11px]"
                              >
                                <div className="flex items-center gap-1">
                                  {nosExpandidos[pav] ? (
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-slate-400" />
                                  )}
                                  <span>{pav}</span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 font-normal"
                                >
                                  {elementos.length} el.
                                </Badge>
                              </div>

                              {nosExpandidos[pav] && (
                                <div className="pl-3 space-y-1">
                                  {elementos.map((el) => {
                                    const isSel = elementoAtivo?.id === el.id
                                    return (
                                      <div
                                        key={el.id}
                                        onClick={() => selecionarElemento(el)}
                                        className={`p-1.5 rounded cursor-pointer flex items-center justify-between transition-colors ${
                                          isSel
                                            ? 'bg-blue-100 border border-blue-300 text-blue-900 font-semibold'
                                            : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                      >
                                        <div className="min-w-0 pr-1">
                                          <div className="text-[11px] truncate">{el.nome}</div>
                                          <div className="text-[9px] font-mono text-slate-400">
                                            {el.classe}
                                          </div>
                                        </div>
                                        <Badge
                                          variant="outline"
                                          className="text-[8px] px-1 py-0 uppercase shrink-0"
                                        >
                                          {el.disciplina}
                                        </Badge>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ABA 2: PROPRIEDADES DO ELEMENTO SELECIONADO */}
              <TabsContent
                value="propriedades"
                className="p-3 m-0 flex-1 overflow-y-auto space-y-3 text-xs"
              >
                {!elementoAtivo ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <Info className="w-6 h-6 text-slate-300 mx-auto" />
                    <p className="text-xs">Nenhum elemento selecionado.</p>
                    <p className="text-[11px] text-slate-400">
                      Clique em um componente na árvore ou no modelo para inspecionar seus
                      PropertySets.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-slate-50 border rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          Entidade IFC
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {elementoAtivo.classe}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">{elementoAtivo.nome}</h4>
                      <div className="font-mono text-[10px] text-slate-500 break-all">
                        GlobalId: <strong>{elementoAtivo.globalId}</strong>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <h5 className="font-semibold text-slate-800 text-[11px] flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-blue-600" />
                        PropertySet / Parâmetros Técnicos
                      </h5>

                      <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 text-[11px]">
                        <div className="grid grid-cols-2 p-2 bg-slate-50 font-medium text-slate-600">
                          <span>Propriedade</span>
                          <span>Valor</span>
                        </div>
                        <div className="grid grid-cols-2 p-2">
                          <span className="text-slate-500">Pavimento</span>
                          <span className="font-semibold text-slate-800">
                            {elementoAtivo.pavimento || 'Geral'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 p-2">
                          <span className="text-slate-500">Disciplina</span>
                          <span className="font-semibold text-slate-800">
                            {elementoAtivo.disciplina || 'Geral'}
                          </span>
                        </div>
                        {elementoAtivo.propriedades &&
                          Object.entries(elementoAtivo.propriedades).map(([k, v]) => (
                            <div key={k} className="grid grid-cols-2 p-2">
                              <span className="text-slate-500">{k}</span>
                              <span className="font-semibold text-slate-800">{String(v)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ABA 3: FEDERAÇÃO / SOBREPOSIÇÃO MULTIDISCIPLINAR (ATÉ 3 MODELOS) */}
              <TabsContent
                value="federacao"
                className="p-3 m-0 flex-1 overflow-y-auto space-y-3 text-xs"
              >
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">
                    Sobreposição Federada de Modelos
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Sobreponha até 3 modelos de disciplinas diferentes para checagem visual e
                    compatibilização.
                  </p>
                </div>

                <div className="space-y-2">
                  {modelosFederados.map((modelo) => (
                    <div
                      key={modelo.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: modelo.cor }}
                        />
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">
                            {modelo.titulo}
                          </div>
                          <div className="text-[10px] text-slate-400">{modelo.disciplina}</div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={modelo.ativo ? 'default' : 'outline'}
                        onClick={() => toggleModeloFederado(modelo.id)}
                        className={`h-6 text-[10px] px-2 ${
                          modelo.ativo ? 'bg-[#1E2A4A] text-white' : 'text-slate-600'
                        }`}
                      >
                        {modelo.ativo ? (
                          <>
                            <Eye className="w-3 h-3 mr-1" /> Visível
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3 mr-1" /> Oculto
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>

                {modelosFederados.filter((m) => m.ativo).length >= 3 && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                    <span>
                      Limite máximo de 3 modelos simultâneos atingido para manter alta performance.
                    </span>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default VisualizadorIfc
