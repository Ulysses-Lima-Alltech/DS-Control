'use client';

import dynamic from 'next/dynamic';

const PDFPreviewContent = dynamic(
  () => import('./PreviewReportContent'),
  {
    ssr: false,
    loading: () => (
      <div className='flex items-center justify-center h-96 text-muted-foreground'>
        Carregando preview...
      </div>
    ),
  }
);

export default function PreviewReportPage() {
  return (
    <div className='flex flex-col min-h-screen w-full bg-muted p-4'>
      <div className='mb-4'>
        <h1 className='text-lg font-semibold text-foreground'>
          Preview do Relatório PDF (temporário)
        </h1>
        <p className='text-sm text-muted-foreground'>
          Dados mockados
        </p>
      </div>
      <div className='flex-1 min-h-[600px] border border-border rounded-lg overflow-hidden bg-white'>
        <PDFPreviewContent />
      </div>
    </div>
  );
}
