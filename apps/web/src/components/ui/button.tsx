import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-copy-14 font-medium transition-all duration-fast ease-yohaku disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:opacity-90',
        secondary:
          'bg-neutral-2 text-neutral-10 ring-1 ring-border hover:bg-neutral-3 hover:ring-neutral-4',
        ghost: 'text-neutral-8 hover:bg-neutral-2 hover:text-neutral-10',
        outline: 'ring-1 ring-border bg-transparent hover:bg-neutral-2',
        destructive: 'bg-error text-white hover:opacity-90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-label-12',
        lg: 'h-12 px-6 text-copy-16',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
