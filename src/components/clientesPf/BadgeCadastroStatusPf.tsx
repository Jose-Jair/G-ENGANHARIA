import React from 'react'
import { Badge } from '@/components/ui/badge'
import { ClientePfRecord } from '@/types'

export type CadastroStatusPf = 'pre_cadastro' | 'aguardando_cliente' | 'em_revisao' | 'completo'

export function getCadastroStatusPf(cliente: Partial<ClientePfRecord>): CadastroStatusPf {
  if (cliente.cadastro_status) {
    return cliente.cadastro_status as CadastroStatusPf
  }
  // Registros antigos ou sem o campo cadastro_status:
  // Se pre_cadastro for explicitamente true, é pre_cadastro.
  // Caso contrário, existentes sem o campo são considerados 'completo'.
  if (cliente.pre_cadastro) {
    return 'pre_cadastro'
  }
  return 'completo'
}

export function BadgeCadastroStatusPf({
  cliente,
  className = '',
}: {
  cliente: Partial<ClientePfRecord>
  className?: string
}) {
  const status = getCadastroStatusPf(cliente)

  switch (status) {
    case 'pre_cadastro':
      return (
        <Badge
          variant="outline"
          className={`text-[10px] bg-slate-100 text-slate-700 border-slate-300 font-medium ${className}`}
        >
          Pré-cadastro
        </Badge>
      )
    case 'aguardando_cliente':
      return (
        <Badge
          variant="outline"
          className={`text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-medium ${className}`}
        >
          Aguardando cliente
        </Badge>
      )
    case 'em_revisao':
      return (
        <Badge
          variant="outline"
          className={`text-[10px] bg-orange-50 text-[#D95A2B] border-orange-300 font-semibold ${className}`}
        >
          Em revisão
        </Badge>
      )
    case 'completo':
    default:
      return (
        <Badge
          variant="outline"
          className={`text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 font-medium ${className}`}
        >
          Completo
        </Badge>
      )
  }
}
