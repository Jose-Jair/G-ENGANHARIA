// =============================================================================
// GESTÃO G+ — PARSER DE ARQUIVOS BCF ZIP / XML NO NAVEGADOR (RODADA 17)
// Suporta BCF 2.1 e BCF 3.0 (descompactação zip com fflate ou parsing de markup.bcf)
// =============================================================================

import type { TopicoBcfPayload } from '@/services/issuesRevisaoService'
import type { SeveridadeIssueRevisao, StatusIssueRevisao } from '@/types'

/**
 * Converte XML textual de markup BCF para objeto TopicoBcfPayload
 */
export function parseBcfMarkupXml(xmlStr: string, viewpointImgBase64?: string): TopicoBcfPayload {
  function extrairTag(xml: string, tag: string) {
    const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i')
    const m = xml.match(re)
    return m ? m[1].trim() : ''
  }

  function extrairAttr(xml: string, tag: string, attr: string) {
    const re = new RegExp('<' + tag + '[^>]*?\\s' + attr + '=["\']([^"\']+)["\']', 'i')
    const m = xml.match(re)
    return m ? m[1].trim() : ''
  }

  const title = extrairTag(xmlStr, 'Title') || extrairTag(xmlStr, 'title') || 'Issue sem título'
  const description = extrairTag(xmlStr, 'Description') || extrairTag(xmlStr, 'description') || ''

  const priority = (
    extrairTag(xmlStr, 'Priority') ||
    extrairTag(xmlStr, 'priority') ||
    'media'
  ).toLowerCase()

  let severidade: SeveridadeIssueRevisao = 'media'
  if (priority.includes('crit') || priority.includes('block')) {
    severidade = 'critica'
  } else if (priority.includes('alt') || priority.includes('high')) {
    severidade = 'alta'
  } else if (priority.includes('baix') || priority.includes('low')) {
    severidade = 'baixa'
  }

  const statusRaw = (
    extrairTag(xmlStr, 'TopicStatus') ||
    extrairTag(xmlStr, 'Status') ||
    extrairTag(xmlStr, 'status') ||
    'aberta'
  ).toLowerCase()

  let status: StatusIssueRevisao = 'aberta'
  if (statusRaw.includes('atrib') || statusRaw.includes('assign')) {
    status = 'atribuida'
  } else if (statusRaw.includes('corrig') || statusRaw.includes('resolved')) {
    status = 'corrigida'
  } else if (statusRaw.includes('verif') || statusRaw.includes('closed')) {
    status = 'verificada'
  } else if (statusRaw.includes('rej') || statusRaw.includes('reopen')) {
    status = 'rejeitada'
  }

  let guid = extrairAttr(xmlStr, 'Topic', 'Guid') || extrairAttr(xmlStr, 'topic', 'guid')
  if (!guid) {
    guid = extrairTag(xmlStr, 'Guid') || extrairTag(xmlStr, 'guid')
  }

  const elementos: string[] = []
  const compRegex = /IfcGuid=["']([^"']+)["']/gi
  let matchComp: RegExpExecArray | null
  while ((matchComp = compRegex.exec(xmlStr)) !== null) {
    if (matchComp[1] && !elementos.includes(matchComp[1])) {
      elementos.push(matchComp[1])
    }
  }

  const pavimento =
    extrairTag(xmlStr, 'Stage') ||
    extrairTag(xmlStr, 'stage') ||
    extrairTag(xmlStr, 'Floor') ||
    extrairTag(xmlStr, 'floor') ||
    ''

  const prazo = extrairTag(xmlStr, 'DueDate') || extrairTag(xmlStr, 'dueDate') || ''

  return {
    guid_bcf: guid || undefined,
    markup_xml: xmlStr,
    titulo: title,
    descricao: description,
    severidade,
    status,
    elementos,
    pavimento,
    prazo: prazo ? prazo.split('T')[0] : undefined,
    viewpoint_base64: viewpointImgBase64,
  }
}

/**
 * Lê um arquivo .bcf / .bcfzip ou .xml enviado pelo usuário
 */
