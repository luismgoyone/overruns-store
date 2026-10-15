'use server'

import { redirect } from 'next/navigation'
import { safeNextPath } from '@/lib/auth/paths'
import { createClient } from '@/lib/supabase/server'

export async function signIn(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
  if (error) return { error: 'Wrong email or password.' }
  redirect(safeNextPath(String(formData.get('next') ?? '')))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
