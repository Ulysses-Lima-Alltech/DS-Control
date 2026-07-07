import '@/app/globals.css';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Inter } from 'next/font/google'; // eslint-disable-line
import { Toaster } from 'sonner';

import { AuthProvider } from '@/providers/auth.provider';
import QueryProvider from '@/providers/query.provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'IControl',
  description: 'IControl - Sistema de Controle de Fazendas',
  icons: {
    icon: '/images/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='pt-BR' suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
          </QueryProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
