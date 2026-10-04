// Connexion par mot de passe (cookie de session posé par l'API).

import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStore } from '@/lib/store'

export function Login() {
  const { login, loginError } = useStore()
  const [error, setError] = useState(loginError)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <form
        className="w-full max-w-xs space-y-6"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await login(e.currentTarget.password.value)
          } catch (err) {
            setError(err.message)
            setBusy(false)
          }
        }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary font-brand text-lg font-bold text-primary-foreground">O</div>
          <div>
            <h1 className="font-brand text-lg font-semibold tracking-tight">Obsimo Ventes</h1>
            <p className="text-sm text-muted-foreground">Ventes de merch, stock et comptes</p>
          </div>
        </div>
        <div className="space-y-2">
          <Input type="password" name="password" placeholder="Mot de passe" autoComplete="current-password" required autoFocus aria-invalid={error ? true : undefined} className="h-10" />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <Button type="submit" className="h-10 w-full" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <>Entrer <ArrowRight /></>}
        </Button>
      </form>
    </div>
  )
}
