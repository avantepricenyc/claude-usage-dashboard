import * as React from 'react'

import {cn} from '../../lib/utils'
import {Slot} from '@radix-ui/react-slot'
import {cva, type VariantProps} from 'class-variance-authority'

import {
  getAlignClass,
  getDirectionClass,
  getJustifyClass,
  getRadiusClass,
  getSpacingClass,
  type ResponsiveValue,
  type SpacingToken,
  type SystemProps,
} from '../../lib/system-props'

// Legacy spacing token type (deprecated, from old Stack API)
type LegacySpacingToken =
  | 'none'
  | 'xxs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'xxl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'
  | '7xl'
  | '8xl'
  | '9xl'
  | '10xl'
  | '11xl'

// Map legacy spacing tokens to new numeric tokens
const legacySpacingMap: Record<LegacySpacingToken, SpacingToken> = {
  none: '0',
  xxs: '0-5',
  xs: '1',
  sm: '1-5',
  md: '2',
  lg: '3',
  xl: '4',
  xxl: '5',
  '3xl': '6',
  '4xl': '8',
  '5xl': '10',
  '6xl': '12',
  '7xl': '16',
  '8xl': '20',
  '9xl': '24',
  '10xl': '32',
  '11xl': '40',
}

/**
 * Convert legacy spacing value to new spacing token
 */
function convertLegacySpacing(
  value: string | ResponsiveValue<SpacingToken> | undefined,
): ResponsiveValue<SpacingToken> | undefined {
  if (!value) return undefined

  // If it's a responsive object
  if (typeof value === 'object' && 'initial' in value) {
    const converted: {
      initial: SpacingToken
      sm?: SpacingToken
      md?: SpacingToken
      lg?: SpacingToken
      xl?: SpacingToken
      '2xl'?: SpacingToken
    } = {
      initial: legacySpacingMap[value.initial as LegacySpacingToken] || value.initial,
    }
    if (value.sm) converted.sm = legacySpacingMap[value.sm as LegacySpacingToken] || value.sm
    if (value.md) converted.md = legacySpacingMap[value.md as LegacySpacingToken] || value.md
    if (value.lg) converted.lg = legacySpacingMap[value.lg as LegacySpacingToken] || value.lg
    if (value.xl) converted.xl = legacySpacingMap[value.xl as LegacySpacingToken] || value.xl
    if (value['2xl']) converted['2xl'] = legacySpacingMap[value['2xl'] as LegacySpacingToken] || value['2xl']
    return converted
  }

  // If it's a string, check if it's a legacy token
  return (legacySpacingMap[value as LegacySpacingToken] || value) as SpacingToken
}

const stackVariants = cva('', {
  variants: {
    inline: {
      true: 'inline-flex',
      false: 'flex',
    },
    grow: {
      true: 'grow',
      false: 'grow-0',
    },
    shrink: {
      true: 'shrink',
      false: 'flex-shrink-0',
    },
  },
  defaultVariants: {
    inline: false,
    grow: false,
    shrink: false,
  },
})

export interface StackProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, keyof SystemProps>,
    SystemProps,
    VariantProps<typeof stackVariants> {
  /**
   * Render as child component using Radix Slot
   */
  asChild?: boolean

  /**
   * Flex basis
   */
  basis?: string

  /**
   * @deprecated Use `gap` instead. Will be removed in v2.0
   */
  spacing?: string | ResponsiveValue<SpacingToken>

  /**
   * @deprecated Use `margin` or `marginY` instead. Will be removed in v2.0
   */
  spaceAfter?: string | ResponsiveValue<SpacingToken>

  /**
   * Test ID for testing
   */
  'data-test'?: string

  /**
   * ARIA label for accessibility
   */
  'aria-label'?: string
}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      className,
      direction = 'column',
      align = 'start',
      justify = 'start',
      gap,
      padding,
      paddingX,
      paddingY,
      margin,
      marginX,
      marginY,
      radius,
      wrap = false,
      inline,
      grow,
      shrink,
      asChild = false,
      basis,
      // Deprecated props
      spacing,
      spaceAfter,
      'data-test': dataTest,
      'aria-label': ariaLabel,
      style,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'div'

    // Handle deprecated props - use spacing/spaceAfter if gap/margin not provided
    // Convert legacy spacing tokens to new numeric tokens
    const convertedSpacing = spacing ? convertLegacySpacing(spacing) : undefined
    const convertedSpaceAfter = spaceAfter ? convertLegacySpacing(spaceAfter) : undefined

    const effectiveGap = gap || convertedSpacing || '2' // default gap is '2'
    const effectiveMargin = margin || (convertedSpaceAfter ? {initial: '0'} : undefined)
    const effectiveMarginY = marginY || (convertedSpaceAfter ? convertedSpaceAfter : undefined)

    // Warn about deprecated props
    if (spacing !== undefined) {
      console.warn('[Stack] The "spacing" prop is deprecated and will be removed in v2.0. Use "gap" instead.')
    }
    if (spaceAfter !== undefined) {
      console.warn(
        '[Stack] The "spaceAfter" prop is deprecated and will be removed in v2.0. Use "margin" or "marginY" instead.',
      )
    }

    // Build system prop classes
    const systemClasses: string[] = []

    // Only apply flex if we have layout props
    const hasFlexProps =
      direction ||
      align ||
      justify ||
      inline !== undefined ||
      wrap !== undefined ||
      grow !== undefined ||
      shrink !== undefined ||
      basis ||
      effectiveGap

    if (hasFlexProps) {
      // Direction
      systemClasses.push(getDirectionClass(direction))

      // Alignment
      systemClasses.push(getAlignClass(align))
      systemClasses.push(getJustifyClass(justify))

      // Wrap
      if (wrap !== undefined) {
        systemClasses.push(wrap ? 'flex-wrap' : 'flex-nowrap')
      }

      // Gap
      if (effectiveGap) {
        systemClasses.push(getSpacingClass('gap', effectiveGap))
      }
    }

    // Spacing
    if (padding) systemClasses.push(getSpacingClass('p', padding))
    if (paddingX) systemClasses.push(getSpacingClass('px', paddingX))
    if (paddingY) systemClasses.push(getSpacingClass('py', paddingY))
    if (effectiveMargin) systemClasses.push(getSpacingClass('m', effectiveMargin))
    if (marginX) systemClasses.push(getSpacingClass('mx', marginX))
    if (effectiveMarginY) systemClasses.push(getSpacingClass('my', effectiveMarginY))

    // Radius
    if (radius) systemClasses.push(getRadiusClass(radius))

    const stackStyle = basis ? {flexBasis: basis, ...style} : style

    return (
      <Comp
        ref={ref}
        data-slot='stack'
        data-test={dataTest}
        aria-label={ariaLabel}
        className={cn(
          hasFlexProps ? stackVariants({inline, grow, shrink}) : '',
          systemClasses.filter(Boolean).join(' '),
          className,
        )}
        style={stackStyle}
        {...props}
      />
    )
  },
)
Stack.displayName = 'Stack'

export {Stack, stackVariants}
