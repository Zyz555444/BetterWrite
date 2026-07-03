import { cn } from '@/lib/utils';
import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10',
          'ring-1 ring-border placeholder:text-neutral-6',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'transition-all duration-fast ease-yohaku',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
