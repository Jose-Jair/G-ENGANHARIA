/// <reference path="../pb_data/types.d.ts" />

/**
 * Migração 0051: Normalizar telefones para apenas dígitos com DDI 55
 * Coleções afetadas:
 * - empresas (telefone e telefones JSON)
 * - contatos (telefone e whatsapp)
 * - clientes_pf (telefone e telefones JSON)
 * - executores (telefone)
 *
 * Idempotente: telefones que já possuem 55 ou vazios são preservados sem tocar registros desnecessários.
 */

migrate(
  (app) => {
    // Função auxiliar interna para normalização segura com DDI 55
    function normalizarParaDdi55(val) {
      if (!val) return ''
      var clean = String(val).replace(/\D/g, '')
      if (!clean) return ''

      // Se já começa com 55 e tem 12 ou 13 dígitos, já está normalizado
      if (clean.indexOf('55') === 0 && (clean.length === 12 || clean.length === 13)) {
        return clean
      }

      // Se tem 10 dígitos (DDD + 8 fixo) ou 11 dígitos (DDD + 9 celular), prefixa com 55
      if (clean.length === 10 || clean.length === 11) {
        return '55' + clean
      }

      // Se já tem mais dígitos mas começa com 55
      if (clean.indexOf('55') === 0 && clean.length > 11) {
        return clean
      }

      return clean
    }

    // 1. EMPRESAS
    try {
      const empresas = app.findRecordsByFilter('empresas', 'id != ""', '', 0, 0)
      for (let i = 0; i < empresas.length; i++) {
        const emp = empresas[i]
        let alterou = false

        // Campo simples 'telefone'
        const telAtual = emp.getString('telefone')
        if (telAtual) {
          const telNorm = normalizarParaDdi55(telAtual)
          if (telNorm && telNorm !== telAtual) {
            emp.set('telefone', telNorm)
            alterou = true
          }
        }

        // Campo JSON 'telefones'
        try {
          const listaTels = emp.get('telefones')
          if (Array.isArray(listaTels) && listaTels.length > 0) {
            let jsonAlterou = false
            const novaLista = listaTels.map((item) => {
              if (item && item.numero) {
                const norm = normalizarParaDdi55(item.numero)
                if (norm && norm !== item.numero) {
                  jsonAlterou = true
                  return Object.assign({}, item, { numero: norm })
                }
              }
              return item
            })

            if (jsonAlterou) {
              emp.set('telefones', novaLista)
              alterou = true
            }
          }
        } catch (jsonErr) {
          console.warn('[0051] Erro ao parsear telefones de empresa:', jsonErr)
        }

        if (alterou) {
          app.save(emp)
        }
      }
    } catch (errEmpresas) {
      console.warn('[0051] Aviso ao normalizar empresas:', errEmpresas)
    }

    // 2. CONTATOS
    try {
      const contatos = app.findRecordsByFilter('contatos', 'id != ""', '', 0, 0)
      for (let i = 0; i < contatos.length; i++) {
        const c = contatos[i]
        let alterou = false

        const telAtual = c.getString('telefone')
        if (telAtual) {
          const telNorm = normalizarParaDdi55(telAtual)
          if (telNorm && telNorm !== telAtual) {
            c.set('telefone', telNorm)
            alterou = true
          }
        }

        const waAtual = c.getString('whatsapp')
        if (waAtual) {
          const waNorm = normalizarParaDdi55(waAtual)
          if (waNorm && waNorm !== waAtual) {
            c.set('whatsapp', waNorm)
            alterou = true
          }
        }

        if (alterou) {
          app.save(c)
        }
      }
    } catch (errContatos) {
      console.warn('[0051] Aviso ao normalizar contatos:', errContatos)
    }

    // 3. CLIENTES_PF
    try {
      const clientesPf = app.findRecordsByFilter('clientes_pf', 'id != ""', '', 0, 0)
      for (let i = 0; i < clientesPf.length; i++) {
        const pf = clientesPf[i]
        let alterou = false

        const telAtual = pf.getString('telefone')
        if (telAtual) {
          const telNorm = normalizarParaDdi55(telAtual)
          if (telNorm && telNorm !== telAtual) {
            pf.set('telefone', telNorm)
            alterou = true
          }
        }

        try {
          const listaTels = pf.get('telefones')
          if (Array.isArray(listaTels) && listaTels.length > 0) {
            let jsonAlterou = false
            const novaLista = listaTels.map((item) => {
              if (item && item.numero) {
                const norm = normalizarParaDdi55(item.numero)
                if (norm && norm !== item.numero) {
                  jsonAlterou = true
                  return Object.assign({}, item, { numero: norm })
                }
              }
              return item
            })

            if (jsonAlterou) {
              pf.set('telefones', novaLista)
              alterou = true
            }
          }
        } catch (jsonErr) {
          console.warn('[0051] Erro ao parsear telefones de clientes_pf:', jsonErr)
        }

        if (alterou) {
          app.save(pf)
        }
      }
    } catch (errPf) {
      console.warn('[0051] Aviso ao normalizar clientes_pf:', errPf)
    }

    // 4. EXECUTORES
    try {
      const executores = app.findRecordsByFilter('executores', 'id != ""', '', 0, 0)
      for (let i = 0; i < executores.length; i++) {
        const ex = executores[i]
        let alterou = false

        const telAtual = ex.getString('telefone')
        if (telAtual) {
          const telNorm = normalizarParaDdi55(telAtual)
          if (telNorm && telNorm !== telAtual) {
            ex.set('telefone', telNorm)
            alterou = true
          }
        }

        if (alterou) {
          app.save(ex)
        }
      }
    } catch (errExec) {
      console.warn('[0051] Aviso ao normalizar executores:', errExec)
    }
  },
  (app) => {
    // Rollback não destrutivo: dados normalizados para DDI 55 são mantidos
  },
)
