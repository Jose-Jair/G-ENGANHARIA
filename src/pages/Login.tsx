import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/services/users'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ShieldCheck, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { GPlusLogo } from '@/components/GPlusLogo'

export default function LoginPage() {
  const { login, confirmMfaLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // MFA Flow
  const [showMfaStep, setShowMfaStep] = useState(false)
  const [totpCode, setTotpCode] = useState('')

  // Forgot password flow
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  const getRedirectPath = (role: string) => {
    const from = (location.state as { from?: { pathname?: string } })?.from?.pathname
    if (from && from !== '/login') return from
    if (role === 'executor') return '/portal-executor'
    return role === 'admin' ? '/dashboard' : '/'
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const { user, requiresMfa } = await login(email, password)
      if (requiresMfa) {
        setShowMfaStep(true)
        toast({
          title: 'MFA Requerido',
          description: 'Insira o código de autenticação de 6 dígitos para o perfil Administrador.',
        })
      } else {
        toast({
          title: 'Login efetuado',
          description: `Bem-vindo(a), ${user.name}!`,
        })
        navigate(getRedirectPath(user.role), { replace: true })
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao autenticar. Verifique e-mail e senha.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await confirmMfaLogin(totpCode)
      toast({
        title: 'MFA Confirmado',
        description: 'Autenticação de dois fatores aprovada.',
      })
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Código MFA inválido.'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleQuickLogin = (userEmail: string) => {
    setEmail(userEmail)
    setPassword('Eng@2024')
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotSubmitting(true)
    try {
      await usersService.requestPasswordReset(forgotEmail)
      setForgotSuccess(true)
      toast({
        title: 'E-mail enviado',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      })
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Falha no envio',
        description: err instanceof Error ? err.message : 'Não foi possível solicitar o reset.',
      })
    } finally {
      setForgotSubmitting(false)
    }
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
          <p className="text-xs text-slate-400">
            Plataforma de Intermediação Técnica de Engenharia & Gestão de Demandas
          </p>
          <div className="text-[11px] font-mono text-slate-500">Versão v1.0.0-beta</div>
        </div>

        <Card className="border-slate-800 bg-[#1E2A4A]/90 backdrop-blur text-slate-100 shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white">
              {showMfaStep ? 'Autenticação em Duas Etapas (MFA)' : 'Acesso ao Sistema'}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {showMfaStep
                ? 'Insira o código de 6 dígitos gerado pelo seu app autenticador (TOTP)'
                : 'Informe suas credenciais institucionais para entrar'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMessage && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-800 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {!showMfaStep ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200 text-sm">
                    E-mail Institucional
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ex: admin@gestaogmais.eng.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#D95A2B]"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-200 text-sm">
                      Senha
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email)
                        setForgotSuccess(false)
                        setShowForgotModal(true)
                      }}
                      className="text-xs text-orange-400 hover:text-orange-300 hover:underline transition"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-slate-950/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-[#D95A2B]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#D95A2B] hover:bg-[#C44E22] text-white font-semibold py-2.5 shadow-lg shadow-orange-950/40"
                >
                  {isSubmitting ? 'Autenticando...' : 'Entrar no Sistema'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div className="p-4 rounded-lg bg-blue-950/40 border border-blue-800/40 text-blue-200 text-sm flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Segurança Reforçada (Admin)</span>
                    Abra seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator)
                    e digite o código de 6 dígitos.
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totp" className="text-slate-200 text-sm">
                    Código de 6 Dígitos
                  </Label>
                  <Input
                    id="totp"
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    autoFocus
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    className="bg-slate-900 border-slate-700 text-center tracking-widest text-2xl font-mono text-white focus:border-blue-500"
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowMfaStep(false)
                      setTotpCode('')
                    }}
                    className="w-1/3 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Voltar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || totpCode.length !== 6}
                    className="w-2/3 bg-[#D95A2B] hover:bg-[#C44E22] text-white font-semibold"
                  >
                    {isSubmitting ? 'Validando...' : 'Confirmar Código'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-3 border-t border-slate-800/80 pt-4">
            <div className="text-xs text-slate-400 text-center w-full">
              <span className="font-medium text-slate-300">
                Contas de Demonstração (Senha: Eng@2024):
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 w-full text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@sistema.eng.br')}
                className="text-left px-2 py-1.5 rounded bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 flex items-center justify-between group"
              >
                <span>Admin</span>
                <span className="text-[10px] text-orange-400 font-mono group-hover:text-orange-300">
                  Ana
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('comercial@sistema.eng.br')}
                className="text-left px-2 py-1.5 rounded bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 flex items-center justify-between group"
              >
                <span>Comercial</span>
                <span className="text-[10px] text-orange-400 font-mono group-hover:text-orange-300">
                  Carlos
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('financeiro@sistema.eng.br')}
                className="text-left px-2 py-1.5 rounded bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 flex items-center justify-between group"
              >
                <span>Financeiro</span>
                <span className="text-[10px] text-orange-400 font-mono group-hover:text-orange-300">
                  Beatriz
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('gestor@sistema.eng.br')}
                className="text-left px-2 py-1.5 rounded bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 flex items-center justify-between group"
              >
                <span>Gestor</span>
                <span className="text-[10px] text-orange-400 font-mono group-hover:text-orange-300">
                  Daniel
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('executor@sistema.eng.br')}
                className="col-span-2 text-left px-2 py-1.5 rounded bg-slate-950 hover:bg-slate-900 text-slate-300 border border-slate-800 flex items-center justify-between group"
              >
                <span>Executor Externo</span>
                <span className="text-[10px] text-orange-400 font-mono group-hover:text-orange-300">
                  Eduardo
                </span>
              </button>
            </div>
          </CardFooter>
        </Card>

        <div className="text-center text-xs text-slate-400 space-y-1">
          <div>GESTÃO G+ • Conectando ideias, somando resultados</div>
          <div className="text-[11px] text-slate-500 font-mono">
            v1.0.0-beta • Ambiente de Operação & Testes Reais
          </div>
        </div>
      </div>

      {/* Esqueci a Senha Dialog */}
      <Dialog open={showForgotModal} onOpenChange={setShowForgotModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-400" />
              Recuperação de Senha
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Digite seu e-mail cadastrado. Um link de redefinição seguro será emitido pelo
              PocketBase.
            </DialogDescription>
          </DialogHeader>

          {forgotSuccess ? (
            <div className="py-4 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="text-sm text-slate-200">
                Link de recuperação enviado com sucesso para{' '}
                <span className="font-semibold text-white">{forgotEmail}</span>.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowForgotModal(false)}
                className="mt-4 border-slate-700 text-slate-200"
              >
                Fechar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="forgotEmail" className="text-sm text-slate-300">
                  E-mail do Usuário
                </Label>
                <Input
                  id="forgotEmail"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="ex: seu.email@sistema.eng.br"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForgotModal(false)}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="bg-[#D95A2B] hover:bg-[#C44E22] text-white"
                >
                  {forgotSubmitting ? 'Enviando...' : 'Enviar Link de Redefinição'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
