import { pb } from '@/lib/pocketbase/client'

/**
 * Módulo seguro de geração e download de arquivos protegidos via PocketBase File Token.
 * O PocketBase exige que coleções com campos de arquivo `protected: true` sejam acessados
 * passando o parâmetro `?token=<fileToken>` gerado pelo endpoint de file token do usuário autenticado.
 */

// Cache de fileToken curto para evitar requisições repetitivas consecutivas
let cachedFileToken: string | null = null
let tokenExpiresAt = 0

/**
 * Obtém um fileToken de autenticação para o usuário logado.
 * Se o usuário não estiver autenticado, retorna string vazia.
 */
export async function getFileToken(): Promise<string> {
  if (!pb.authStore.isValid) {
    return ''
  }

  const now = Date.now()
  // Reutiliza o token se ainda for válido por pelo menos 15 segundos
  if (cachedFileToken && tokenExpiresAt > now + 15000) {
    return cachedFileToken
  }

  try {
    const token = await pb.files.getToken()
    cachedFileToken = token
    // File tokens do PocketBase normalmente duram de 1 a 2 minutos
    tokenExpiresAt = now + 90 * 1000
    return token
  } catch (err) {
    console.warn('Falha ao obter fileToken do PocketBase:', err)
    return ''
  }
}

/**
 * Gera uma URL completa para um arquivo do PocketBase.
 * Se o arquivo for protegido ou se o usuário estiver autenticado,
 * inclui o query param `?token=` obtido via getFileToken().
 */
export async function getProtectedFileUrl(
  record: { [key: string]: any; id: string; collectionId?: string; collectionName?: string },
  filename: string | undefined | null,
  queryParams?: { [key: string]: any },
): Promise<string> {
  if (!filename) return ''

  try {
    const token = await getFileToken()
    const params = { ...(queryParams || {}) }
    if (token) {
      params.token = token
    }
    return pb.files.getURL(record, filename, params)
  } catch (err) {
    console.warn('Erro ao gerar URL com token de arquivo:', err)
    return pb.files.getURL(record, filename, queryParams)
  }
}

/**
 * Abre diretamente ou faz download de um arquivo protegido com autenticação via file token.
 */
export async function openProtectedFile(
  record: { [key: string]: any; id: string; collectionId?: string; collectionName?: string },
  filename: string | undefined | null,
  target: '_blank' | '_self' = '_blank',
): Promise<void> {
  if (!filename) return

  const url = await getProtectedFileUrl(record, filename)
  if (url) {
    window.open(url, target, 'noopener,noreferrer')
  }
}
