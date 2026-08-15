import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | Asaheeb CRM',
    default: 'Asaheeb CRM — Real Estate Sales Platform',
  },
  description: 'Enterprise Real Estate CRM for managing leads, pipeline, agents, and property sales.',
  icons: {
    icon: '/Favicon.png',
    shortcut: '/Favicon.png',
    apple: '/Favicon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
