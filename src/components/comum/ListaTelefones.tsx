import React, { useState } from 'react'
import { TelefoneItem } from '@/types'
import { formatPhoneBr, cleanPhoneForWa } from '@/lib/cnpj'
import { openWhatsAppWithFallback } from '@/lib/whatsapp'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Phone, MessageSquare, Plus, X, PhoneCall } from 'lucide-react'

export interface ListaTelefonesProps {
  telefones: TelefoneItem[]
  onChange?: (telefones: TelefoneItem[]) => void
  readOnly?: boolean
  label?: string
  helperText?: string
}

export const ListaTelefones: React.FC<ListaTelefonesProps> = ({
  telefones,
  onChange,
  readOnly = false,
  label = 'Telefones de Contato',
  helperText = 'Adicione múltiplos telefones (fixo ou celular) com opção de WhatsApp.',
}) => {
  const [inputNumero, setInputNumero] = useState('')
  const [isWaAtivo, setIsWaAtivo] = useState(true)
  const [inputDesc, setInputDesc] = useState('')

  const handleInputChange = (val: string) => {
    // Aplica formatação automática em tempo real distinguindo 8 e 9 dígitos
    setInputNumero(formatPhoneBr(val, false))
  }

  const handleAdicionar = () => {
    if (readOnly || !onChange) return
    const raw = inputNumero.replace(/\D/g, '')
    // Mínimo DDD + 8 dígitos = 10 dígitos (ou com 55: 12 ou 13)
    const rawSemDdi = raw.startsWith('55') && raw.length > 11 ? raw.slice(2) : raw
    if (rawSemDdi.length < 10) {
      return
    }

    const formatado = formatPhoneBr(rawSemDdi, false)

    // Identificar tipo: celular (9 dígitos no número) vs fixo (8 dígitos no número)
    const ehCelular = rawSemDdi.length >= 11
    const tipo = isWaAtivo ? 'whatsapp' : ehCelular ? 'celular' : 'fixo'

    const novoItem: TelefoneItem = {
      id: `tel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      numero: formatado,
      whatsapp: isWaAtivo,
      tipo,
      ramalOuDescricao: inputDesc.trim() || undefined,
    }

    onChange([...telefones, novoItem])
    setInputNumero('')
    setInputDesc('')
    setIsWaAtivo(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdicionar()
    }
  }

  const handleRemover = (id: string) => {
    if (readOnly || !onChange) return
    onChange(telefones.filter((t) => t.id !== id))
  }

  const handleToggleWhatsApp = (id: string, novoValor: boolean) => {
    if (readOnly || !onChange) return
    onChange(
      telefones.map((t) => {
        if (t.id === id) {
          return {
            ...t,
            whatsapp: novoValor,
            tipo: novoValor ? 'whatsapp' : t.tipo === 'whatsapp' ? 'celular' : t.tipo,
          }
        }
        return t
      }),
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-orange-600" />
          {label}
        </Label>
        <span className="text-[11px] text-slate-400">
          {telefones.length} {telefones.length === 1 ? 'número' : 'números'}
        </span>
      </div>

      {helperText && <p className="text-[11px] text-slate-500 leading-tight">{helperText}</p>}

      {/* Campo de adição de telefone (se não for readOnly) */}
      {!readOnly && onChange && (
        <div className="p-2.5 rounded-md border border-slate-200 bg-slate-50/70 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[170px]">
              <Input
                value={inputNumero}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="(00) 00000-0000 ou (00) 0000-0000"
                className="h-8 text-xs font-mono bg-white"
              />
            </div>

            <div className="flex-1 min-w-[120px]">
              <Input
                value={inputDesc}
                onChange={(e) => setInputDesc(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Rótulo (opcional)"
                className="h-8 text-xs bg-white"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2 h-8">
              <MessageSquare
                className={`w-3.5 h-3.5 ${isWaAtivo ? 'text-emerald-600' : 'text-slate-400'}`}
              />
              <span className="text-[11px] font-medium text-slate-700">WhatsApp</span>
              <Switch
                checked={isWaAtivo}
                onCheckedChange={setIsWaAtivo}
                className="scale-75 data-[state=checked]:bg-emerald-600"
                title="Marcar como número com WhatsApp"
              />
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleAdicionar}
              className="h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </Button>
          </div>
          <span className="text-[10px] text-slate-400 block">
            Pressione Enter ou clique em Adicionar após digitar o número com DDD.
          </span>
        </div>
      )}

      {/* Lista de chips removíveis / cartões de telefones */}
      {telefones.length === 0 ? (
        <div className="text-center py-2 text-[11px] text-slate-400 italic">
          Nenhum telefone adicionado.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {telefones.map((tel) => {
            const hasWa = tel.whatsapp ?? tel.tipo === 'whatsapp'
            const clean = cleanPhoneForWa(tel.numero)
            return (
              <div
                key={tel.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-white shadow-xs text-xs"
              >
                {/* Ícone de status / WhatsApp */}
                {hasWa ? (
                  <button
                    type="button"
                    onClick={() => openWhatsAppWithFallback({ phone: tel.numero })}
                    className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 transition-colors"
                    title="Abrir no WhatsApp Desktop (com fallback para Web)"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
                  </button>
                ) : (
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                )}

                {/* Número formatado clicável para chamada telefônica ou whatsapp */}
                <button
                  type="button"
                  onClick={() => {
                    if (hasWa) {
                      openWhatsAppWithFallback({ phone: tel.numero })
                    } else if (clean) {
                      window.location.href = `tel:${clean}`
                    }
                  }}
                  className={`font-mono text-xs font-semibold cursor-pointer hover:underline ${
                    hasWa ? 'text-emerald-800' : 'text-slate-800'
                  }`}
                  title={
                    hasWa
                      ? 'Clique para abrir no aplicativo WhatsApp desktop (ou Web)'
                      : 'Clique para ligar'
                  }
                >
                  {tel.numero}
                </button>

                {tel.ramalOuDescricao && (
                  <span className="text-[10px] text-slate-500 max-w-[100px] truncate">
                    ({tel.ramalOuDescricao})
                  </span>
                )}

                {/* Toggle WhatsApp inline quando editável */}
                {!readOnly && onChange && (
                  <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleToggleWhatsApp(tel.id, !hasWa)}
                      className={`text-[10px] px-1 py-0.5 rounded cursor-pointer transition-colors ${
                        hasWa
                          ? 'bg-emerald-100 text-emerald-800 font-bold'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      title={hasWa ? 'WhatsApp ativado — clique para desativar' : 'Ativar WhatsApp'}
                    >
                      {hasWa ? 'WA On' : 'WA Off'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemover(tel.id)}
                      className="text-slate-400 hover:text-red-600 rounded-full p-0.5 transition-colors"
                      title="Remover telefone"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
