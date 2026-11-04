// Teste de chamada da rota temporária E2E
import pb from '@/lib/pocketbase/client'

export async function rodarTesteE2E() {
  const res = await pb.send('/backend/v1/test-e2e-portal/executar', {
    method: 'POST',
  })
  return res
}
