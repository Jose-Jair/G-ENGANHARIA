// src/services/operacaoSistema.ts
// GESTÃO G+ — RODADA 19: OPERAÇÃO DO SISTEMA
// Serviços para:
// (1) Exportação semanal + manual auditada
// (2) Teto real de upload/armazenamento e parâmetros por tipo (IFC, DWG, PDF, imagem)
// (3) Consulta de status de crons e alertas 2x
// (4) Erros de sistema (registro e listagem)
// (5) Snapshot pré-migração de dados

import { pb } from '@/lib/pocketbase/client'

export interface CronRotinaStatus {
  chave: string
  nome: string
  job_id: string
  intervalo_minutos: number
  intervalo_label: string
  ultimo_sucesso: string | null
  minutos_desde_ultimo: number | null
  status: string
  duracao_ms: number
  atrasado_2x: boolean
}

export interface CronAlertaAtraso {
  rotina: string
  nome: string
  limite_minutos: number
  tempo_sem_rodar_minutos: number | null
  mensagem: string
}

export interface CronsStatusResponse {
  sucesso: boolean
  rotinas: CronRotinaStatus[]
  total_rotinas: number
  total_atrasadas_2x: number
  alertas: CronAlertaAtraso[]
  timestamp: string
}

export interface ErroSistemaItem {
  id: string
  rota: string
  mensagem: string
  usuario?: string
  usuario_email?: string
  hora: string
  ip?: string
  detalhes?: any
  created: string
}

export interface LimitesUploadTipos {
  ifc: { max_mb: number; max_bytes: number; extensoes: string[] }
  dwg: { max_mb: number; max_bytes: number; extensoes: string[] }
  pdf: { max_mb: number; max_bytes: number; extensoes: string[] }
  imagem: { max_mb: number; max_bytes: number; extensoes: string[] }
}

export interface ExportacaoInfo {
  gerado_em: string
  tipo_execucao: string
  executado_por_id?: string
  executado_por_email?: string
  total_colecoes: number
  total_registros: number
  indice_arquivos: Array<{
    colecao: string
    total_registros: number
    arquivo: string
  }>
  status: string
  duracao_ms: number
  ip?: string
}

// -----------------------------------------------------------------------------
// 1. CRONS E ROTINAS AGENDADAS
// -----------------------------------------------------------------------------
export async function obterStatusCrons(): Promise<CronsStatusResponse> {
  try {
    const res = await pb.send<CronsStatusResponse>('/backend/v1/operacao/crons-status', {
      method: 'GET',
    })
    return res
  } catch (err) {
    // Fallback defensivo caso endpoint não responda
    return {
      sucesso: false,
      rotinas: [
        {
          chave: 'cobranca_prazos',
          nome: 'Monitoramento e Cobrança de Prazos',
          job_id: 'monitoramento_e_cobranca_prazos',
          intervalo_minutos: 10,
          intervalo_label: '10 min',
          ultimo_sucesso: null,
          minutos_desde_ultimo: null,
          status: 'desconhecido',
          duracao_ms: 0,
          atrasado_2x: true,
        },
        {
          chave: 'prospeccao',
          nome: 'Prospecção Diária PNCP',
          job_id: 'prospeccao_diaria_pncp',
          intervalo_minutos: 1440,
          intervalo_label: '24 h',
          ultimo_sucesso: null,
          minutos_desde_ultimo: null,
          status: 'desconhecido',
          duracao_ms: 0,
          atrasado_2x: true,
        },
        {
          chave: 'scorecards',
          nome: 'Cálculo de Scorecards e Tendências',
          job_id: 'scorecards_calculo_diario',
          intervalo_minutos: 1440,
          intervalo_label: '24 h',
          ultimo_sucesso: null,
          minutos_desde_ultimo: null,
          status: 'desconhecido',
          duracao_ms: 0,
          atrasado_2x: true,
        },
        {
          chave: 'exportacao',
          nome: 'Exportação Semanal do Sistema',
          job_id: 'exportacao_semanal_sistema',
          intervalo_minutos: 10080,
          intervalo_label: '7 dias',
          ultimo_sucesso: null,
          minutos_desde_ultimo: null,
          status: 'desconhecido',
          duracao_ms: 0,
          atrasado_2x: true,
        },
      ],
      total_rotinas: 4,
      total_atrasadas_2x: 4,
      alertas: [],
      timestamp: new Date().toISOString(),
    }
  }
}

// -----------------------------------------------------------------------------
// 2. EXPORTAÇÃO DE DADOS
// -----------------------------------------------------------------------------
export async function executarExportacaoAgora(): Promise<{
  sucesso: boolean
  mensagem: string
  export_info: ExportacaoInfo
  dados: Record<string, any[]>
}> {
  return await pb.send('/backend/v1/operacao/exportar-agora', {
    method: 'POST',
  })
}

export async function obterUltimaExportacao(): Promise<{
  sucesso: boolean
  exportacao: ExportacaoInfo | null
}> {
  try {
    const res = await pb.send<{ sucesso: boolean; exportacao: any }>(
      '/backend/v1/operacao/exportacao/download-ultimo',
      { method: 'GET' },
    )
    return res
  } catch (err) {
    return { sucesso: false, exportacao: null }
  }
}

// -----------------------------------------------------------------------------
// 3. ERROS DE SISTEMA
// -----------------------------------------------------------------------------
export async function listarErrosSistema(): Promise<{
  sucesso: boolean
  total: number
  erros: ErroSistemaItem[]
}> {
  try {
    return await pb.send('/backend/v1/operacao/erros/listar', {
      method: 'GET',
    })
  } catch (err) {
    return { sucesso: false, total: 0, erros: [] }
  }
}

