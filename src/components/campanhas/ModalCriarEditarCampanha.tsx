import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Eye, Plus, Sparkles, AlertCircle, Loader2 } from 'lucide-react'
import { CampanhaRecord, ModeloRecord } from '@/types'
import { campanhasService } from '@/services/campanhas'
import { ContagemDestinatariosNutricao } from '@/services/nutricao'
import { PreviaCampanhaModal } from './PreviaCampanhaModal'
import { useToast } from '@/hooks/use-toast'

interface ModalCriarEditarCampanhaProps {
  campanha?: CampanhaRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  modelos: ModeloRecord[]
  contagemDestinatarios: ContagemDestinatariosNutricao
}

export function ModalCriarEditarCampanha({
  campanha,
  open,
  onOpenChange,
  onSuccess,
  modelos,
  contagemDestinatarios,
}: ModalCriarEditarCampanhaProps) {
  const { toast } = useToast()
  const isEditing = !!campanha

  const [nome, setNome] = useState('')
  const [segmento, setSegmento] = useState<'A' | 'B' | 'C' | 'todos'>('todos')
  const [templateId, setTemplateId] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalPreviaOpen, setModalPreviaOpen] = useState(false)

  // Modelo padrão pré-carregado
  useEffect(() => {
    if (campanha) {
      setNome(campanha.nome || '')
      setSegmento(campanha.segmento || 'todos')
      setTemplateId(campanha.template || '')
      setAssunto(campanha.assunto || '')
      setCorpo(campanha.corpo || '')
    } else {
      // Novo rascunho: carregar primeiro modelo de campanha disponível
      const modCamp = modelos.find((m) => m.tipo === 'campanha')
      setNome('')
      setSegmento('todos')
      setTemplateId(modCamp?.id || '')
      setAssunto(
        modCamp?.assunto ||
          'Informativo Técnico & Atualizações de Engenharia — Oportunidades em {orgao}',
      )
      setCorpo(
        modCamp?.corpo ||
          'Prezado(a) {nome},\n\nCompartilhamos as atualizações técnicas e suporte de engenharia para o contrato em {orgao} (R$ {valor_contrato}).\n\nDescadastro: {link_descadastro}',
      )
    }
  }, [campanha, open, modelos])

  // Ao trocar modelo no select
  const handleSelecionarModelo = (id: string) => {
    setTemplateId(id)
    const m = modelos.find((item) => item.id === id)
    if (m) {
      if (!assunto || assunto.includes('Informativo')) setAssunto(m.assunto)
      if (!corpo || corpo.includes('Prezado(a)')) setCorpo(m.corpo)
    }
  }

  // Contagem dinâmica por curva em tempo real
  const contagemAtual =
    segmento === 'todos'
      ? contagemDestinatarios.total
      : segmento === 'A'
        ? contagemDestinatarios.curvaA
        : segmento === 'B'
          ? contagemDestinatarios.curvaB
          : contagemDestinatarios.curvaC

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o título identificador da campanha.',
        variant: 'destructive',
      })
      return
    }

    if (!assunto.trim() || !corpo.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Assunto e corpo do e-mail são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    // Regra rígida da Etapa 5: {link_descadastro} é obrigatório no e-mail
    if (!corpo.includes('{link_descadastro}')) {
      toast({
        title: 'Link de Descadastro Obrigatório',
        description:
          'Por compliance legal (LGPD), o corpo do e-mail DEVE conter a variável {link_descadastro}.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      if (isEditing && campanha) {
        await campanhasService.update(campanha.id, {
          nome: nome.trim(),
          segmento,
          template: templateId || undefined,
          assunto: assunto.trim(),
          corpo: corpo.trim(),
        })
        toast({
          title: 'Campanha Atualizada',
          description: 'Rascunho de campanha salvo com sucesso.',
        })
      } else {
        await campanhasService.create({
          nome: nome.trim(),
          segmento,
          template: templateId || undefined,
          assunto: assunto.trim(),
          corpo: corpo.trim(),
        })
        toast({
          title: 'Rascunho Criado!',
          description:
            'Campanha criada pelo Comercial. Ela poderá ser revisada e submetida para aprovação do Administrador.',
        })
      }

      onSuccess()
      onOpenChange(false)
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar campanha',
        description: err instanceof Error ? err.message : 'Falha na persistência.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              {isEditing ? 'Editar Campanha de Nutrição' : 'Nova Campanha de Nutrição Mensal'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Crie ou edite o rascunho com segmentação por curva ABC, contagem em tempo real e tags
              dinâmicas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1 text-xs">
            {/* Nome da Campanha */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">Título da Campanha:</Label>
              <Input
                placeholder="Ex: Boletim Novembro — Inovações em Obras Públicas e Drenagem"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Segmentação por Curva e Contagem em Tempo Real */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Segmentação por Curva:</Label>
                <Select value={segmento} onValueChange={(val: any) => setSegmento(val)}>
                  <SelectTrigger className="text-xs bg-white">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as Curvas (A, B e C)</SelectItem>
                    <SelectItem value="A">Apenas Curva A (Grandes Contratos)</SelectItem>
                    <SelectItem value="B">Apenas Curva B (Contratos Médios)</SelectItem>
                    <SelectItem value="C">Apenas Curva C (Contratos Menores)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col justify-center space-y-1">
                <span className="text-[11px] text-slate-500">
                  Contagem de Destinatários Válidos:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-blue-700 font-mono">
                    {contagemAtual} empresas
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-white">
                    Fora Não-Contatar
                  </Badge>
                </div>
                <span className="text-[10px] text-slate-400">
                  Total em nutrição: {contagemDestinatarios.detalhes.totalEmNutricao} (A:{' '}
                  {contagemDestinatarios.curvaA}, B: {contagemDestinatarios.curvaB}, C:{' '}
                  {contagemDestinatarios.curvaC})
                </span>
              </div>
            </div>

            {/* Modelo Base (Opcional) */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-700">
                Carregar Modelo Predefinido:
              </Label>
              <Select value={templateId} onValueChange={handleSelecionarModelo}>
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue placeholder="Selecione um modelo da biblioteca" />
                </SelectTrigger>
                <SelectContent>
                  {modelos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} ({m.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assunto do E-mail */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium text-slate-700">Assunto do E-mail:</Label>
                <span className="text-[10px] text-slate-400">
                  Variáveis: {'{orgao}'}, {'{nome}'}
                </span>
              </div>
              <Input
                placeholder="Ex: Atualizações de Engenharia — Suporte Técnico ao Contrato com {orgao}"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Corpo do E-mail com Variáveis Obrigatórias */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium text-slate-700">Corpo do E-mail:</Label>
                <span className="text-[10px] font-semibold text-rose-600">
                  {'{link_descadastro}'} obrigatório
                </span>
              </div>
              <Textarea
                rows={7}
                placeholder="Escreva a mensagem aqui..."
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                className="text-xs font-mono leading-relaxed"
              />

              {/* Botões de atalho para inserir tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500 self-center mr-1">Inserir tag:</span>
                <button
                  type="button"
                  onClick={() => setCorpo((prev) => prev + ' {nome}')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-mono border border-slate-200"
                >
                  {'{nome}'}
                </button>
                <button
                  type="button"
                  onClick={() => setCorpo((prev) => prev + ' {orgao}')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-mono border border-slate-200"
                >
                  {'{orgao}'}
                </button>
                <button
                  type="button"
                  onClick={() => setCorpo((prev) => prev + ' {valor_contrato}')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-mono border border-slate-200"
                >
                  {'{valor_contrato}'}
                </button>
                <button
                  type="button"
                  onClick={() => setCorpo((prev) => prev + ' {link_descadastro}')}
                  className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-mono border border-rose-200 font-semibold"
                >
                  {'{link_descadastro}'}
                </button>
              </div>
            </div>

            {/* Aviso sobre aprovação */}
            <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded text-[11px] text-blue-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Fluxo de 4 Status:</strong> O Comercial cria e edita rascunhos livremente. O
                disparo e agendamento dependem exclusivamente da aprovação prévia do Administrador
                no banco de dados.
              </span>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalPreviaOpen(true)}
              className="text-xs"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Ver Prévia com Dados Reais
            </Button>

            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSalvar}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                {isEditing ? 'Salvar Alterações' : 'Salvar como Rascunho'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Prévia */}
      <PreviaCampanhaModal
        open={modalPreviaOpen}
        onOpenChange={setModalPreviaOpen}
        assunto={assunto}
        corpo={corpo}
        segmento={segmento}
        contagem={contagemDestinatarios}
      />
    </>
  )
}
