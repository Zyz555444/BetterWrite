import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import type * as React from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-label-12 font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent text-white hover:opacity-90',
        secondary: 'border-transparent bg-neutral-2 text-neutral-8 hover:bg-neutral-3',
        outline: 'text-neutral-8 ring-1 ring-border',
        destructive: 'border-transparent bg-error text-white hover:opacity-90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
