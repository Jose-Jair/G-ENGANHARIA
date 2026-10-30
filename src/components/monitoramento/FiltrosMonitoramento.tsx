import React from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, Filter, X } from 'lucide-react'
import { SemaforoPrazoStatus } from './SemaforoBadge'

export interface FiltrosMonitoramentoState {
  busca: string
  prestadorId: string
  disciplina: string
  statusSemaforo: SemaforoPrazoStatus | 'todos'
  tipoPrestador: 'todos' | 'interno' | 'externo'
}

interface FiltrosMonitoramentoProps {
  filtros: FiltrosMonitoramentoState
  onChangeFiltros: (novosFiltros: FiltrosMonitoramentoState) => void
  prestadoresOpcoes: { id: string; nome: string }[]
  disciplinasOpcoes: string[]
  onLimpar: () => void
}

export const FiltrosMonitoramento: React.FC<FiltrosMonitoramentoProps> = ({
  filtros,
  onChangeFiltros,
  prestadoresOpcoes,
  disciplinasOpcoes,
  onLimpar,
}) => {
  const hasFiltrosAtivos =
    Boolean(filtros.busca) ||
    filtros.prestadorId !== 'todos' ||
    filtros.disciplina !== 'todas' ||
    filtros.statusSemaforo !== 'todos' ||
    filtros.tipoPrestador !== 'todos'

  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs space-y-3">
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Campo Busca */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            placeholder="Buscar por OS, projeto ou código..."
            value={filtros.busca}
            onChange={(e) => onChangeFiltros({ ...filtros, busca: e.target.value })}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Seletores de Filtro */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Tipo Prestador */}
          <Select
            value={filtros.tipoPrestador}
            onValueChange={(val: 'todos' | 'interno' | 'externo') =>
              onChangeFiltros({ ...filtros, tipoPrestador: val })
            }
          >
            <SelectTrigger className="text-xs h-9 w-[130px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              <SelectItem value="interno">Interno (Equipe)</SelectItem>
              <SelectItem value="externo">Externo</SelectItem>
            </SelectContent>
          </Select>

          {/* Prestador */}
          <Select
            value={filtros.prestadorId}
            onValueChange={(val) => onChangeFiltros({ ...filtros, prestadorId: val })}
          >
            <SelectTrigger className="text-xs h-9 w-[170px]">
              <SelectValue placeholder="Prestador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos prestadores</SelectItem>
              {prestadoresOpcoes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Disciplina */}
          <Select
            value={filtros.disciplina}
            onValueChange={(val) => onChangeFiltros({ ...filtros, disciplina: val })}
          >
            <SelectTrigger className="text-xs h-9 w-[150px]">
              <SelectValue placeholder="Disciplina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas disciplinas</SelectItem>
              {disciplinasOpcoes.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Semáforo */}
          <Select
            value={filtros.statusSemaforo}
            onValueChange={(val: any) => onChangeFiltros({ ...filtros, statusSemaforo: val })}
          >
            <SelectTrigger className="text-xs h-9 w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="no_prazo">No prazo (Verde)</SelectItem>
              <SelectItem value="atencao">Atenção (Amarelo)</SelectItem>
              <SelectItem value="atrasado">Atrasado (Vermelho)</SelectItem>
              <SelectItem value="aguardando_revisao">Aguardando revisão (Azul)</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>

          {hasFiltrosAtivos && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onLimpar}
              className="h-9 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FiltrosMonitoramento
