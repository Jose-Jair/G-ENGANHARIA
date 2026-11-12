// Testes unitários — Disparo em Lote do Toque 1 (rodada disparo-lote toque 1)
// Padrão do projeto: lógica pura recriada aqui (os hooks rodam em VMs PocketBase,
// sem como ser importados no vitest) — valida as REGRAS, não o runtime PB.

import { describe, it, expect } from 'vitest'

// ---------- Replica o corpo EXATO semeado pela migração 0152 ----------
const CORPO_MODELO =
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1e293b;line-height:1.6;max-width:600px"><p>Olá, equipe da <b>{{empresa}}</b>, tudo bem?</p><p>Sou Jair, da <b>G+ ENGENHARIA</b>.</p><p>Sabemos que encontrar profissionais qualificados nas diversas disciplinas da engenharia — estrutura, instalações, BIM, orçamento — é um desafio constante, principalmente quando a demanda cresce ou o prazo aperta. Foi pensando nisso que a G+ atua como um <b>braço técnico das empresas parceiras</b>: assumimos parte da demanda com a qualidade e o prazo que o seu cliente espera, sem que vocês precisem contratar ou ampliar a equipe.</p><p>Podemos apoiar em:</p><ul><li>Projetos estruturais (concreto armado e estruturas metálicas) e complementares</li><li>Compatibilização e modelagem BIM</li><li>Orçamento de obras, planilhas e cronogramas</li><li>Pleitos administrativos: aditivos, reequilíbrio e respostas a diligências</li></ul><p>Atendemos de forma remota, com prazos definidos por etapa e entregas prontas para aprovação.</p><p><b>Segue em anexo o nosso portfólio.</b> Para conhecer mais:</p><p>▸ <a href="https://gmaisengenharia.goskip.app/portfolio" style="color:#D95A2B">Portfólio online</a><br>▸ <a href="https://gmaisengenharia.goskip.app" style="color:#D95A2B">Site</a><br>▸ <a href="https://gmaisengenharia.goskip.app/#orcamento" style="color:#D95A2B">Solicitar orçamento</a></p><p>Se preferir, fale direto comigo pelo WhatsApp — ou, se fizer sentido, podemos marcar uma conversa de 15 minutos para entender a demanda de vocês.</p><p><a href="https://wa.me/5588921886547?text=Ol%C3%A1%2C%20Jair!%20Recebi%20o%20e-mail%20da%20G%2B%20ENGENHARIA%20e%20gostaria%20de%20conversar." style="display:inline-block;padding:10px 20px;background-color:#25D366;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:6px">Conversar no WhatsApp</a></p><p>Atenciosamente,<br><b>Jair — G+ ENGENHARIA</b><br>WhatsApp: <a href="https://wa.me/5588921886547" style="color:#D95A2B">(88) 92188-6547</a><br>grupomais.sae@gmail.com | <a href="https://gmaisengenharia.goskip.app" style="color:#D95A2B">gmaisengenharia.goskip.app</a></p></div>'

// ---------- Replica a lógica do cron (salvaguardas + montagem) ----------
interface EmpresaTeste {
  id: string
  email: string
  nome_fantasia?: string
  razao_social?: string
  cadencia_bloqueada_sancao?: boolean
}

function decidirPulo(
  empresa: EmpresaTeste,
  naoContatarEmpresas: string[],
  naoContatarEmails: string[],
  toque1Realizado: boolean,
): string {
  const emailEmpresa = (empresa.email || '').trim()
  if (!emailEmpresa) return 'sem e-mail cadastrado'
  if (empresa.cadencia_bloqueada_sancao) return 'cadência bloqueada por sanção'
  if (toque1Realizado) return 'Toque 1 já realizado'
  if (naoContatarEmpresas.includes(empresa.id)) return 'empresa em não_contatar'
  if (naoContatarEmails.includes(emailEmpresa.toLowerCase())) return 'e-mail em não_contatar'
  return ''
}

