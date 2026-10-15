import type { Metadata } from 'next'
import { Archivo_Black, Inter } from 'next/font/google'
import { CartProvider } from '@/components/cart/cart-provider'
import './globals.css'

const display = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-archivo-black' })
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'The Overruns Project', template: '%s · The Overruns Project' },
  description: 'Real brands. Overrun prices. Authentic factory-surplus clothing in the Philippines.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  )
}
