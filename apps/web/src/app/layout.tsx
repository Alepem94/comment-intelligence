import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Comment Intelligence',
  description: 'Extracci\u00f3n de comentarios reales de Instagram, Facebook y TikTok'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
