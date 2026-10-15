import 'server-only'
import { Resend } from 'resend'

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.info('[email] RESEND_API_KEY not set; skipping send', { to: msg.to, subject: msg.subject })
    return
  }
  const { error } = await new Resend(key).emails.send({
    from: process.env.EMAIL_FROM ?? 'The Overruns Project <onboarding@resend.dev>',
    ...msg,
  })
  if (error) throw new Error(`Resend failed: ${error.message}`)
}
