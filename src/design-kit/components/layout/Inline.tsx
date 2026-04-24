import * as React from 'react'

import {cn} from '../../lib/utils'
import {Slot} from '@radix-ui/react-slot'
import {cva, type VariantProps} from 'class-variance-authority'

import {getAlignClass, getJustifyClass, getRadiusClass, getSpacingClass, type SystemProps} from '../../lib/system-props'

const inlineVariants = cva('flex flex-row', {
  variants: {
    inline: {
      true: 'inline-flex',
      false: 'flex',
    },
    wrap: {
      true: 'flex-wrap',
      false: 'flex-nowrap',
    },
  },
  defaultVariants: {
    inline: false,
    wrap: true,
  },
})

export interface InlineProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, keyof SystemProps>,
    Omit<SystemProps, 'wrap'>,
    VariantProps<typeof inlineVariants> {
  /**
   * Render as child component using Radix Slot
   */
  asChild?: boolean

  /**
   * Test ID for testing
   */
  'data-test'?: string

  /**
   * ARIA label for accessibility
   */
  'aria-label'?: string
}

const Inline = React.forwardRef<HTMLDivElement, InlineProps>(
  (
    {
      className,
      align = 'center',
      justify = 'start',
      gap = '2',
      padding,
      paddingX,
      paddingY,
      margin,
      marginX,
      marginY,
      radius,
      inline,
      wrap,
      asChild = false,
      'data-test': dataTest,
      'aria-label': ariaLabel,
      style,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div'

    // Build system prop classes
    const systemClasses: string[] = []

    // Alignment
    systemClasses.push(getAlignClass(align))
    systemClasses.push(getJustifyClass(justify))

    // Spacing
    if (gap) systemClasses.push(getSpacingClass('gap', gap))
    if (padding) systemClasses.push(getSpacingClass('p', padding))
    if (paddingX) systemClasses.push(getSpacingClass('px', paddingX))
    if (paddingY) systemClasses.push(getSpacingClass('py', paddingY))
    if (margin) systemClasses.push(getSpacingClass('m', margin))
    if (marginX) systemClasses.push(getSpacingClass('mx', marginX))
    if (marginY) systemClasses.push(getSpacingClass('my', marginY))

    // Radius
    if (radius) systemClasses.push(getRadiusClass(radius))

    return (
      <Comp
        ref={ref}
        data-slot='inline'
        data-test={dataTest}
        aria-label={ariaLabel}
        className={cn(inlineVariants({inline, wrap}), systemClasses.filter(Boolean).join(' '), className)}
        style={style}
        {...props}
      />
    )
  },
)
Inline.displayName = 'Inline'

export {Inline, inlineVariants}
