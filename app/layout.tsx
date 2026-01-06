import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TRPG Chat Game',
  description: 'ブラウザで遊べるTRPG風チャットゲーム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}


