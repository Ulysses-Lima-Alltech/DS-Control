'use client';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { pathItems, type PathItem } from '@/types/path.type';

export default function BreadcrumbHeader() {
  const pathname = usePathname();
  const subdividedPathname = pathname.split('/');

  function breadcrumbTranslator(subdividedPathname: string[]) {
    const translatedItems: string[] = [];

    subdividedPathname.map((item: string) => {
      if (pathItems.map((pathItem: PathItem) => pathItem.url.split('/').pop()).includes(item)) {
        translatedItems.push(
          pathItems.find((pathItem: PathItem) => pathItem.url.split('/').pop() === item)?.title ||
            item
        );
      } else {
        translatedItems.push('Detalhes');
      }
    });

    return translatedItems;
  }

  return (
    <div className='flex items-center justify-between text-xs'>
      <Breadcrumb>
        <BreadcrumbList className='gap-1 text-muted-foreground'>
          {breadcrumbTranslator(subdividedPathname).map((item, index) => {
            return (
              <Fragment key={`${index}-fragment`}>
                {index > 0 && (
                  <Fragment key={`${index}-fragment-internal`}>
                    <BreadcrumbSeparator key={`${index}-separator`} />
                    <BreadcrumbItem key={`${index}-item`}>
                      <BreadcrumbLink
                        key={`${index}-breadcrumb-link`}
                        href={
                          index === subdividedPathname.length - 1
                            ? '#'
                            : `/${subdividedPathname.slice(1, index + 1).join('/')}`
                        }
                        className={`text-xs ${
                          index === subdividedPathname.length - 1
                            ? 'cursor-text text-foreground/70'
                            : 'text-muted-foreground hover:text-primary'
                        }`}
                      >
                        {item}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </Fragment>
                )}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
