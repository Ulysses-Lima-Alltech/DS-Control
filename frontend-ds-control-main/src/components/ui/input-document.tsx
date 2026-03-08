import * as React from 'react';
import { ChangeHandler } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InputDocumentProps extends Omit<React.ComponentProps<typeof Input>, 'onChange'> {
  onChange?: ChangeHandler;
}

export function InputDocument({ onChange, ...props }: InputDocumentProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const onlyNumbers = e.target.value.replace(/\D/g, '');
    let maskedValue = e.target.value;

    if (onlyNumbers.length > 0) {
      // CPF format: XXX.XXX.XXX-XX (11 digits or less)
      if (onlyNumbers.length <= 11) {
        maskedValue = onlyNumbers.replace(
          /^(\d{3})(\d{3})?(\d{3})?(\d{2})?/,
          (_, p1, p2, p3, p4) => {
            let result = p1;
            if (p2) result += `.${p2}`;
            if (p3) result += `.${p3}`;
            if (p4) result += `-${p4}`;
            return result;
          }
        );
      } else {
        // CNPJ format: XX.XXX.XXX/XXXX-XX (more than 11 digits)
        maskedValue = onlyNumbers.replace(
          /^(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/,
          (_, p1, p2, p3, p4, p5) => {
            let result = p1;
            if (p2) result += `.${p2}`;
            if (p3) result += `.${p3}`;
            if (p4) result += `/${p4}`;
            if (p5) result += `-${p5}`;
            return result;
          }
        );
      }
    }

    const event = {
      ...e,
      target: {
        ...e.target,
        value: maskedValue,
      },
    };

    e.target.value = maskedValue;
    onChange?.(event);
  };

  return (
    <Input
      {...props}
      onChange={handleChange}
      maxLength={18}
      className={cn('uppercase', props.className)}
    />
  );
}
