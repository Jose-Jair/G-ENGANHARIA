import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, CheckCircle2, ShieldAlert, ArrowRight, UserX } from 'lucide-react'
import { ToqueComCalculo, MotivoRecord } from '@/types'
import { toquesService } from '@/services/toques'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

interface ConfirmarToqueModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toque: ToqueComCalculo | null
  empresaNome?: string
  motivosInativacao: MotivoRecord[]
  onSuccess: () => void
}

export const ConfirmarToqueModal: React.FC<ConfirmarToqueModalProps> = ({
  open,
  onOpenChange,
  toque,
  empresaNome,
  motivosInativacao,
  onSuccess,
}) => {
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [dataRealizada, setDataRealizada] = useState<string>(
    new Date().toISOString().substring(0, 10),
  )
  const [canal, setCanal] = useState<string>(toque?.canal || 'email')
  const [resultado, setResultado] = useState<string>('Contato realizado com sucesso')
  const [observacao, setObservacao] = useState<string>('')
  const [desvio, setDesvio] = useState<
    'sem_resposta' | 'resposta_positiva' | 'recusa' | 'contato_invalido'
  >('sem_resposta')

  // Se recusa:
  const [acaoRecusa, setAcaoRecusa] = useState<'nutricao' | 'inativa'>('nutricao')
  const [motivoInativacao, setMotivoInativacao] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // Reset form when toque changes
  React.useEffect(() => {
    if (toque) {
      setCanal(toque.canal || 'email')
      setDataRealizada(new Date().toISOString().substring(0, 10))
      setObservacao('')
      setResultado('Contato realizado conforme roteiro')
      setDesvio('sem_resposta')
      setAcaoRecusa('nutricao')
      setMotivoInativacao(motivosInativacao[0]?.descricao || '')
    }
  }, [toque, motivosInativacao])

  if (!toque) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (desvio === 'recusa' && acaoRecusa === 'inativa') {
      if (!isAdmin) {
        toast({
          title: 'Permissão negada',
          description: 'Apenas Administradores podem inativar empresas.',
          variant: 'destructive',
        })
        return
      }
      if (!motivoInativacao) {
        toast({
          title: 'Motivo obrigatório',
          description: 'Selecione um motivo oficial de inativação.',
          variant: 'destructive',
        })
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await toquesService.confirmarToque({
        toque_id: toque.id,
        data_realizada: dataRealizada,
        canal,
        resultado,
        observacao,
        desvio,
        acao_recusa: desvio === 'recusa' ? acaoRecusa : undefined,
        motivo_inativacao:
          desvio === 'recusa' && acaoRecusa === 'inativa' ? motivoInativacao : undefined,
      })

      toast({
        title: 'Toque Confirmado',
        description: res.message,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      toast({
        title: 'Falha ao confirmar',
        description: err?.message || 'Ocorreu um erro ao registrar a confirmação.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Confirmar Toque {toque.numero_toque} — {empresaNome || 'Empresa'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Informe os dados reais da intervenção. A confirmação sequencial liberará o próximo toque
            ou aplicará o desvio selecionado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dataRealizada" className="text-xs font-semibold">
                Data Realizada *
              </Label>
              <Input
                id="dataRealizada"
                type="date"
                required
                value={dataRealizada}
                onChange={(e) => setDataRealizada(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="canal" className="text-xs font-semibold">
                Canal Utilizado *
              </Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger id="canal" className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">E-mail Corporativo</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp / Mensagem</SelectItem>
                  <SelectItem value="ligacao">Ligação Telefônica</SelectItem>
                  <SelectItem value="reuniao">Videoconferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="resultado" className="text-xs font-semibold">
              Resultado / Resumo do Contato *
            </Label>
            <Input
              id="resultado"
              required
              placeholder="Ex: Mensagem enviada e entregue; contato visualizou a proposta"
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Seção de Desvios e Respostas da Cadência */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3">
            <Label className="text-xs font-bold text-slate-800 block">
              Desfecho do Contato (Regras de Negócio):
            </Label>

            <RadioGroup
              value={desvio}
              onValueChange={(v: any) => setDesvio(v)}
              className="space-y-2 text-xs"
            >
              <div className="flex items-start space-x-2 bg-white p-2 rounded border border-slate-200">
                <RadioGroupItem value="sem_resposta" id="r_sem" className="mt-0.5" />
                <Label htmlFor="r_sem" className="font-normal cursor-pointer flex-1 text-slate-700">
                  <strong className="text-slate-900 block font-medium">
                    Sem resposta imediata
                  </strong>
                  Avança o ciclo normalmente: libera o próximo toque ({toque.numero_toque + 1}) no
                  tempo previsto.
                </Label>
              </div>

              <div className="flex items-start space-x-2 bg-blue-50/50 p-2 rounded border border-blue-200">
                <RadioGroupItem
                  value="resposta_positiva"
                  id="r_pos"
                  className="mt-0.5 text-blue-600"
                />
                <Label htmlFor="r_pos" className="font-normal cursor-pointer flex-1 text-blue-900">
                  <strong className="text-blue-950 block font-semibold flex items-center gap-1">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600" /> Resposta Positiva
                    (Interesse)
                  </strong>
                  Move empresa para <strong>"Em conversa"</strong> no funil. Encerra a cadência com
                  sucesso.
                </Label>
              </div>

              <div className="flex items-start space-x-2 bg-amber-50/50 p-2 rounded border border-amber-200">
                <RadioGroupItem value="recusa" id="r_rec" className="mt-0.5 text-amber-600" />
                <Label htmlFor="r_rec" className="font-normal cursor-pointer flex-1 text-amber-900">
                  <strong className="text-amber-950 block font-semibold flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5 text-amber-600" /> Recusa / Desinteresse
                  </strong>
                  Direciona para Nutrição Mensal ou Inativação com motivo obrigatório.
                </Label>
              </div>

              <div className="flex items-start space-x-2 bg-rose-50/50 p-2 rounded border border-rose-200">
                <RadioGroupItem
                  value="contato_invalido"
                  id="r_inv"
                  className="mt-0.5 text-rose-600"
                />
                <Label htmlFor="r_inv" className="font-normal cursor-pointer flex-1 text-rose-900">
                  <strong className="text-rose-950 block font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> E-mail rejeitado ou
                    WhatsApp inválido
                  </strong>
                  Gera PENDÊNCIA urgente de contato na Central e no cartão da empresa.
                </Label>
              </div>
            </RadioGroup>

            {/* Sub-opções de Recusa */}
            {desvio === 'recusa' && (
              <div className="mt-2 pt-2 border-t border-amber-200 space-y-3 bg-amber-50/80 p-3 rounded">
                <Label className="text-xs font-semibold text-amber-950">Destino da Recusa:</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={acaoRecusa === 'nutricao' ? 'default' : 'outline'}
                    onClick={() => setAcaoRecusa('nutricao')}
                    className="text-xs h-8"
                  >
                    Mover para Nutrição Mensal
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={acaoRecusa === 'inativa' ? 'destructive' : 'outline'}
                    onClick={() => setAcaoRecusa('inativa')}
                    className="text-xs h-8"
                    disabled={!isAdmin}
                    title={!isAdmin ? 'Apenas Admin pode inativar' : ''}
                  >
                    Inativar Empresa {isAdmin ? '' : '(Só Admin)'}
                  </Button>
                </div>

                {acaoRecusa === 'inativa' && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs text-rose-800 font-semibold flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      Motivo Oficial de Inativação *
                    </Label>
                    <Select value={motivoInativacao} onValueChange={setMotivoInativacao}>
                      <SelectTrigger className="h-8 text-xs bg-white border-rose-300">
                        <SelectValue placeholder="Selecione o motivo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {motivosInativacao.map((m) => (
                          <SelectItem key={m.id} value={m.descricao}>
                            {m.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="obs" className="text-xs font-semibold">
              Observações Adicionais
            </Label>
            <Textarea
              id="obs"
              rows={2}
              placeholder="Anotações internas sobre a resposta ou próximos passos..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {submitting ? 'Salvando...' : 'Confirmar e Atualizar Cadência'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
