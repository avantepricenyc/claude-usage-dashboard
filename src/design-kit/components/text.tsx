import React, {forwardRef} from 'react'

import {cn} from '../lib/utils'
import {cva, type VariantProps} from 'class-variance-authority'
import clsx from 'clsx'

const listStyles = clsx(
  // Unordered lists
  '[&>ul]:list-disc',
  '[&>ul]:pl-6',
  '[&>ul]:space-y-2',
  '[&>ul]:mt-2',

  // Ordered lists
  '[&>ol]:list-decimal',
  '[&>ol]:pl-6',
  '[&>ol]:space-y-2',
  '[&>ol]:mt-2',

  // Definition lists
  '[&>dl]:mt-2',
  '[&>dl]:space-y-2',
  '[&>dl>dt]:font-medium',
  '[&>dl>dd]:pl-6',
  '[&>dl>dd]:mt-1',
)

/**
 * Text variants aligned with Posh Design System typography tokens
 *
 * Primary content for paragraphs, UI copy, helper text, and metadata.
 * Optimized for readability and frequent use.
 *
 * @see https://www.figma.com/design/o1BxV3Qe1M1cTZeOrZgl9Q/Posh-Design-System
 */
export const textVariants = cva('', {
  variants: {
    /**
     * Semantic text size variants from Posh Design System
     */
    variant: {
      // Text variants (Neue Haas Grotesk Text Pro)
      'text-xs': 'text-xs leading-4', // 12px, lh: 16px
      'text-sm': 'text-sm leading-5', // 14px, lh: 20px
      'text-md': 'text-base leading-6', // 16px, lh: 24px (base)
      'text-lg': 'text-lg leading-7', // 18px, lh: 28px

      // Legacy variants (backwards compatible)
      default: 'text-base leading-6', // maps to text-md
      xs: 'text-xs leading-4', // maps to text-xs
      small: 'text-sm leading-5', // maps to text-sm
      large: 'text-lg leading-7', // maps to text-lg

      // Semantic variants
      muted: 'text-sm leading-5 text-muted-foreground',
      lead: 'text-xl leading-7 text-muted-foreground',
      opacity: 'text-sm leading-5 text-primary/80',
    },
    /**
     * Font weight - Normal (400) or Medium (500)
     */
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
    },
  },
  defaultVariants: {
    variant: 'default',
    weight: 'normal',
  },
})

interface TextProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof textVariants> {
  noMargin?: boolean
}

const Paragraph = forwardRef<HTMLParagraphElement, TextProps>(
  ({className, variant, weight, noMargin, ...props}, ref) => (
    <p
      className={cn(textVariants({variant, weight}), !noMargin && 'mb-4', listStyles, className)}
      ref={ref}
      {...props}
    />
  ),
)
Paragraph.displayName = 'Paragraph'

const Span = forwardRef<HTMLSpanElement, TextProps>(({className, variant, weight, ...props}, ref) => (
  <span className={cn(textVariants({variant, weight}), className)} ref={ref} {...props} />
))
Span.displayName = 'Span'

export {Paragraph, Span}
