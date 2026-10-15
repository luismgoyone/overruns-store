export function computeTotals(subtotalCentavos: number, shippingFeeCentavos: number) {
  const shipping = subtotalCentavos > 0 ? shippingFeeCentavos : 0
  return { subtotal: subtotalCentavos, shipping, total: subtotalCentavos + shipping }
}
