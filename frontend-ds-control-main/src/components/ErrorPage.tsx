'use client';

import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionButton: {
    icon: LucideIcon;
    text: string;
    onClick: () => void;
    isLoading?: boolean;
  };
}

export default function ErrorPage({ title, description, icon, actionButton }: ErrorPageProps) {
  const { icon: ButtonIcon, text, onClick, isLoading = false } = actionButton;

  return (
    <div className='flex flex-col w-full min-h-screen items-center justify-center bg-background p-4'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className='flex flex-col items-center justify-center gap-8 max-w-2xl mx-auto text-center'
      >
        <motion.div
          className='relative'
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            ease: 'easeInOut',
          }}
        >
          {icon}
        </motion.div>

        <h1 className='text-5xl sm:text-6xl md:text-7xl font-bold text-foreground tracking-tighter'>
          {title}
        </h1>

        <p className='text-xl text-muted-foreground'>{description}</p>

        <Button
          onClick={onClick}
          size='lg'
          className='mt-4 transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg'
        >
          {isLoading ? (
            <div className='mr-2 h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent' />
          ) : (
            <ButtonIcon className='mr-2 h-5 w-5' />
          )}
          {text}
        </Button>
      </motion.div>
    </div>
  );
}
