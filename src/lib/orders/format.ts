export const formatOrderNumber = (id: string) => id.slice(0, 8).toUpperCase()

const manila = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
// Newer ICU puts a narrow no-break space before AM/PM; normalize so output is stable.
export const formatManilaDate = (iso: string) => manila.format(new Date(iso)).replace(/\u202f/g, ' ')
