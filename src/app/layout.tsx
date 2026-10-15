import type { Metadata } from 'next'
import { Inter, Space_Grotesk, Space_Mono } from 'next/font/google'
import { CartProvider } from '@/components/cart/cart-provider'
import './globals.css'

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-space-grotesk' })
const mono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-space-mono' })
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'The Overruns Project', template: '%s · The Overruns Project' },
  description: 'Real brands. Overrun prices. Authentic factory-surplus clothing in the Philippines.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-PH" className={`${display.variable} ${mono.variable} ${sans.variable}`}>
      <body className="min-h-dvh antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  )
}
