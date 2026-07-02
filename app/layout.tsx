import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ReviseRight — AI Revision Questions from Your Textbook',
  description: 'Photo your chapter, pick question types, get MCQs, long answers, critical thinking questions in seconds.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Inter', sans-serif" }}>{children}</body>
    </html>
  )
}
