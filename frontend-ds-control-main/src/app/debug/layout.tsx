import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Layout mínimo para rotas de debug — fora de `/dashboard`, sem `AuthGuard` nem sidebar.
 * REMOVER: apague a pasta `src/app/debug/` quando não precisar mais validar localmente.
 */
export default function DebugLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return (
    <div className='min-h-svh bg-background'>
      <div className='border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-950 dark:text-amber-100'>
        <strong className='font-semibold'>DEV ONLY</strong> — rota de debug local. Não usar em produção.
      </div>
      {children}
    </div>
  );
}
