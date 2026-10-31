// Helper de URL pública do frontend da aplicação
// Compartilhado no runtime de hooks do PocketBase

function getAppBaseUrl() {
  const envUrl =
    typeof $os !== 'undefined' && $os && typeof $os.getenv === 'function'
      ? ($os.getenv('PUBLIC_APP_URL') || '').trim()
      : ''
  if (envUrl) {
    return envUrl.replace(/\/+$/, '')
  }
  return 'https://gestao-de-projetos-de-engenharia-be59d.goskip.app'
}

// Expõe globalmente no contexto goja
if (typeof globalThis !== 'undefined') {
  globalThis.getAppBaseUrl = getAppBaseUrl
}