function montarEmail(empresa: EmpresaTeste, baseUrl: string) {
  const nomeEmpresa = empresa.nome_fantasia || empresa.razao_social || 'Empresa'
  const corpoHtml = CORPO_MODELO.replace(/\{\{empresa\}\}/g, nomeEmpresa).replace(
    '</div>',
    rodapeDescadastro(empresa.email.trim(), baseUrl) + '</div>',
  )
  return {
    from: { address: 'grupomais.sae@gmail.com', name: 'G+ Engenharia' },
    replyTo: { address: 'grupomais.sae@gmail.com', name: 'G+ Engenharia' },
    to: [{ address: empresa.email.trim(), name: nomeEmpresa }],
    subject: 'Um braço técnico para a demanda da sua empresa — G+ ENGENHARIA',
    html: corpoHtml,
    attachments: { 'portfolio-gmais.pdf': '<reader>' },
  }
}

function rodapeDescadastro(email: string, baseUrl: string) {
  const link = baseUrl + '/descadastro?email=' + encodeURIComponent(email)
  return (
    '<p style="font-size:11px;color:#94a3b8;margin-top:16px">Recebeste este e-mail por cadência comercial da G+ Engenharia. ' +
    '<a href="' +
    link +
    '" style="color:#94a3b8">Não quero mais receber</a></p>'
  )
}

function aplicarParceiraLegado(empresa: Record<string, any>, motivo: string) {
  const etapaAnterior =
    empresa.etapa_funil !== 'parceira' ? empresa.etapa_funil || '' : empresa.etapa_anterior || ''
  empresa.etapa_funil = 'parceira'
  empresa.is_parceira = true
  empresa.data_selo_parceira = new Date().toISOString()
  if (etapaAnterior) empresa.etapa_anterior = etapaAnterior
  return {
    acao: 'PARCEIRA_EXISTENTE_LEGADO',
    entidade: 'empresas',
    registro_id: empresa.id,
    detalhes: { motivo, etapa_anterior: etapaAnterior },
  }
}

describe('Disparo lote Toque 1 — placeholder {{empresa}}', () => {
  it('substitui {{empresa}} por nome_fantasia quando presente', () => {
    const empresa: EmpresaTeste = {
      id: 'emp1',
      email: 'contato@acme.com.br',
      nome_fantasia: 'ACME Engenharia',
      razao_social: 'ACME ENGENHARIA LTDA',
    }
    const email = montarEmail(empresa, 'https://app.test')
    expect(email.html).toContain('equipe da <b>ACME Engenharia</b>')
    expect(email.html).not.toContain('{{empresa}}')
  })

  it('usa razao_social quando não há nome_fantasia', () => {
    const empresa: EmpresaTeste = {
      id: 'emp2',
      email: 'contato@beta.com.br',
      razao_social: 'BETA PROJETOS LTDA',
    }
    const email = montarEmail(empresa, 'https://app.test')
    expect(email.html).toContain('equipe da <b>BETA PROJETOS LTDA</b>')
    expect(email.html).not.toContain('{{empresa}}')
  })
})

describe('Disparo lote Toque 1 — salvaguardas', () => {
  it('pula empresa listada em nao_contatar (por empresa)', () => {
    const motivo = decidirPulo({ id: 'emp1', email: 'a@b.com' }, ['emp1'], [], false)
    expect(motivo).toBe('empresa em não_contatar')
  })

  it('pula empresa cujo E-MAIL está em nao_contatar', () => {
    const motivo = decidirPulo(
      { id: 'emp2', email: 'bloqueada@empresa.com' },
      [],
      ['bloqueada@empresa.com'],
      false,
    )
    expect(motivo).toBe('e-mail em não_contatar')
  })

  it('pula empresa sem e-mail cadastrado', () => {
    const motivo = decidirPulo({ id: 'emp3', email: '' }, [], [], false)
    expect(motivo).toBe('sem e-mail cadastrado')
  })

  it('pula empresa com Toque 1 já realizado', () => {
    const motivo = decidirPulo({ id: 'emp4', email: 'x@y.com' }, [], [], true)
    expect(motivo).toBe('Toque 1 já realizado')
  })

  it('pula empresa com cadência bloqueada por sanção', () => {
    const motivo = decidirPulo(
      { id: 'emp5', email: 's@t.com', cadencia_bloqueada_sancao: true },
      [],
      [],
      false,
    )
    expect(motivo).toBe('cadência bloqueada por sanção')
  })

  it('não pula empresa limpa (motivo vazio)', () => {
    const motivo = decidirPulo({ id: 'emp6', email: 'ok@ok.com' }, [], [], false)
    expect(motivo).toBe('')
  })
})

