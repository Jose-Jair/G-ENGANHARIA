import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { GPlusLogo } from '@/components/GPlusLogo'

/**
 * Página pública de definição/redefinição de senha (link recebido por e-mail).
 * Destino unificado dos e-mails de reset do PocketBase e do convite do prestador:
 *   /redefinir-senha?token={TOKEN}
 */
export default function RedefinirSenhaPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [linkInvalido, setLinkInvalido] = useState(!token)

  const validarFormulario = (): string => {
    if (!token) return 'Link inválido: token de redefinição ausente.'
    if (senha.length < 8) return 'A senha deve ter no mínimo 8 caracteres.'
    if (senha !== confirmacao) return 'As senhas não coincidem.'
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    const erroValidacao = validarFormulario()
    if (erroValidacao) {
      setErrorMessage(erroValidacao)
      return
    }

    setIsSubmitting(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, senha, confirmacao)
      navigate('/login', {
        replace: true,
        state: { senhaDefinida: true },
      })
    } catch (err: unknown) {
      setLinkInvalido(true)
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível definir a senha. O link pode ser inválido ou ter expirado.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const irParaEsqueciMinhaSenha = () => {
    navigate('/login?recuperar=1')
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#141D34] px-4 py-8 relative">
      {/* Fundo Navy institucional com gradiente sutil */}
      <div className="absolute inset-0 bg-radial from-[#1E2A4A] via-[#141D34] to-[#0D1322] opacity-95 -z-10" />

      <div className="w-full max-w-md space-y-6">
        {/* Logo oficial da empresa G+ Engenharia completa */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xs">
              <GPlusLogo variant="vertical" theme="dark" size={88} showSlogan={true} />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">GESTÃO G+</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D95A2B]/20 text-[#D95A2B] border border-[#D95A2B]/40 uppercase tracking-wider">
              BETA
            </span>
          </div>
        </div>

        <Card className="border-slate-800 bg-[#1E2A4A]/90 backdrop-blur text-slate-100 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#D95A2B]" />
              Defina sua senha
            </CardTitle>
            <CardDescription className="text-slate-400">
              Crie a nova senha de acesso à plataforma GESTÃO G+. Mínimo de 8 caracteres.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-800 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {linkInvalido ? (
              <div className="space-y-4 py-2 text-center">
                <p className="text-sm text-slate-300">
                  O link de redefinição é inválido ou expirou (validade de 15 minutos). Solicite um
                  novo link para definir sua senha.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    onClick={irParaEsqueciMinhaSenha}
                    className="w-full bg-[#D95A2B] hover:bg-[#C44E22] text-white font-semibold"
                  >
                    Enviar novo link
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/login')}
                    className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    Voltar ao login
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="senha" className="text-slate-200 text-sm">
                    Nova senha
                  </Label>
                  <Input
                    id="senha"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Mínimo de 8 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#D95A2B]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmacao" className="text-slate-200 text-sm">
                    Confirmar nova senha
                  </Label>
                  <Input
                    id="confirmacao"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Repita a nova senha"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    required
                    className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#D95A2B]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#D95A2B] hover:bg-[#C44E22] text-white font-semibold py-2.5 shadow-lg shadow-orange-950/40"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Definir senha'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-slate-400 space-y-1">
          <div className="flex items-center justify-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Conexão segura com o servidor G+ Engenharia</span>
          </div>
          <div>GESTÃO G+ • Conectando ideias, somando resultados</div>
        </div>
      </div>
    </div>
  )
}
