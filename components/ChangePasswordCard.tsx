'use client'

import { useState } from 'react'
import { Eye, EyeOff, KeyRound, CheckCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Lets a signed-in user choose a new password. Used on the Profile page so
 * people who started with the temporary password from their invite email can
 * replace it any time. The current password is re-checked first so a left-open
 * session can't be used to lock the real owner out.
 */
export default function ChangePasswordCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const reset = () => {
    setCurrent(''); setNext(''); setConfirm(''); setError(null); setShow(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (next.length < 8) return setError('Your new password must be at least 8 characters.')
    if (next !== confirm) return setError('The new passwords do not match.')
    if (next === current) return setError('Choose a password different from your current one.')

    setSaving(true)
    try {
      const supabase = createClient()

      // Verify the current password (the temporary one, for a new user).
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current })
      if (verifyError) {
        setError('Your current password is not correct.')
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: next,
        data: { must_set_password: false },
      })
      if (updateError) {
        setError(updateError.message || 'Could not update your password. Please try again.')
        return
      }

      reset()
      setOpen(false)
      setSuccess(true)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 border-2 border-tm-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all'

  return (
    <div className="pt-4 mt-2 border-t border-tm-border">
      <label className="block text-sm font-medium text-tm-text-3 mb-1">Password</label>

      {success && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle className="w-4 h-4" /> Password updated. Use it the next time you sign in.
        </div>
      )}

      {!open ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-tm-text-3">
            Started with a temporary password from your invite email? Replace it with one only you know.
          </p>
          <button
            type="button"
            onClick={() => { setOpen(true); setSuccess(false) }}
            className="px-5 py-2.5 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold hover:opacity-90 transition-all inline-flex items-center whitespace-nowrap"
          >
            <KeyRound className="w-4 h-4 mr-2" />
            Change password
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2 text-sm text-secondary">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-tm-text-3 mb-1">Current password</label>
            <input
              type={show ? 'text' : 'password'}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-tm-text-3 mb-1">New password</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tm-text-3 hover:text-tm-text-1"
                aria-label={show ? 'Hide passwords' : 'Show passwords'}
              >
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-tm-text-3 mt-1">At least 8 characters.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-tm-text-3 mb-1">Confirm new password</label>
            <input
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-all inline-flex items-center disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              {saving ? 'Updating…' : 'Update password'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => { reset(); setOpen(false) }}
              className="px-5 py-2.5 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
