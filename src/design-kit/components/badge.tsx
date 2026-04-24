import * as React from 'react'

import {cn} from '../lib/utils'
import {Slot} from '@radix-ui/react-slot'
import {cva, type VariantProps} from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary: 'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        destructive:
          'border-transparent bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90',
        outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
      },
      shape: {
        default: 'rounded-md',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      shape: 'default',
    },
  },
)

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string
  asChild?: boolean
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps & React.HTMLAttributes<HTMLSpanElement>>(
  ({className, variant, shape, asChild = false, ...props}, ref) => {
    const Comp = asChild ? Slot : 'span'

    return <Comp ref={ref} data-slot='badge' className={cn(badgeVariants({variant, shape}), className)} {...props} />
  },
)

Badge.displayName = 'Badge'

export {Badge, badgeVariants}