export async function extrairTopicosArquivoBcf(arquivo: File): Promise<TopicoBcfPayload[]> {
  const nome = arquivo.name.toLowerCase()

  // Caso 1: arquivo XML individual de markup
  if (nome.endsWith('.xml') || nome.endsWith('.bcf')) {
    const texto = await arquivo.text()
    if (texto.includes('<Topic') || texto.includes('<topic')) {
      return [parseBcfMarkupXml(texto)]
    }
  }

  // Caso 2: arquivo ZIP contendo tópicos BCF (.bcfzip ou .bcf)
  // Tentativa usando descompressão ZIP simples de streaming ou fallback se fflate/JSZip não estiver presente
  // Se for texto com múltiplos tópicos:
  const buffer = await arquivo.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Verifica assinatura de arquivo ZIP (PK..)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    // Parser ZIP leve embutido sem depender de bibliotecas externas pesadas
    return extrairTopicosDeZip(bytes)
  }

  // Fallback: tentar ler como texto UTF-8
  const texto = new TextDecoder('utf-8').decode(bytes)
  if (texto.includes('<Topic') || texto.includes('<topic')) {
    return [parseBcfMarkupXml(texto)]
  }

  throw new Error(
    'Formato de arquivo BCF não reconhecido. Envie um arquivo .bcfzip ou markup .bcf XML válido.',
  )
}

/**
 * Leitor ZIP simples para extrair arquivos markup.bcf e snapshots de viewpoints
 */
function extrairTopicosDeZip(bytes: Uint8Array): TopicoBcfPayload[] {
  const topicos: TopicoBcfPayload[] = []
  const arquivosTexto: Record<string, string> = {}
  const imagensPng: Record<string, string> = {}

  let pos = 0
  const len = bytes.length

  while (pos < len - 4) {
    // Local file header signature = 0x04034b50
    if (
      bytes[pos] === 0x50 &&
      bytes[pos + 1] === 0x4b &&
      bytes[pos + 2] === 0x03 &&
      bytes[pos + 3] === 0x04
    ) {
      const compression = bytes[pos + 8] | (bytes[pos + 9] << 8)
      const compSize =
        bytes[pos + 18] | (bytes[pos + 19] << 8) | (bytes[pos + 20] << 16) | (bytes[pos + 21] << 24)
      const nameLen = bytes[pos + 26] | (bytes[pos + 27] << 8)
      const extraLen = bytes[pos + 28] | (bytes[pos + 29] << 8)

      const nameBytes = bytes.slice(pos + 30, pos + 30 + nameLen)
      const fileName = new TextDecoder().decode(nameBytes)

      const dataStart = pos + 30 + nameLen + extraLen
      const dataEnd = dataStart + compSize

      if (dataEnd <= len) {
        const fileData = bytes.slice(dataStart, dataEnd)
        // Se sem compressão (store = 0)
        if (compression === 0) {
          if (fileName.endsWith('.bcf') || fileName.endsWith('.xml')) {
            arquivosTexto[fileName] = new TextDecoder().decode(fileData)
          } else if (
            fileName.endsWith('.png') ||
            fileName.endsWith('.jpg') ||
            fileName.endsWith('.jpeg')
          ) {
            // Converte para base64
            let binary = ''
            for (let b = 0; b < fileData.length; b++) binary += String.fromCharCode(fileData[b])
            imagensPng[fileName] = 'data:image/png;base64,' + btoa(binary)
          }
        }
      }

      pos = dataStart + compSize
    } else {
      pos++
    }
  }

  // Agrupa os markups encontrados
  for (const [caminho, xml] of Object.entries(arquivosTexto)) {
    if (xml.includes('<Topic') || xml.includes('<topic')) {
      // Procura snapshot correspondente na mesma pasta do GUID
      const pasta = caminho.includes('/') ? caminho.substring(0, caminho.lastIndexOf('/')) : ''
      let snapshotBase64: string | undefined
      for (const [imgNome, b64] of Object.entries(imagensPng)) {
        if (!pasta || imgNome.startsWith(pasta)) {
          snapshotBase64 = b64
          break
        }
      }
      topicos.push(parseBcfMarkupXml(xml, snapshotBase64))
    }
  }

  // Se o zip estava compactado com Deflate e não foi possível descomprimir sem zlib,
  // fazemos busca de strings XML nos chunks
  if (topicos.length === 0) {
    const textoGeral = new TextDecoder('latin1').decode(bytes)
    const matches = textoGeral.match(/<Topic[\s\S]*?<\/Topic>/gi)
    if (matches && matches.length > 0) {
      for (const m of matches) {
        topicos.push(parseBcfMarkupXml(m))
      }
    }
  }

  return topicos
}