export async function registrarErroSistema(
  rota: string,
  mensagem: string,
  detalhes?: any,
): Promise<{ sucesso: boolean }> {
  try {
    await pb.send('/backend/v1/operacao/erros/registrar', {
      method: 'POST',
      body: { rota, mensagem, detalhes },
    })
    return { sucesso: true }
  } catch (_) {
    return { sucesso: false }
  }
}

// -----------------------------------------------------------------------------
// 4. LIMITES DE UPLOAD E ARMAZENAMENTO
// -----------------------------------------------------------------------------
export async function obterLimitesUpload(): Promise<{
  sucesso: boolean
  teto_plataforma_skip_cloud: {
    limite_requerimento_mb: number
    body_parser_memoria_mb: number
  }
  limites_por_tipo: LimitesUploadTipos
}> {
  try {
    return await pb.send('/backend/v1/operacao/limites-upload-tipos', {
      method: 'GET',
    })
  } catch (_) {
    return {
      sucesso: true,
      teto_plataforma_skip_cloud: {
        limite_requerimento_mb: 100,
        body_parser_memoria_mb: 32,
      },
      limites_por_tipo: {
        ifc: { max_mb: 150, max_bytes: 150 * 1024 * 1024, extensoes: ['.ifc', '.ifczip'] },
        dwg: { max_mb: 100, max_bytes: 100 * 1024 * 1024, extensoes: ['.dwg', '.dxf'] },
        pdf: { max_mb: 50, max_bytes: 50 * 1024 * 1024, extensoes: ['.pdf'] },
        imagem: {
          max_mb: 25,
          max_bytes: 25 * 1024 * 1024,
          extensoes: ['.png', '.jpg', '.jpeg', '.webp'],
        },
      },
    }
  }
}

export async function salvarLimitesUpload(valores: {
  upload_max_ifc_mb: number
  upload_max_dwg_mb: number
  upload_max_pdf_mb: number
  upload_max_imagem_mb: number
}): Promise<{ sucesso: boolean; mensagem: string }> {
  return await pb.send('/backend/v1/operacao/limites-upload-tipos/salvar', {
    method: 'POST',
    body: valores,
  })
}

// -----------------------------------------------------------------------------
// 5. VALIDAR ARQUIVO POR TIPO (USADO PELO PRESTADOR E TELAS DE ENVIO)
// -----------------------------------------------------------------------------
export function validarArquivoComLimites(
  file: File,
  limites?: LimitesUploadTipos,
): { valido: boolean; mensagem?: string; tipoDetectado?: string; maxMb?: number } {
  const nome = (file.name || '').toLowerCase()
  const tamanhoBytes = file.size
  const tamanhoMb = tamanhoBytes / (1024 * 1024)

  const limitesPadrao: LimitesUploadTipos = limites || {
    ifc: { max_mb: 150, max_bytes: 150 * 1024 * 1024, extensoes: ['.ifc', '.ifczip'] },
    dwg: { max_mb: 100, max_bytes: 100 * 1024 * 1024, extensoes: ['.dwg', '.dxf'] },
    pdf: { max_mb: 50, max_bytes: 50 * 1024 * 1024, extensoes: ['.pdf'] },
    imagem: {
      max_mb: 25,
      max_bytes: 25 * 1024 * 1024,
      extensoes: ['.png', '.jpg', '.jpeg', '.webp'],
    },
  }

  let categoria: 'ifc' | 'dwg' | 'pdf' | 'imagem' | 'outro' = 'outro'
  let limiteMaxMb = 50

  if (nome.endsWith('.ifc') || nome.endsWith('.ifczip')) {
    categoria = 'ifc'
    limiteMaxMb = limitesPadrao.ifc.max_mb
  } else if (nome.endsWith('.dwg') || nome.endsWith('.dxf')) {
    categoria = 'dwg'
    limiteMaxMb = limitesPadrao.dwg.max_mb
  } else if (nome.endsWith('.pdf')) {
    categoria = 'pdf'
    limiteMaxMb = limitesPadrao.pdf.max_mb
  } else if (
    nome.endsWith('.png') ||
    nome.endsWith('.jpg') ||
    nome.endsWith('.jpeg') ||
    nome.endsWith('.webp')
  ) {
    categoria = 'imagem'
    limiteMaxMb = limitesPadrao.imagem.max_mb
  }

  if (tamanhoMb > limiteMaxMb) {
    return {
      valido: false,
      tipoDetectado: categoria,
      maxMb: limiteMaxMb,
      mensagem: `O arquivo "${file.name}" tem ${tamanhoMb.toFixed(1)} MB e excede o limite máximo permitido de ${limiteMaxMb} MB para arquivos do tipo ${categoria.toUpperCase()}. Reduza o arquivo ou entre em contato com a equipe de gestão.`,
    }
  }

  return { valido: true, tipoDetectado: categoria, maxMb: limiteMaxMb }
}

// -----------------------------------------------------------------------------
// 6. SNAPSHOT PRÉ-MIGRAÇÃO DE DADOS
// -----------------------------------------------------------------------------
export async function gerarSnapshotPreMigracao(
  operacao: string,
  colecoes: string[],
): Promise<{
  sucesso: boolean
  mensagem: string
  snapshot: {
    operacao: string
    gerado_em: string
    gerado_por: string
    total_linhas_afetadas: number
    contagens_por_colecao: Record<string, number>
    padrao_seguranca: string
  }
}> {
  return await pb.send('/backend/v1/operacao/snapshot-pre-migracao', {
    method: 'POST',
    body: { operacao, colecoes },
  })
}
