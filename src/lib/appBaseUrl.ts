/**
 * src/lib/appBaseUrl.ts
 *
 * Centralizador da URL base pública da aplicação para links enviados a clientes externos
 * (WhatsApp, e-mail, etc.). Evita o uso de window.location.origin em ambientes de prévia
 * (--preview) para que clientes sempre acessem a URL oficial e estável do sistema.
 */

export const FALLBACK_APP_BASE_URL = 'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'

let cachedUrlPublicaApp: string | null = null

/**
 * Define ou atualiza em memória o parâmetro url_publica_app obtido da tabela de parâmetros.
 */
export function setCachedUrlPublicaApp(url: string | null | undefined): void {
  if (url && typeof url === 'string' && url.trim().length > 0) {
    cachedUrlPublicaApp = url.trim().replace(/\/+$/, '')
  } else {
    cachedUrlPublicaApp = null
  }
}

/**
 * Retorna a URL base pública recomendada para links externos enviados a clientes.
 * Prioriza parâmetro url_publica_app (em cache ou localStorage) e usa fallback de produção.
 */
export function getAppBaseUrl(): string {
  if (cachedUrlPublicaApp) {
    return cachedUrlPublicaApp
  }

  try {
    const fromStorage = localStorage.getItem('gplus_url_publica_app')
    if (fromStorage && fromStorage.trim().length > 0) {
      cachedUrlPublicaApp = fromStorage.trim().replace(/\/+$/, '')
      return cachedUrlPublicaApp
    }
  } catch {
    // Falha silenciosa em ambientes sem localStorage
  }

  return FALLBACK_APP_BASE_URL
}
