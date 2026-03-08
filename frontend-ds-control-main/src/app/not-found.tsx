'use client';

import { Home } from 'lucide-react';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';

import ErrorPage from '@/components/ErrorPage';

export default function NotFound() {
  const router = useRouter();

  const NotFoundIcon = (
    <motion.svg
      xmlns='http://www.w3.org/2000/svg'
      width='200'
      height='200'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='text-gray-800 dark:text-gray-200'
      animate={{
        strokeDasharray: ['1, 200', '90, 200', '90, 200', '1, 200'],
      }}
      transition={{
        repeat: Infinity,
        duration: 6,
        ease: 'easeInOut',
      }}
    >
      <rect x='2' y='4' width='20' height='16' rx='2' />
      <path d='M7 8h10' />
      <path d='M7 12h5' />
      <path d='M12 16l5-5' />
      <path d='M17 16l-5-5' />
    </motion.svg>
  );

  return (
    <ErrorPage
      title='Página não encontrada'
      description='A página que você está procurando não existe.'
      icon={NotFoundIcon}
      actionButton={{
        icon: Home,
        text: 'Voltar para o painel',
        onClick: () => router.push('/dashboard'),
      }}
    />
  );
}
