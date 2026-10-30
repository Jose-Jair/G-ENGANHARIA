import React, { useState, useEffect } from 'react'
import {
  User,
  Briefcase,
  Layers,
  FileText,
  DollarSign,
  Clock,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Download,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { prestadoresService, prestadoresDocumentosService } from '@/services/prestadores'
import {
  PrestadorRecord,
  PrestadorDocumentoRecord,
  PortfolioItem,
  PrecoReferenciaItem,
  DisponibilidadeItem,
  TipoDocumentoPrestador,
} from '@/types'
import { formatDateBr } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'

interface PortalMeuCadastroProps {
  prestador: PrestadorRecord
  onAtualizado?: () => void
}

export const PortalMeuCadastro: React.FC<PortalMeuCadastroProps> = ({
  prestador,
  onAtualizado,
}) => {
  const { toast } = useToast()

  // Portfólio
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  // Preços de referência
  const [precosReferencia, setPrecosReferencia] = useState<PrecoReferenciaItem[]>([])
  // Disponibilidade
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeItem>({
    horas_semana: 20,
    inicio_disponivel: 'imediato',
    dias_uteis: true,
    finais_semana: false,
    observacoes: '',
  })

  // Documentos
  const [documentos, setDocumentos] = useState<PrestadorDocumentoRecord[]>([])
  const [carregandoDocs, setCarregandoDocs] = useState(true)
  const [tipoDocUpload, setTipoDocUpload] = useState<TipoDocumentoPrestador>('certidao_conselho')
  const [arquivoUpload, setArquivoUpload] = useState<File | null>(null)
  const [enviandoDoc, setEnviandoDoc] = useState(false)

  // Salvamento de dados
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)

  // Inicializar com dados do prestador
  useEffect(() => {
    if (prestador) {
      if (Array.isArray(prestador.portfolio_json)) {
        setPortfolio(prestador.portfolio_json)
      } else {
        setPortfolio([])
      }

      if (Array.isArray(prestador.preco_referencia_json)) {
        setPrecosReferencia(prestador.preco_referencia_json)
      } else {
        setPrecosReferencia([])
      }

      if (prestador.disponibilidade_json) {
        setDisponibilidade(prestador.disponibilidade_json)
      }
    }
  }, [prestador])

  // Carregar Documentos
  const carregarDocs = async () => {
    if (!prestador?.id) return
    setCarregandoDocs(true)
    try {
      const lista = await prestadoresDocumentosService.listByPrestador(prestador.id)
      setDocumentos(lista)
    } catch (_) {
      setDocumentos([])
    } finally {
      setCarregandoDocs(false)
    }
  }

  useEffect(() => {
    carregarDocs()
  }, [prestador?.id])

  // Portfólio Handlers
  const handleAdicionarPortfolio = () => {
    if (portfolio.length >= 10) return
    setPortfolio([
      ...portfolio,
      {
        titulo: '',
        descricao: '',
        cliente_referencia: '',
        ano: new Date().getFullYear(),
        disciplina: '',
        link_url: '',
      },
    ])
  }

  const handleRemoverPortfolio = (index: number) => {
    setPortfolio(portfolio.filter((_, i) => i !== index))
  }

  const handleAtualizarPortfolio = (index: number, campo: keyof PortfolioItem, valor: any) => {
    const novo = [...portfolio]
    novo[index] = { ...novo[index], [campo]: valor }
    setPortfolio(novo)
  }

  // Preços Handlers
  const handleAdicionarPreco = () => {
    if (precosReferencia.length >= 12) return
    setPrecosReferencia([
      ...precosReferencia,
      { disciplina: '', unidade: 'hora', valor_referencia: undefined, observacoes: '' },
    ])
  }

  const handleRemoverPreco = (index: number) => {
    setPrecosReferencia(precosReferencia.filter((_, i) => i !== index))
  }

  const handleAtualizarPreco = (index: number, campo: keyof PrecoReferenciaItem, valor: any) => {
    const novo = [...precosReferencia]
    novo[index] = { ...novo[index], [campo]: valor }
    setPrecosReferencia(novo)
  }

  // Salvar Portfólio, Preços e Disponibilidade
  const handleSalvarTudo = async () => {
    if (!prestador?.id) return
    setSalvandoPerfil(true)
    try {
      const portfolioValido = portfolio.filter(
        (item) => item.titulo && item.titulo.trim().length > 0,
      )
      const precosValidos = precosReferencia.filter(
        (p) => p.disciplina && p.disciplina.trim().length > 0,
      )

      await prestadoresService.updatePerfilPrestador(prestador.id, {
        portfolio_json: portfolioValido,
        preco_referencia_json: precosValidos,
        disponibilidade_json: disponibilidade,
      })

      toast({
        title: 'Cadastro técnico atualizado!',
        description:
          'Seu portfólio, preços de referência e disponibilidade foram salvos com sucesso.',
      })

      if (onAtualizado) onAtualizado()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar cadastro',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoPerfil(false)
    }
  }

  // Upload de Documento
  const handleUploadDocumento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!arquivoUpload || !prestador?.id) {
      toast({
        title: 'Arquivo não selecionado',
        description: 'Selecione um arquivo PDF ou imagem para enviar.',
        variant: 'destructive',
      })
      return
    }

    setEnviandoDoc(true)
    try {
      await prestadoresDocumentosService.uploadDocumento(prestador.id, tipoDocUpload, arquivoUpload)

      toast({
        title: 'Documento enviado!',
        description: 'O arquivo foi gravado de forma segura e encaminhado para validação técnica.',
      })

      setArquivoUpload(null)
      // Reset input
      const fileInput = document.getElementById('input-doc-prestador') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      carregarDocs()
    } catch (err: any) {
      toast({
        title: 'Erro no envio do documento',
        description: err.message || 'Verifique o formato e tamanho do arquivo.',
        variant: 'destructive',
      })
    } finally {
      setEnviandoDoc(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DA ABA */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Meu Cadastro Técnico</h2>
            <Badge className="bg-[#D95A2B] text-white text-[10px]">Portal do Prestador</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Mantenha seu portfólio, tabela de preços de referência, disponibilidade semanal e
            documentos profissionais sempre atualizados junto à G+ Engenharia.
          </p>
        </div>

        <Button
          onClick={handleSalvarTudo}
          disabled={salvandoPerfil}
          className="bg-[#D95A2B] hover:bg-[#b84820] text-white text-xs gap-1.5 shadow-xs"
        >
          {salvandoPerfil ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>

      {/* SEÇÃO 1: PORTFÓLIO DE PROJETOS */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#D95A2B]" />
              Portfólio de Trabalhos Anteriores ({portfolio.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Adicione projetos de engenharia executados, links de nuvem e escopos desenvolvidos.
            </CardDescription>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAdicionarPortfolio}
            disabled={portfolio.length >= 10}
            className="text-xs border-[#D95A2B] text-[#D95A2B] hover:bg-orange-50 gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Projeto
          </Button>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {portfolio.length === 0 ? (
            <p className="text-xs text-slate-400 p-6 bg-slate-50 rounded-lg text-center">
              Nenhum item no portfólio. Clique no botão acima para adicionar seus projetos.
            </p>
          ) : (
            portfolio.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Projeto #{idx + 1}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRemoverPortfolio(idx)}
                    className="h-6 w-6 text-rose-600 hover:text-rose-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label className="text-[11px] text-slate-600">Título do Trabalho *</Label>
                    <Input
                      placeholder="Ex: Projeto Executivo de Instalações Elétricas Hospitalares"
                      value={item.titulo}
                      onChange={(e) => handleAtualizarPortfolio(idx, 'titulo', e.target.value)}
                      className="text-xs mt-0.5 bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-slate-600">Cliente ou Contratante</Label>
                    <Input
                      placeholder="Ex: Construtora ou Particular"
                      value={item.cliente_referencia || ''}
                      onChange={(e) =>
                        handleAtualizarPortfolio(idx, 'cliente_referencia', e.target.value)
                      }
                      className="text-xs mt-0.5 bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-slate-600">Ano de Conclusão</Label>
                    <Input
                      placeholder="Ex: 2024"
                      value={item.ano || ''}
                      onChange={(e) => handleAtualizarPortfolio(idx, 'ano', e.target.value)}
                      className="text-xs mt-0.5 bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-slate-600">Disciplina Aplicada</Label>
                    <Input
                      placeholder="Ex: Elétrica / Subestação"
                      value={item.disciplina || ''}
                      onChange={(e) => handleAtualizarPortfolio(idx, 'disciplina', e.target.value)}
                      className="text-xs mt-0.5 bg-white"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] text-slate-600">Link Externo / Nuvem</Label>
                    <Input
                      placeholder="https://drive.google.com/..."
                      value={item.link_url || ''}
                      onChange={(e) => handleAtualizarPortfolio(idx, 'link_url', e.target.value)}
                      className="text-xs mt-0.5 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-[11px] text-slate-600">Descrição do Escopo</Label>
                    <Textarea
                      placeholder="Detalhes técnicos, área construída, softwares BIM utilizados..."
                      value={item.descricao || ''}
                      onChange={(e) => handleAtualizarPortfolio(idx, 'descricao', e.target.value)}
                      className="text-xs mt-0.5 bg-white min-h-[60px]"
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO 2: PREÇOS DE REFERÊNCIA & DISPONIBILIDADE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preços de Referência */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#D95A2B]" />
                Tabela de Preços de Referência
              </CardTitle>
              <CardDescription className="text-xs">
                Valores médios para cálculo rápido de cotações em novas oportunidades.
              </CardDescription>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAdicionarPreco}
              className="text-xs border-slate-300 text-slate-700"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar
            </Button>
          </CardHeader>

          <CardContent className="p-5 space-y-3">
            {precosReferencia.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 bg-slate-50 rounded-lg text-center">
                Nenhuma referência de preço configurada.
              </p>
            ) : (
              precosReferencia.map((preco, pIdx) => (
                <div
                  key={pIdx}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                >
                  <div className="sm:col-span-5">
                    <Label className="text-[10px] text-slate-500">Disciplina / Serviço</Label>
                    <Input
                      placeholder="Ex: Cálculo Estrutural"
                      value={preco.disciplina}
                      onChange={(e) => handleAtualizarPreco(pIdx, 'disciplina', e.target.value)}
                      className="text-xs mt-0.5 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Label className="text-[10px] text-slate-500">Unidade</Label>
                    <Select
                      value={preco.unidade}
                      onValueChange={(val) => handleAtualizarPreco(pIdx, 'unidade', val)}
                    >
                      <SelectTrigger className="text-xs mt-0.5 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hora">R$ / Hora</SelectItem>
                        <SelectItem value="m2">R$ / m²</SelectItem>
                        <SelectItem value="projeto">R$ / Escopo</SelectItem>
                        <SelectItem value="item">R$ / Prancha</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-3">
                    <Label className="text-[10px] text-slate-500">Valor (R$)</Label>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={preco.valor_referencia || ''}
                      onChange={(e) =>
                        handleAtualizarPreco(
                          pIdx,
                          'valor_referencia',
                          e.target.value ? parseFloat(e.target.value) : undefined,
                        )
                      }
                      className="text-xs mt-0.5 bg-white font-mono"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoverPreco(pIdx)}
                      className="h-8 w-8 text-rose-500 hover:text-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Disponibilidade Operacional */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-5 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D95A2B]" />
              Disponibilidade Semanal
            </CardTitle>
            <CardDescription className="text-xs">
              Informe sua carga horária disponível para prestar serviços à G+ Engenharia.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Horas Semanais Disponíveis
              </Label>
              <Input
                type="number"
                placeholder="Ex: 20"
                value={disponibilidade.horas_semana || ''}
                onChange={(e) =>
                  setDisponibilidade({
                    ...disponibilidade,
                    horas_semana: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Previsão para Início</Label>
              <Select
                value={disponibilidade.inicio_disponivel || 'imediato'}
                onValueChange={(val) =>
                  setDisponibilidade({ ...disponibilidade, inicio_disponivel: val })
                }
              >
                <SelectTrigger className="text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imediato">Disponibilidade Imediata</SelectItem>
                  <SelectItem value="15_dias">Em até 15 dias</SelectItem>
                  <SelectItem value="30_dias">Em até 30 dias</SelectItem>
                  <SelectItem value="sob_consulta">A combinar por demanda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Observações de Horários / Agenda
              </Label>
              <Textarea
                placeholder="Ex: Foco no turno matutino, reuniões de alinhamento após 17h..."
                value={disponibilidade.observacoes || ''}
                onChange={(e) =>
                  setDisponibilidade({ ...disponibilidade, observacoes: e.target.value })
                }
                className="text-xs mt-1 min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO 3: DOCUMENTOS COMPROBATÓRIOS */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Documentos Comprobatórios (Arquivos Protegidos)
          </CardTitle>
          <CardDescription className="text-xs">
            Envie sua certidão de registro em conselho (CREA/CAU), comprovante de endereço ou
            documentos da empresa para homologação técnica.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-6">
          {/* Formulário de Envio */}
          <form
            onSubmit={handleUploadDocumento}
            className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-end gap-3"
          >
            <div className="w-full sm:w-64">
              <Label className="text-xs font-semibold text-slate-700">Tipo de Documento</Label>
              <Select
                value={tipoDocUpload}
                onValueChange={(val) => setTipoDocUpload(val as TipoDocumentoPrestador)}
              >
                <SelectTrigger className="text-xs mt-1 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="certidao_conselho">Certidão do Conselho (CREA/CAU)</SelectItem>
                  <SelectItem value="contrato_social">Contrato Social / MEI</SelectItem>
                  <SelectItem value="diploma">Diploma de Graduação / Pós</SelectItem>
                  <SelectItem value="comprovante_endereco">Comprovante de Endereço</SelectItem>
                  <SelectItem value="acervo_tecnico">Certidão de Acervo Técnico (CAT)</SelectItem>
                  <SelectItem value="outro">Outro Comprovante</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 w-full">
              <Label className="text-xs font-semibold text-slate-700">
                Arquivo (PDF ou Imagem)
              </Label>
              <Input
                id="input-doc-prestador"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setArquivoUpload(e.target.files?.[0] || null)}
                className="text-xs mt-1 bg-white"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={enviandoDoc || !arquivoUpload}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shrink-0"
            >
              {enviandoDoc ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Enviar Documento
                </>
              )}
            </Button>
          </form>

          {/* Lista de Documentos Anexados */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 mb-2">
              Documentos Registrados ({documentos.length})
            </h4>

            {carregandoDocs ? (
              <div className="p-6 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#D95A2B] mx-auto" />
              </div>
            ) : documentos.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 bg-slate-50 rounded-lg text-center">
                Nenhum documento anexado ainda. Utilize o formulário acima para enviar seus
                arquivos.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white overflow-hidden">
                {documentos.map((doc) => (
                  <div key={doc.id} className="p-3 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 uppercase block text-[11px]">
                        {doc.tipo.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Enviado em {formatDateBr(doc.created)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          doc.status_verificacao === 'aprovado'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : doc.status_verificacao === 'rejeitado'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        {doc.status_verificacao || 'Pendente'}
                      </Badge>

                      {doc.arquivo && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const url = pb.files.getUrl(doc, doc.arquivo)
                            window.open(url, '_blank')
                          }}
                          className="h-7 text-xs text-blue-600 gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Visualizar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PortalMeuCadastro
