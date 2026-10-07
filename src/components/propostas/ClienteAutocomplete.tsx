import React, { useState, useMemo } from 'react'
import { EmpresaRecord, ClientePfRecord } from '@/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Search, Building2, User, Plus, Check, X } from 'lucide-react'

// Normalização para busca insensível a maiúsculas/minúsculas e acentos
export function normalizeText(str: string): string {
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
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Item atualmente selecionado
  const selectedEmpresa = useMemo(
    () => empresas.find((e) => e.id === selectedEmpresaId),
    [empresas, selectedEmpresaId],
  )
  const selectedClientePf = useMemo(
    () => clientesPf.find((c) => c.id === selectedClientePfId),
    [clientesPf, selectedClientePfId],
  )

  // Itens filtrados com busca dinâmica e sem acentos
  const filteredEmpresas = useMemo(() => {
    if (tipo !== 'pj') return []
    const term = normalizeText(searchTerm)
    if (!term) return empresas.slice(0, 8)
    return empresas
      .filter((e) => {
        const razao = normalizeText(e.razao_social)
        const fantasia = normalizeText(e.nome_fantasia || '')
        const cnpj = (e.cnpj || '').replace(/\D/g, '')
        const cleanTerm = term.replace(/\D/g, '')
        return (
          razao.includes(term) || fantasia.includes(term) || (cleanTerm && cnpj.includes(cleanTerm))
        )
      })
      .slice(0, 10)
  }, [tipo, empresas, searchTerm])

  const filteredClientesPf = useMemo(() => {
    if (tipo !== 'pf') return []
    const term = normalizeText(searchTerm)
    if (!term) return clientesPf.slice(0, 8)
    return clientesPf
      .filter((c) => {
        const nome = normalizeText(c.nome)
        const email = normalizeText(c.email || '')
        const cpf = (c.cpf || '').replace(/\D/g, '')
        const tel = (c.telefone || '').replace(/\D/g, '')
        const cleanTerm = term.replace(/\D/g, '')
        return (
          nome.includes(term) ||
          email.includes(term) ||
          (cleanTerm && (cpf.includes(cleanTerm) || tel.includes(cleanTerm)))
        )
      })
      .slice(0, 10)
  }, [tipo, clientesPf, searchTerm])

  const isSelected = tipo === 'pj' ? !!selectedEmpresa : !!selectedClientePf

  return (
    <div className="space-y-1 relative">
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
          Cadastrar novo cliente
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
                  ? 'Digite o nome da empresa, fantasia ou CNPJ...'
                  : 'Digite o nome do cliente PF, CPF ou telefone...'
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
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* DROPDOWN DE SUGESTÕES */}
          {isOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1 text-xs">
              {tipo === 'pj' ? (
                filteredEmpresas.length === 0 ? (
                  <div className="p-3 text-center text-slate-500">
                    <p>Nenhuma empresa encontrada com &quot;{searchTerm}&quot;.</p>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setIsOpen(false)
                        onOpenNovoClienteModal()
                      }}
                      className="text-orange-600 text-xs mt-1 p-0 h-auto"
                    >
                      + Cadastrar &quot;{searchTerm}&quot; como nova empresa
                    </Button>
                  </div>
                ) : (
                  filteredEmpresas.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => {
                        onSelectEmpresa(e.id)
                        setIsOpen(false)
                        setSearchTerm('')
                      }}
                      className="px-3 py-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-b-0"
                    >
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {e.razao_social}
                          {e.nome_fantasia && (
                            <span className="text-[11px] text-slate-500 font-normal">
                              ({e.nome_fantasia})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {e.cnpj ? `CNPJ: ${e.cnpj}` : 'Sem CNPJ'} • {e.municipio || ''}
                          {e.uf ? `/${e.uf}` : ''}
                        </div>
                      </div>
                      {selectedEmpresaId === e.id && (
                        <Check className="w-4 h-4 text-orange-600 shrink-0" />
                      )}
                    </div>
                  ))
                )
              ) : filteredClientesPf.length === 0 ? (
                <div className="p-3 text-center text-slate-500">
                  <p>Nenhum cliente PF encontrado com &quot;{searchTerm}&quot;.</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setIsOpen(false)
                      onOpenNovoClienteModal()
                    }}
                    className="text-orange-600 text-xs mt-1 p-0 h-auto"
                  >
                    + Cadastrar &quot;{searchTerm}&quot; como novo cliente PF
                  </Button>
                </div>
              ) : (
                filteredClientesPf.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectClientePf(c.id)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className="px-3 py-2 hover:bg-orange-50 cursor-pointer flex items-center justify-between border-b border-slate-100 last:border-b-0"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{c.nome}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {c.cpf ? `CPF: ${c.cpf}` : 'Sem CPF'} •{' '}
                        {c.email || c.telefone || 'Sem contato'}
                      </div>
                    </div>
                    {selectedClientePfId === c.id && (
                      <Check className="w-4 h-4 text-orange-600 shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
