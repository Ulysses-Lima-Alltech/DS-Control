'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  deriveFarmStrokeColor,
  FARM_MAP_COLOR_PATTERN,
  getFarmMapColorWarnings,
} from '@/utils/farm-map-color';

type Props = {
  value: string;
  onChange: (value: string) => void;
  automatic: boolean;
  onAutomaticChange: (value: boolean) => void;
  previewColor: string;
  siblingColors?: string[];
};

export default function FarmMapColorField({
  value,
  onChange,
  automatic,
  onAutomaticChange,
  previewColor,
  siblingColors = [],
}: Props) {
  const effectiveColor = automatic ? previewColor : value;
  const valid = FARM_MAP_COLOR_PATTERN.test(effectiveColor);
  const warnings = valid ? getFarmMapColorWarnings(effectiveColor, siblingColors) : [];

  return (
    <div className='space-y-2 rounded-md border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <Label htmlFor='farmMapColor'>Cor nos mapas</Label>
        <div className='flex items-center gap-2'>
          <Checkbox
            id='automaticFarmMapColor'
            checked={automatic}
            onCheckedChange={(checked) => onAutomaticChange(checked === true)}
          />
          <Label htmlFor='automaticFarmMapColor' className='font-normal'>
            Automática
          </Label>
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Input
          aria-label='Seletor visual da cor da fazenda'
          type='color'
          value={valid ? effectiveColor : '#64748B'}
          disabled={automatic}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className='h-10 w-14 p-1'
        />
        <Input
          id='farmMapColor'
          value={automatic ? effectiveColor : value}
          disabled={automatic}
          maxLength={7}
          placeholder='#71A780'
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
        <span
          title='Prévia da cor e do contorno'
          className='h-9 w-9 shrink-0 rounded'
          style={{
            backgroundColor: valid ? effectiveColor : '#FFFFFF',
            border: `3px solid ${valid ? deriveFarmStrokeColor(effectiveColor) : '#DC2626'}`,
          }}
        />
      </div>
      {!valid && <p className='text-xs text-red-600'>Use exatamente o formato #RRGGBB.</p>}
      {automatic && (
        <p className='text-xs text-muted-foreground'>
          A cor é calculada de forma determinística e persistida ao salvar.
        </p>
      )}
      {warnings.map((warning) => (
        <p key={warning} className='text-xs text-amber-700'>
          {warning}
        </p>
      ))}
    </div>
  );
}
