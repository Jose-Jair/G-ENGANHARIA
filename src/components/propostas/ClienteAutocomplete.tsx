import React, { useState, useMemo, useRef, useEffect } from 'react'
import { EmpresaRecord, ClientePfRecord } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Search, Building2, User, Plus, Check, X } from 'lucide-react'

// Normalização para busca insensível a maiúsculas/minúsculas e acentos
export function normalizeText(str: string | undefined | null): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

interface ClienteAutocompleteProps {
  tipo: 'pj' | 'pf'
  empresas: EmpresaRecord[]
  clientesPf: ClientePfRecord[]
  selectedEmpresaId: string
  selectedClientePfId: string
  onSelectEmpresa: (id: string) => void
  onSelectClientePf: (id: string) => void
  onOpenNovoClienteModal: () => void
  onTipoChange?: (tipo: 'pj' | 'pf') => void
}

export const ClienteAutocomplete: React.FC<ClienteAutocompleteProps> = ({
  tipo,
  empresas,
  clientesPf,
  selectedEmpresaId,
  selectedClientePfId,
  onSelectEmpresa,
  onSelectClientePf,
  onOpenNovoClienteModal,
  onTipoChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Item atualmente selecionado
  const selectedEmpresa = useMemo(
    () => empresas.find((e) => e.id === selectedEmpresaId),
    [empresas, selectedEmpresaId],
  )
  const selectedClientePf = useMemo(
    () => clientesPf.find((c) => c.id === selectedClientePfId),
    [clientesPf, selectedClientePfId],
  )

  // Itens filtrados com busca dinâmica, sem acentos, com dígitos de CNPJ/CPF/Telefone
  const filteredEmpresas = useMemo(() => {
    const term = normalizeText(searchTerm)
    const cleanDigits = searchTerm.replace(/\D/g, '')

    if (!term) return empresas.slice(0, 15)

    return empresas
      .filter((e) => {
        const razao = normalizeText(e.razao_social)
        const fantasia = normalizeText(e.nome_fantasia)
        const email = normalizeText(e.email)
        const municipio = normalizeText(e.municipio)
        const uf = normalizeText(e.uf)
        const cnpjClean = (e.cnpj || '').replace(/\D/g, '')
        const telClean = (e.telefone || '').replace(/\D/g, '')

        const matchText =
          razao.includes(term) ||
          fantasia.includes(term) ||
          email.includes(term) ||
          municipio.includes(term) ||
          uf === term

        const matchDigits =
          cleanDigits.length > 0 &&
          (cnpjClean.includes(cleanDigits) || telClean.includes(cleanDigits))

        return matchText || matchDigits
      })
      .slice(0, 25)
  }, [empresas, searchTerm])

  const filteredClientesPf = useMemo(() => {
    const term = normalizeText(searchTerm)
    const cleanDigits = searchTerm.replace(/\D/g, '')

    if (!term) return clientesPf.slice(0, 15)

    return clientesPf
      .filter((c) => {
        const nome = normalizeText(c.nome)
        const email = normalizeText(c.email)
        const municipio = normalizeText(c.municipio)
        const uf = normalizeText(c.uf)
        const cpfClean = (c.cpf || '').replace(/\D/g, '')
        const telClean = (c.telefone || '').replace(/\D/g, '')

        const matchText =
          nome.includes(term) || email.includes(term) || municipio.includes(term) || uf === term

        const matchDigits =
          cleanDigits.length > 0 &&
          (cpfClean.includes(cleanDigits) || telClean.includes(cleanDigits))

        return matchText || matchDigits
      })
      .slice(0, 25)
  }, [clientesPf, searchTerm])

  // Resultados alternativos caso a busca do tipo atual não retorne nada
  const matchInOtherTipo = useMemo(() => {
    if (!searchTerm.trim()) return 0
    if (tipo === 'pj') {
      return filteredClientesPf.length
    } else {
      return filteredEmpresas.length
    }
  }, [tipo, searchTerm, filteredClientesPf.length, filteredEmpresas.length])

  const isSelected = tipo === 'pj' ? !!selectedEmpresa : !!selectedClientePf

  return (
    <div ref={containerRef} className="space-y-1 relative">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          {tipo === 'pj' ? (
            <>
              <Building2 className="w-3.5 h-3.5 text-orange-600" />
              Empresa Contratante (PJ) *
            </>
          ) : (
            <>
              <User className="w-3.5 h-3.5 text-orange-600" />
              Cliente Pessoa Física (PF) *
            </>
          )}
        </Label>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenNovoClienteModal}
          className="h-6 text-[11px] gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
        >
          <Plus className="w-3 h-3" />
          {tipo === 'pj' ? 'Cadastrar nova empresa' : 'Cadastrar novo cliente PF'}
        </Button>
      </div>

      {isSelected && !isOpen ? (
        <div className="flex items-center justify-between p-2 rounded-md border border-orange-200 bg-orange-50/60 text-xs">
          <div className="flex items-center gap-2 truncate">
            {tipo === 'pj' && selectedEmpresa ? (
              <>
                <Building2 className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="font-semibold text-slate-900 truncate">
                  {selectedEmpresa.razao_social}
                </span>
                {selectedEmpresa.nome_fantasia && (
                  <span className="text-[11px] text-slate-600 font-normal truncate">
                    ({selectedEmpresa.nome_fantasia})
                  </span>
                )}
                {selectedEmpresa.pre_cadastro && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 shrink-0"
                  >
                    [Pré-cadastro]
                  </Badge>
                )}
                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                  ({selectedEmpresa.cnpj || 'Sem CNPJ'})
                </span>
              </>
            ) : selectedClientePf ? (
              <>
                <User className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="font-semibold text-slate-900 truncate">
                  {selectedClientePf.nome}
                </span>
                {selectedClientePf.pre_cadastro && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 shrink-0"
                  >
                    [Pré-cadastro]
                  </Badge>
                )}
                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                  ({selectedClientePf.cpf || selectedClientePf.telefone || 'Sem CPF'})
                </span>
              </>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('')
                setIsOpen(true)
              }}
              className="h-6 text-[10px] text-slate-600 hover:text-slate-900"
            >
              Trocar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (tipo === 'pj') onSelectEmpresa('')
                else onSelectClientePf('')
                setSearchTerm('')
                setIsOpen(true)
              }}
              className="h-6 w-6 p-0 text-slate-400 hover:text-red-600"
              title="Limpar seleção"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder={
                tipo === 'pj'
                  ? 'Buscar PJ por razão social, nome fantasia, CNPJ, e-mail ou cidade...'
                  : 'Buscar PF por nome completo, CPF, telefone ou e-mail...'
              }
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              className="pl-8 text-xs h-9 pr-8"
              autoFocus={isOpen && !isSelected}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                title="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* DROPDOWN DE SUGESTÕES */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1 text-xs">
              {tipo === 'pj' ? (
                filteredEmpresas.length === 0 ? (
                  <div className="p-3 text-center text-slate-500 space-y-2">
                    <p>Nenhuma empresa encontrada com &quot;{searchTerm}&quot;.</p>

                    {matchInOtherTipo > 0 && onTipoChange && (
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs">
                        <span>
                          Encontramos {matchInOtherTipo} cliente(s) em{' '}
                          <strong>Pessoa Física (PF)</strong>.
                        </span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => onTipoChange('pf')}
                          className="text-blue-700 underline text-xs font-semibold block mx-auto mt-0.5 p-0 h-auto"
                        >
                          Mudar para busca de Pessoa Física (PF)
                        </Button>
                      </div>
                    )}

                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setIsOpen(false)
                        onOpenNovoClienteModal()
                      }}
                      className="text-orange-600 text-xs mt-1 p-0 h-auto font-medium"
                    >
                      + Cadastrar &quot;{searchTerm}&quot; como nova empresa (PJ)
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-1 bg-slate-50 text-[10px] text-slate-500 font-semibold border-b uppercase tracking-wider flex items-center justify-between">
                      <span>Empresas cadastradas ({filteredEmpresas.length})</span>
                      {searchTerm && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          Filtro: &quot;{searchTerm}&quot;
                        </span>
                      )}
                    </div>
                    {filteredEmpresas.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => {
                          onSelectEmpresa(e.id)
                          setIsOpen(false)
                          setSearchTerm('')
                        }}
                        className={`px-3 py-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-b-0 ${
                          selectedEmpresaId === e.id ? 'bg-orange-50/70' : ''
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{e.razao_social}</span>
                            {e.nome_fantasia && (
                              <span className="text-[11px] text-slate-500 font-normal truncate">
                                ({e.nome_fantasia})
                              </span>
                            )}
                            {e.pre_cadastro && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200"
                              >
                                [Pré-cadastro]
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">
                            {e.cnpj ? `CNPJ: ${e.cnpj}` : 'Sem CNPJ'}
                            {(e.municipio || e.uf) &&
                              ` • ${[e.municipio, e.uf].filter(Boolean).join('/')}`}
                            {e.email && ` • ${e.email}`}
                          </div>
                        </div>
                        {selectedEmpresaId === e.id && (
                          <Check className="w-4 h-4 text-orange-600 shrink-0" />
                        )}
                      </div>
                    ))}
                  </>
                )
              ) : filteredClientesPf.length === 0 ? (
                <div className="p-3 text-center text-slate-500 space-y-2">
                  <p>Nenhum cliente PF encontrado com &quot;{searchTerm}&quot;.</p>

                  {matchInOtherTipo > 0 && onTipoChange && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-900 text-xs">
                      <span>
                        Encontramos {matchInOtherTipo} empresa(s) em{' '}
                        <strong>Pessoa Jurídica (PJ)</strong>.
                      </span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => onTipoChange('pj')}
                        className="text-blue-700 underline text-xs font-semibold block mx-auto mt-0.5 p-0 h-auto"
                      >
                        Mudar para busca de Pessoa Jurídica (PJ)
                      </Button>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setIsOpen(false)
                      onOpenNovoClienteModal()
                    }}
                    className="text-orange-600 text-xs mt-1 p-0 h-auto font-medium"
                  >
                    + Cadastrar &quot;{searchTerm}&quot; como novo cliente PF
                  </Button>
                </div>
              ) : (
                <>
                  <div className="px-3 py-1 bg-slate-50 text-[10px] text-slate-500 font-semibold border-b uppercase tracking-wider flex items-center justify-between">
                    <span>Clientes PF cadastrados ({filteredClientesPf.length})</span>
                    {searchTerm && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        Filtro: &quot;{searchTerm}&quot;
                      </span>
                    )}
                  </div>
                  {filteredClientesPf.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectClientePf(c.id)
                        setIsOpen(false)
                        setSearchTerm('')
                      }}
                      className={`px-3 py-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-b-0 ${
                        selectedClientePfId === c.id ? 'bg-orange-50/70' : ''
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{c.nome}</span>
                          {c.pre_cadastro && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200"
                            >
                              [Pré-cadastro]
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {c.cpf ? `CPF: ${c.cpf}` : 'Sem CPF'} •{' '}
                          {c.email || c.telefone || 'Sem contato'}
                          {(c.municipio || c.uf) &&
                            ` • ${[c.municipio, c.uf].filter(Boolean).join('/')}`}
                        </div>
                      </div>
                      {selectedClientePfId === c.id && (
                        <Check className="w-4 h-4 text-orange-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
