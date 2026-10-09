// Migração 0069 — Tornada inerte para impedir replantio de dados de teste em novos deploys.
// Os testes de validação ponta a ponta e a limpeza definitiva foram executados e atestados na migração 0070.
migrate(
  (_app) => {
    // Inerte: não semeia dados de teste em novos deploys ou reinicializações.
  },
  (_app) => {
    // Reversão inerte
  },
)
