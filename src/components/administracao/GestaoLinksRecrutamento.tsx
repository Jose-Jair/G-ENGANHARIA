import React, { useState, useEffect } from 'react'
import {
  Link as LinkIcon,
  Plus,
  Copy,
  Check,
  Power,
  Calendar,
  Layers,
  Users,
  Search,
  Loader2,
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { recrutamentoService, prestadoresService } from '@/services/prestadores'
import { LinkRecrutamentoRecord } from '@/types'
import { formatDateBr } from '@/lib/formatters'

export const GestaoLinksRecrutamento: React.FC = () => {
  const { toast } = useToast()

  const [links, setLinks] = useState<LinkRecrutamentoRecord[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  // Inscritos por link
  const [inscritosPorLink, setInscritosPorLink] = useState<Record<string, number>>({})

  // Modal Criar Link
  const [modalCriarOpen, setModalCriarOpen] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [slugInput, setSlugInput] = useState('')
  const [tituloInput, setTituloInput] = useState('')
  const [disciplinaAlvoInput, setDisciplinaAlvoInput] = useState('')
  const [expiraEmInput, setExpiraEmInput] = useState('')

  const carregarDados = async () => {
    setCarregando(true)
    try {
      const listaLinks = await recrutamentoService.listLinks()
      setLinks(listaLinks)

      // Carregar total de inscritos por disciplina/slug cruzando prestadores com origem "publico"
      try {
        const prestadores = await prestadoresService.list("origem_cadastro = 'publico'")
        const contadores: Record<string, number> = {}

        // Mapear inscritos
        for (const p of prestadores) {
          const disc = (p.disciplinas || '').toLowerCase()
          for (const l of listaLinks) {
            const discAlvo = (l.disciplina_alvo || '').toLowerCase()
            if (
              discAlvo &&
              (disc.includes(discAlvo) || discAlvo.includes(disc) || discAlvo === 'geral')
            ) {
              contadores[l.id] = (contadores[l.id] || 0) + 1
            }
          }
        }
        setInscritosPorLink(contadores)
      } catch {
        /* intentionally ignored */
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar links de recrutamento',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  // Gerador de slug amigável
  const formatarSlug = (val: string) => {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleAbrirCriar = () => {
    setSlugInput('')
    setTituloInput('')
    setDisciplinaAlvoInput('')
    setExpiraEmInput('')
    setModalCriarOpen(true)
  }

  const handleSalvarLink = async (e: React.FormEvent) => {
    e.preventDefault()
    const slugFormatado = formatarSlug(slugInput)
    if (!slugFormatado) {
      toast({
        title: 'Slug inválido',
        description: 'Informe um identificador amigável para o link (ex: estruturas-2026).',
        variant: 'destructive',
      })
      return
    }

    setSalvando(true)
    try {
      await recrutamentoService.createLink({
        slug: slugFormatado,
        titulo: tituloInput.trim() || undefined,
        disciplina_alvo: disciplinaAlvoInput.trim() || undefined,
        ativo: true,
        expira_em: expiraEmInput ? new Date(expiraEmInput).toISOString() : undefined,
      })

      toast({
        title: 'Link de recrutamento criado com sucesso!',
        description: `/pre-cadastro/${slugFormatado}`,
      })
      setModalCriarOpen(false)
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar link',
        description: err.message || 'Verifique se já existe um link com este slug.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const handleToggleAtivo = async (link: LinkRecrutamentoRecord) => {
    try {
      const novoStatus = !link.ativo
      await recrutamentoService.updateLink(link.id, { ativo: novoStatus })
      toast({
        title: novoStatus ? 'Link ativado com sucesso!' : 'Link desativado/expirado!',
        description: `O link /pre-cadastro/${link.slug} agora está ${novoStatus ? 'ativo' : 'inativo'}.`,
      })
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar link',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleCopiarLink = (slug: string, id: string) => {
    const origin = window.location.origin
    const url = `${origin}/pre-cadastro/${slug}`
    navigator.clipboard.writeText(url)
    setCopiadoId(id)
    toast({
      title: 'Link copiado para a área de transferência!',
      description: url,
    })
    setTimeout(() => {
      setCopiadoId(null)
    }, 2500)
  }

  const existeLinkGeralAtivo = links.some((l) => {
    if (l.slug.toLowerCase() !== 'geral') return false
    if (!l.ativo) return false
    if (l.expira_em && new Date(l.expira_em).getTime() < Date.now()) return false
    return true
  })

  const handleCriarLinkGeral = async () => {
    setSalvando(true)
    try {
      await recrutamentoService.createLink({
        slug: 'geral',
        titulo: 'Banco de Talentos e Especialistas — G+ Engenharia',
        disciplina_alvo: '',
        ativo: true,
      })
      toast({
        title: 'Link geral de recrutamento criado com sucesso!',
        description: 'Acesse /pre-cadastro/geral publicamente sem necessidade de login.',
      })
      carregarDados()
    } catch (err: any) {
      toast({
        title: 'Erro ao criar link geral de recrutamento',
        description: err.message || 'Verifique se já existe um registro com slug geral.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const linksFiltrados = links.filter((l) => {
    const termo = busca.toLowerCase()
    return (
      l.slug.toLowerCase().includes(termo) ||
      (l.titulo && l.titulo.toLowerCase().includes(termo)) ||
      (l.disciplina_alvo && l.disciplina_alvo.toLowerCase().includes(termo))
    )
  })

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="p-4 md:p-6 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg text-slate-900">
                Links Públicos de Recrutamento
              </CardTitle>
              <Badge className="bg-[#D95A2B] text-white text-[10px]">Rodada 12</Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Crie links públicos com slugs amigáveis para captar prestadores de serviços,
              direcionados por disciplina técnica e com controle de validade.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!existeLinkGeralAtivo && (
              <Button
                onClick={handleCriarLinkGeral}
                disabled={salvando}
                variant="outline"
                className="border-[#D95A2B] text-[#D95A2B] hover:bg-orange-50 text-xs gap-1.5 shadow-xs font-semibold"
                title="Criar o link canônico público /pre-cadastro/geral para recepção de especialistas"
              >
                {salvando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#D95A2B]" />
                )}
                Criar link geral de recrutamento
              </Button>
            )}

            <Button
              onClick={handleAbrirCriar}
              className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Novo Link de Recrutamento
            </Button>
          </div>
        </div>

        {!existeLinkGeralAtivo && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <strong>Atenção:</strong> Não há um link de recrutamento com slug{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">
                  geral
                </code>{' '}
                ativo. O link público{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px]">
                  /pre-cadastro/geral
                </code>{' '}
                está indisponível até que o registro seja criado.
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleCriarLinkGeral}
              disabled={salvando}
              className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-[11px] h-7 shrink-0 font-medium"
            >
              Criar link geral de recrutamento
            </Button>
          </div>
        )}

        {/* Busca */}
        <div className="pt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por slug, título ou disciplina-alvo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 pt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-y border-slate-200">
              <tr>
                <th className="py-3 px-4">Slug / Título do Link</th>
                <th className="py-3 px-4">Disciplina-Alvo</th>
                <th className="py-3 px-4">Validade / Expiração</th>
                <th className="py-3 px-4 text-center">Acessos</th>
                <th className="py-3 px-4 text-center">Inscritos Estimados</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {carregando ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D95A2B]" />
                    Carregando links de recrutamento...
                  </td>
                </tr>
              ) : linksFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum link de recrutamento cadastrado ou compatível com a busca.
                  </td>
                </tr>
              ) : (
                linksFiltrados.map((item) => {
                  const estaExpirado =
                    item.expira_em && new Date(item.expira_em).getTime() < Date.now()
                  const statusEfetivo = item.ativo && !estaExpirado

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-3.5 h-3.5 text-[#D95A2B] shrink-0" />
                          <div>
                            <span className="font-mono font-bold text-slate-900 block text-xs">
                              /pre-cadastro/{item.slug}
                            </span>
                            <span className="text-[11px] text-slate-500 line-clamp-1">
                              {item.titulo || 'Formulário Padrão de Triagem G+'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {item.disciplina_alvo ? (
                          <Badge
                            variant="outline"
                            className="text-[11px] bg-orange-50 border-orange-200 text-orange-800 font-medium"
                          >
                            <Layers className="w-3 h-3 mr-1" />
                            {item.disciplina_alvo}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 italic">Geral (todas as áreas)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {item.expira_em ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className={estaExpirado ? 'text-rose-600 font-semibold' : ''}>
                              {formatDateBr(item.expira_em)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Sem data limite</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                        {item.contador_acessos || 0}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800">
                          <Users className="w-3.5 h-3.5 text-blue-600" />
                          {inscritosPorLink[item.id] || 0}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {statusEfetivo ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-medium">
                            Ativo
                          </Badge>
                        ) : estaExpirado ? (
                          <Badge variant="destructive" className="text-[10px] font-medium">
                            Expirado
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium text-slate-500"
                          >
                            Desativado
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopiarLink(item.slug, item.id)}
                          className="h-7 text-xs text-[#D95A2B] hover:text-[#b84820] hover:bg-orange-50 gap-1"
                          title="Copiar URL pública para a área de transferência"
                        >
                          {copiadoId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar Link</span>
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/pre-cadastro/${item.slug}`, '_blank')}
                          className="h-7 text-xs text-blue-600 hover:text-blue-800"
                          title="Abrir página pública em nova aba"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAtivo(item)}
                          className={`h-7 text-xs ${
                            item.ativo
                              ? 'text-amber-600 hover:text-amber-700'
                              : 'text-emerald-600 hover:text-emerald-700'
                          }`}
                          title={item.ativo ? 'Desativar link' : 'Ativar link'}
                        >
                          <Power className="w-3.5 h-3.5 mr-1" />
                          {item.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Modal Criar Link de Recrutamento */}
      <Dialog open={modalCriarOpen} onOpenChange={setModalCriarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1E2A4A] flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-[#D95A2B]" />
              Novo Link de Recrutamento
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure o slug amigável, título e disciplina direcionada para este canal de
              captação.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarLink} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Slug da URL *</Label>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-slate-400 font-mono">/pre-cadastro/</span>
                <Input
                  placeholder="ex: estrutural-2026"
                  value={slugInput}
                  onChange={(e) => setSlugInput(e.target.value)}
                  className="text-xs font-mono"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Apenas letras minúsculas, números e hífens.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Título ou Chamada Pública
              </Label>
              <Input
                placeholder="Ex: Credenciamento de Projetistas Estruturais (2026)"
                value={tituloInput}
                onChange={(e) => setTituloInput(e.target.value)}
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Disciplina-Alvo (Opcional)
              </Label>
              <Input
                placeholder="Ex: Estrutural, Elétrica, Hidrossanitário..."
                value={disciplinaAlvoInput}
                onChange={(e) => setDisciplinaAlvoInput(e.target.value)}
                className="text-xs mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Se preenchida, virá pré-selecionada no formulário público do prestador.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Data de Expiração (Opcional)
              </Label>
              <Input
                type="date"
                value={expiraEmInput}
                onChange={(e) => setExpiraEmInput(e.target.value)}
                className="text-xs mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Após esta data, novas submissões serão recusadas automaticamente pelo servidor.
              </p>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalCriarOpen(false)}
                disabled={salvando}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvando}
                className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs gap-1.5 shadow-xs"
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Criando Link...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Salvar e Ativar Link
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default GestaoLinksRecrutamento
