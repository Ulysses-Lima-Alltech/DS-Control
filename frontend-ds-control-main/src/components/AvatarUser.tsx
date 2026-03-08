import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type AvatarUserProps = {
  name?: string;
  avatarUrl?: string;
  className?: string;
} & React.ComponentProps<typeof AvatarPrimitive.Root>;

export default function AvatarUser(props: AvatarUserProps) {
  const wordsCount = props.name ? props.name.split(' ').length : 0;
  const acronym = () => {
    if (wordsCount === 1 && props.name) {
      return props.name?.charAt(0).toUpperCase() + props.name?.charAt(1).toUpperCase();
    } else if (wordsCount > 1 && props.name) {
      const initials = props.name
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
      return initials;
    }
    return 'DS';
  };

  return (
    <Avatar className={`h-8 w-8 rounded-lg ${props.className || ''}`}>
      <AvatarImage src={props.avatarUrl} alt={props.name} />
      <AvatarFallback className='flex aspect-square items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
        {acronym()}
      </AvatarFallback>
    </Avatar>
  );
}
