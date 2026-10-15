// Set in sessionStorage when the shopper leaves for PayMongo; the order page clears the cart for a
// still-pending order only if this tab started that checkout (PayMongo's success redirect).
export const CHECKOUT_MARKER_KEY = 'overruns:checkout-key'

export function setCheckoutMarker(key: string) {
  try {
    sessionStorage.setItem(CHECKOUT_MARKER_KEY, key)
  } catch {}
}

/** True (and the marker is consumed) when this tab's last checkout used `key`. */
export function takeCheckoutMarker(key: string | null): boolean {
  if (!key) return false
  try {
    if (sessionStorage.getItem(CHECKOUT_MARKER_KEY) !== key) return false
    sessionStorage.removeItem(CHECKOUT_MARKER_KEY)
    return true
  } catch {
    return false
  }
}