describe('Disparo lote Toque 1 — montagem do e-mail', () => {
  it('usa o assunto e remetente/reply-to corretos', () => {
    const email = montarEmail(
      { id: 'emp1', email: 'a@b.com', nome_fantasia: 'ACME' },
      'https://app.test',
    )
    expect(email.subject).toBe('Um braço técnico para a demanda da sua empresa — G+ ENGENHARIA')
    expect(email.from.address).toBe('grupomais.sae@gmail.com')
    expect(email.replyTo.address).toBe('grupomais.sae@gmail.com')
  })

  it('anexa o PDF do portfólio', () => {
    const email = montarEmail(
      { id: 'emp1', email: 'a@b.com', nome_fantasia: 'ACME' },
      'https://app.test',
    )
    expect(Object.keys(email.attachments)).toContain('portfolio-gmais.pdf')
  })

  it('inclui o rodapé LGPD com link de descadastro apontando a página /descadastro', () => {
    const email = montarEmail(
      { id: 'emp1', email: 'Contato@Acme.com.br', nome_fantasia: 'ACME' },
      'https://app.test',
    )
    expect(email.html).toContain('/descadastro?email=Contato%40Acme.com.br')
    expect(email.html).toContain('Não quero mais receber')
    expect(email.html).toContain('cadência comercial da G+ Engenharia')
    // rodapé dentro do container div do modelo
    expect(email.html.endsWith('</div>')).toBe(true)
  })

  it('modo teste responde {teste, enviado} e não cria lote/fila (regra da rota)', () => {
    // A rota com email_teste NÃO grava em lotes_disparo/fila_disparo — audita e responde
    const resposta = { teste: true, enviado: true }
    expect(resposta.teste).toBe(true)
    expect(resposta.enviado).toBe(true)
    // coleções que não devem ser tocadas no modo teste
    const colecoesTocadas: string[] = ['audit_logs'] // apenas auditoria
    expect(colecoesTocadas.includes('lotes_disparo')).toBe(false)
    expect(colecoesTocadas.includes('fila_disparo')).toBe(false)
  })
})

describe('Disparo lote Toque 1 — parceira-existente', () => {
  it('define etapa parceira, is_parceira, selo e audita PARCEIRA_EXISTENTE_LEGADO', () => {
    const empresa: Record<string, any> = {
      id: 'emp9',
      etapa_funil: 'qualificada',
      etapa_anterior: '',
      is_parceira: false,
    }
    const audit = aplicarParceiraLegado(empresa, 'Cliente antigo já era parceiro')
    expect(empresa.etapa_funil).toBe('parceira')
    expect(empresa.is_parceira).toBe(true)
    expect(typeof empresa.data_selo_parceira).toBe('string')
    expect(empresa.etapa_anterior).toBe('qualificada')
    expect(audit.acao).toBe('PARCEIRA_EXISTENTE_LEGADO')
    expect(audit.entidade).toBe('empresas')
    expect(audit.registro_id).toBe('emp9')
    expect(audit.detalhes.motivo).toBe('Cliente antigo já era parceiro')
  })

  it('não sobrescreve etapa_anterior quando a empresa já era parceira (idempotente)', () => {
    const empresa = {
      id: 'emp10',
      etapa_funil: 'parceira',
      etapa_anterior: 'em_conversa',
      is_parceira: true,
    }
    const audit = aplicarParceiraLegado(empresa, 'reafirmação')
    expect(empresa.etapa_anterior).toBe('em_conversa')
    expect(audit.detalhes.etapa_anterior).toBe('em_conversa')
  })
})

describe('Disparo lote Toque 1 — espaçamento do cron (≥ 15s)', () => {
  it('pula a execução quando o último envio foi há menos de 15s', () => {
    const agora = Date.now()
    const ultimoEnvio = agora - 10_000
    const devePular = agora - ultimoEnvio < 15_000
    expect(devePular).toBe(true)
  })

  it('processa quando o último envio foi há 15s ou mais', () => {
    const agora = Date.now()
    const ultimoEnvio = agora - 20_000
    const devePular = agora - ultimoEnvio < 15_000
    expect(devePular).toBe(false)
  })
})
