import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { usersService } from '@/services/users'
import { toast } from '@/hooks/use-toast'

interface ModalTrocarSenhaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userName?: string
  userEmail?: string
}

export function ModalTrocarSenha({
  open,
  onOpenChange,
  userName,
  userEmail,
}: ModalTrocarSenhaProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const resetForm = () => {
    setOldPassword('')
    setNewPassword('')
    setNewPasswordConfirm('')
    setErrorMessage('')
    setSuccess(false)
    setLoading(false)
  }

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!oldPassword) {
      setErrorMessage('Informe a senha atual.')
      return
    }

    if (newPassword.length < 8) {
      setErrorMessage('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (newPassword !== newPasswordConfirm) {
      setErrorMessage('A confirmação da nova senha não confere.')
      return
    }

    if (oldPassword === newPassword) {
      setErrorMessage('A nova senha não pode ser igual à senha atual.')
      return
    }

    setLoading(true)
    try {
      await usersService.changePassword(oldPassword, newPassword, newPasswordConfirm)
      setSuccess(true)
      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua nova senha já está em vigor para os próximos acessos.',
      })
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Falha ao alterar senha. Verifique se a senha atual está correta.'
      setErrorMessage(
        msg.includes('oldPassword') || msg.toLowerCase().includes('failed')
          ? 'Senha atual incorreta. Por favor, verifique e tente novamente.'
          : msg,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-100 text-[#D95A2B]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Alterar Minha Senha
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {userName
                  ? `${userName} (${userEmail})`
                  : 'Atualize suas credenciais com segurança'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Senha atualizada com sucesso!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Ação auditada no sistema. Use a nova senha nos seus próximos logins.
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={() => handleClose(false)}
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs"
              >
                Concluir
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {errorMessage && (
              <Alert
                variant="destructive"
                className="bg-red-50 border-red-200 text-red-800 text-xs py-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="oldPass" className="text-xs font-semibold text-slate-700">
                Senha Atual *
              </Label>
              <div className="relative">
                <Input
                  id="oldPass"
                  type={showPasswords ? 'text' : 'password'}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Informe a senha que você usa agora"
                  className="pr-10 text-xs h-9 bg-slate-50 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPass" className="text-xs font-semibold text-slate-700">
                Nova Senha * (mínimo 8 caracteres)
              </Label>
              <div className="relative">
                <Input
                  id="newPass"
                  type={showPasswords ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha segura"
                  className="pr-10 text-xs h-9 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassConf" className="text-xs font-semibold text-slate-700">
                Confirmar Nova Senha *
              </Label>
              <div className="relative">
                <Input
                  id="newPassConf"
                  type={showPasswords ? 'text' : 'password'}
                  required
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pr-10 text-xs h-9 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-slate-700">
                <Lock className="w-3.5 h-3.5 text-orange-500" />
                Segurança & Auditoria:
              </div>
              <p>
                Cada troca de senha é auditada com registro de data/hora e IP. O perfil
                Administrador e Comercial continuam utilizando suas permissões normais.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleClose(false)}
                disabled={loading}
                className="text-xs text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="bg-[#D95A2B] hover:bg-[#C44E22] text-white text-xs font-semibold"
              >
                {loading ? 'Salvando...' : 'Salvar Nova Senha'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
