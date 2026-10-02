import { cleanPhoneForWa } from '@/lib/cnpj'

export interface OpenWhatsAppOptions {
  phone: string | undefined | null
  text?: string
  fallbackDelayMs?: number
}

/**
 * Abre o WhatsApp nativo/desktop via protocolo whatsapp://send?phone=55XXXXXXXXXXX
 * Caso o app desktop não assuma o foco após o timeout (fallbackDelayMs, padrão 1500ms),
 * realiza fallback abrindo o WhatsApp Web (wa.me/55...) em nova aba do navegador.
 */
export function openWhatsAppWithFallback({
  phone,
  text,
  fallbackDelayMs = 1500,
}: OpenWhatsAppOptions): void {
  const clean = cleanPhoneForWa(phone)
  if (!clean) return

  const encodedText = text ? encodeURIComponent(text) : ''
  const nativeUrl = `whatsapp://send?phone=${clean}${encodedText ? `&text=${encodedText}` : ''}`
  const webUrl = `https://wa.me/${clean}${encodedText ? `?text=${encodedText}` : ''}`

  let appOpened = false

  const onBlurOrVisibilityChange = () => {
    // Se a janela perdeu foco ou a página ficou oculta, o SO/WhatsApp desktop assumiu
    if (document.hidden || !document.hasFocus()) {
      appOpened = true
    }
  }

  window.addEventListener('blur', onBlurOrVisibilityChange)
  document.addEventListener('visibilitychange', onBlurOrVisibilityChange)

  const timer = setTimeout(() => {
    cleanup()
    if (!appOpened && !document.hidden && document.hasFocus()) {
      // Página ainda visível e focada: o app nativo não abriu, usa fallback WhatsApp Web
      window.open(webUrl, '_blank', 'noopener,noreferrer')
    }
  }, fallbackDelayMs)

  const cleanup = () => {
    clearTimeout(timer)
    window.removeEventListener('blur', onBlurOrVisibilityChange)
    document.removeEventListener('visibilitychange', onBlurOrVisibilityChange)
  }

  try {
    // Tenta disparar o protocolo do aplicativo desktop
    window.location.href = nativeUrl
  } catch {
    cleanup()
    window.open(webUrl, '_blank', 'noopener,noreferrer')
  }
}
