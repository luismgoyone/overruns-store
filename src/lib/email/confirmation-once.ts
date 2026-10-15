export type ConfirmationDeps = {
  /** Atomically sets confirmation_sent_at if it is null on a paid/shipped order; true when this caller won. */
  claim(orderId: string): Promise<boolean>
  /** Clears confirmation_sent_at after a failed send so a later attempt can retry. */
  release(orderId: string): Promise<void>
  markSent(orderId: string): Promise<void>
  send(orderId: string): Promise<void>
}

/** Sends the confirmation unless another path (webhook, reconciliation) already did. */
export async function sendConfirmationOnce(orderId: string, deps: ConfirmationDeps): Promise<'sent' | 'skipped'> {
  if (!(await deps.claim(orderId))) return 'skipped'
  try {
    await deps.send(orderId)
  } catch (err) {
    await deps.release(orderId).catch((releaseErr) => console.error('[email] could not release confirmation claim', { orderId, releaseErr }))
    throw err
  }
  return 'sent'
}

/** Admin "Resend confirmation": always sends, then records the time. */
export async function resendConfirmation(orderId: string, deps: ConfirmationDeps): Promise<void> {
  await deps.send(orderId)
  await deps.markSent(orderId)
}
