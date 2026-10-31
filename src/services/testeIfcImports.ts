// Arquivo de teste de compilação e resolução de web-ifc e @thatopen/components
import * as WEBIFC from 'web-ifc'
import * as OBC from '@thatopen/components'

export function testarImports() {
  return {
    webifc: Boolean(WEBIFC),
    obc: Boolean(OBC),
  }
}
