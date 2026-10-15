export function formatPeso(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new Error(`formatPeso expects integer centavos, got ${centavos}`)
  const digits = centavos % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(centavos / 100)
}
