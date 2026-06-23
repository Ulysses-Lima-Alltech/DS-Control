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
    <div className='flex items-center justify-between text-sm'>
      <Breadcrumb>
        <BreadcrumbList className='gap-2 text-muted-foreground'>
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
                        className={`text-sm ${
                          index === subdividedPathname.length - 1
                            ? 'cursor-text text-foreground/75'
                            : 'font-medium text-primary hover:text-primary/85'
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
