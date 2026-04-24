/**
 * System Props - Type-safe design tokens and responsive utilities
 *
 * This module provides a unified system for layout and spacing props across all
 * layout components. It maps design tokens from @posh/tokens to Tailwind classes
 * and provides responsive value support.
 *
 * Uses static class maps instead of dynamic string generation for better
 * Tailwind compatibility (no safelist required).
 */

// ============================================================================
// Inlined Token Types (from @posh/tokens)
// ============================================================================

export type SpacingToken = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '14' | '16' | '20' | '24' | '28' | '32' | '36' | '40' | '44' | '48' | '52' | '56' | '60' | '64' | '72' | '80' | '96' | '0-5' | '1-5' | '2-5' | '3-5' | 'px'

export type RadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

export type ResponsiveValue<T> =
  | T
  | {
      initial: T
      sm?: T
      md?: T
      lg?: T
      xl?: T
      '2xl'?: T
    }

// ============================================================================
// System Props Interface
// ============================================================================

/**
 * Core layout and spacing props available to all layout components
 */
export interface SystemProps {
  /**
   * Gap between children (flex gap or grid gap)
   * @example gap="4" | gap={{ initial: "2", md: "4" }}
   */
  gap?: ResponsiveValue<SpacingToken>

  /**
   * Padding inside the element
   * @example padding="4" | padding={{ initial: "2", md: "4" }}
   */
  padding?: ResponsiveValue<SpacingToken>

  /**
   * Margin outside the element
   * @example margin="4" | margin={{ initial: "2", md: "4" }}
   */
  margin?: ResponsiveValue<SpacingToken>

  /**
   * Padding on the X axis (left and right)
   */
  paddingX?: ResponsiveValue<SpacingToken>

  /**
   * Padding on the Y axis (top and bottom)
   */
  paddingY?: ResponsiveValue<SpacingToken>

  /**
   * Margin on the X axis (left and right)
   */
  marginX?: ResponsiveValue<SpacingToken>

  /**
   * Margin on the Y axis (top and bottom)
   */
  marginY?: ResponsiveValue<SpacingToken>

  /**
   * Border radius
   * @example radius="md" | radius={{ initial: "sm", md: "lg" }}
   */
  radius?: ResponsiveValue<RadiusToken>

  /**
   * Flex/Grid alignment on cross axis
   */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'

  /**
   * Flex/Grid alignment on main axis
   */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'

  /**
   * Flex direction
   */
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse'

  /**
   * Allow items to wrap
   */
  wrap?: boolean
}

// Export individual type aliases for reuse
export type AlignValue = NonNullable<SystemProps['align']>
export type JustifyValue = NonNullable<SystemProps['justify']>
export type DirectionValue = NonNullable<SystemProps['direction']>

// ============================================================================
// Static Class Maps
// ============================================================================

/**
 * Static class maps for spacing utilities.
 * Using explicit strings instead of dynamic template literals ensures
 * Tailwind can detect all classes statically (no safelist needed).
 */

const GAP_CLASSES: Record<SpacingToken, string> = {
  '0': 'gap-0',
  '0-5': 'gap-0.5',
  '1': 'gap-1',
  '1-5': 'gap-1.5',
  '2': 'gap-2',
  '2-5': 'gap-2.5',
  '3': 'gap-3',
  '3-5': 'gap-3.5',
  '4': 'gap-4',
  '5': 'gap-5',
  '6': 'gap-6',
  '7': 'gap-7',
  '8': 'gap-8',
  '9': 'gap-9',
  '10': 'gap-10',
  '11': 'gap-11',
  '12': 'gap-12',
  '14': 'gap-14',
  '16': 'gap-16',
  '20': 'gap-20',
  '24': 'gap-24',
  '28': 'gap-28',
  '32': 'gap-32',
  '36': 'gap-36',
  '40': 'gap-40',
  '44': 'gap-44',
  '48': 'gap-48',
  '52': 'gap-52',
  '56': 'gap-56',
  '60': 'gap-60',
  '64': 'gap-64',
  '72': 'gap-72',
  '80': 'gap-80',
  '96': 'gap-96',
  px: 'gap-px',
}

const P_CLASSES: Record<SpacingToken, string> = {
  '0': 'p-0',
  '0-5': 'p-0.5',
  '1': 'p-1',
  '1-5': 'p-1.5',
  '2': 'p-2',
  '2-5': 'p-2.5',
  '3': 'p-3',
  '3-5': 'p-3.5',
  '4': 'p-4',
  '5': 'p-5',
  '6': 'p-6',
  '7': 'p-7',
  '8': 'p-8',
  '9': 'p-9',
  '10': 'p-10',
  '11': 'p-11',
  '12': 'p-12',
  '14': 'p-14',
  '16': 'p-16',
  '20': 'p-20',
  '24': 'p-24',
  '28': 'p-28',
  '32': 'p-32',
  '36': 'p-36',
  '40': 'p-40',
  '44': 'p-44',
  '48': 'p-48',
  '52': 'p-52',
  '56': 'p-56',
  '60': 'p-60',
  '64': 'p-64',
  '72': 'p-72',
  '80': 'p-80',
  '96': 'p-96',
  px: 'p-px',
}

const PX_CLASSES: Record<SpacingToken, string> = {
  '0': 'px-0',
  '0-5': 'px-0.5',
  '1': 'px-1',
  '1-5': 'px-1.5',
  '2': 'px-2',
  '2-5': 'px-2.5',
  '3': 'px-3',
  '3-5': 'px-3.5',
  '4': 'px-4',
  '5': 'px-5',
  '6': 'px-6',
  '7': 'px-7',
  '8': 'px-8',
  '9': 'px-9',
  '10': 'px-10',
  '11': 'px-11',
  '12': 'px-12',
  '14': 'px-14',
  '16': 'px-16',
  '20': 'px-20',
  '24': 'px-24',
  '28': 'px-28',
  '32': 'px-32',
  '36': 'px-36',
  '40': 'px-40',
  '44': 'px-44',
  '48': 'px-48',
  '52': 'px-52',
  '56': 'px-56',
  '60': 'px-60',
  '64': 'px-64',
  '72': 'px-72',
  '80': 'px-80',
  '96': 'px-96',
  px: 'px-px',
}

const PY_CLASSES: Record<SpacingToken, string> = {
  '0': 'py-0',
  '0-5': 'py-0.5',
  '1': 'py-1',
  '1-5': 'py-1.5',
  '2': 'py-2',
  '2-5': 'py-2.5',
  '3': 'py-3',
  '3-5': 'py-3.5',
  '4': 'py-4',
  '5': 'py-5',
  '6': 'py-6',
  '7': 'py-7',
  '8': 'py-8',
  '9': 'py-9',
  '10': 'py-10',
  '11': 'py-11',
  '12': 'py-12',
  '14': 'py-14',
  '16': 'py-16',
  '20': 'py-20',
  '24': 'py-24',
  '28': 'py-28',
  '32': 'py-32',
  '36': 'py-36',
  '40': 'py-40',
  '44': 'py-44',
  '48': 'py-48',
  '52': 'py-52',
  '56': 'py-56',
  '60': 'py-60',
  '64': 'py-64',
  '72': 'py-72',
  '80': 'py-80',
  '96': 'py-96',
  px: 'py-px',
}

const M_CLASSES: Record<SpacingToken, string> = {
  '0': 'm-0',
  '0-5': 'm-0.5',
  '1': 'm-1',
  '1-5': 'm-1.5',
  '2': 'm-2',
  '2-5': 'm-2.5',
  '3': 'm-3',
  '3-5': 'm-3.5',
  '4': 'm-4',
  '5': 'm-5',
  '6': 'm-6',
  '7': 'm-7',
  '8': 'm-8',
  '9': 'm-9',
  '10': 'm-10',
  '11': 'm-11',
  '12': 'm-12',
  '14': 'm-14',
  '16': 'm-16',
  '20': 'm-20',
  '24': 'm-24',
  '28': 'm-28',
  '32': 'm-32',
  '36': 'm-36',
  '40': 'm-40',
  '44': 'm-44',
  '48': 'm-48',
  '52': 'm-52',
  '56': 'm-56',
  '60': 'm-60',
  '64': 'm-64',
  '72': 'm-72',
  '80': 'm-80',
  '96': 'm-96',
  px: 'm-px',
}

const MX_CLASSES: Record<SpacingToken, string> = {
  '0': 'mx-0',
  '0-5': 'mx-0.5',
  '1': 'mx-1',
  '1-5': 'mx-1.5',
  '2': 'mx-2',
  '2-5': 'mx-2.5',
  '3': 'mx-3',
  '3-5': 'mx-3.5',
  '4': 'mx-4',
  '5': 'mx-5',
  '6': 'mx-6',
  '7': 'mx-7',
  '8': 'mx-8',
  '9': 'mx-9',
  '10': 'mx-10',
  '11': 'mx-11',
  '12': 'mx-12',
  '14': 'mx-14',
  '16': 'mx-16',
  '20': 'mx-20',
  '24': 'mx-24',
  '28': 'mx-28',
  '32': 'mx-32',
  '36': 'mx-36',
  '40': 'mx-40',
  '44': 'mx-44',
  '48': 'mx-48',
  '52': 'mx-52',
  '56': 'mx-56',
  '60': 'mx-60',
  '64': 'mx-64',
  '72': 'mx-72',
  '80': 'mx-80',
  '96': 'mx-96',
  px: 'mx-px',
}

const MY_CLASSES: Record<SpacingToken, string> = {
  '0': 'my-0',
  '0-5': 'my-0.5',
  '1': 'my-1',
  '1-5': 'my-1.5',
  '2': 'my-2',
  '2-5': 'my-2.5',
  '3': 'my-3',
  '3-5': 'my-3.5',
  '4': 'my-4',
  '5': 'my-5',
  '6': 'my-6',
  '7': 'my-7',
  '8': 'my-8',
  '9': 'my-9',
  '10': 'my-10',
  '11': 'my-11',
  '12': 'my-12',
  '14': 'my-14',
  '16': 'my-16',
  '20': 'my-20',
  '24': 'my-24',
  '28': 'my-28',
  '32': 'my-32',
  '36': 'my-36',
  '40': 'my-40',
  '44': 'my-44',
  '48': 'my-48',
  '52': 'my-52',
  '56': 'my-56',
  '60': 'my-60',
  '64': 'my-64',
  '72': 'my-72',
  '80': 'my-80',
  '96': 'my-96',
  px: 'my-px',
}

const RADIUS_CLASSES: Record<RadiusToken, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
  full: 'rounded-full',
}

// Width classes for Box sizing
const W_CLASSES: Record<SpacingToken, string> = {
  '0': 'w-0',
  '0-5': 'w-0.5',
  '1': 'w-1',
  '1-5': 'w-1.5',
  '2': 'w-2',
  '2-5': 'w-2.5',
  '3': 'w-3',
  '3-5': 'w-3.5',
  '4': 'w-4',
  '5': 'w-5',
  '6': 'w-6',
  '7': 'w-7',
  '8': 'w-8',
  '9': 'w-9',
  '10': 'w-10',
  '11': 'w-11',
  '12': 'w-12',
  '14': 'w-14',
  '16': 'w-16',
  '20': 'w-20',
  '24': 'w-24',
  '28': 'w-28',
  '32': 'w-32',
  '36': 'w-36',
  '40': 'w-40',
  '44': 'w-44',
  '48': 'w-48',
  '52': 'w-52',
  '56': 'w-56',
  '60': 'w-60',
  '64': 'w-64',
  '72': 'w-72',
  '80': 'w-80',
  '96': 'w-96',
  px: 'w-px',
}

// Height classes for Box sizing
const H_CLASSES: Record<SpacingToken, string> = {
  '0': 'h-0',
  '0-5': 'h-0.5',
  '1': 'h-1',
  '1-5': 'h-1.5',
  '2': 'h-2',
  '2-5': 'h-2.5',
  '3': 'h-3',
  '3-5': 'h-3.5',
  '4': 'h-4',
  '5': 'h-5',
  '6': 'h-6',
  '7': 'h-7',
  '8': 'h-8',
  '9': 'h-9',
  '10': 'h-10',
  '11': 'h-11',
  '12': 'h-12',
  '14': 'h-14',
  '16': 'h-16',
  '20': 'h-20',
  '24': 'h-24',
  '28': 'h-28',
  '32': 'h-32',
  '36': 'h-36',
  '40': 'h-40',
  '44': 'h-44',
  '48': 'h-48',
  '52': 'h-52',
  '56': 'h-56',
  '60': 'h-60',
  '64': 'h-64',
  '72': 'h-72',
  '80': 'h-80',
  '96': 'h-96',
  px: 'h-px',
}

// Min-width classes
const MIN_W_CLASSES: Record<SpacingToken, string> = {
  '0': 'min-w-0',
  '0-5': 'min-w-0.5',
  '1': 'min-w-1',
  '1-5': 'min-w-1.5',
  '2': 'min-w-2',
  '2-5': 'min-w-2.5',
  '3': 'min-w-3',
  '3-5': 'min-w-3.5',
  '4': 'min-w-4',
  '5': 'min-w-5',
  '6': 'min-w-6',
  '7': 'min-w-7',
  '8': 'min-w-8',
  '9': 'min-w-9',
  '10': 'min-w-10',
  '11': 'min-w-11',
  '12': 'min-w-12',
  '14': 'min-w-14',
  '16': 'min-w-16',
  '20': 'min-w-20',
  '24': 'min-w-24',
  '28': 'min-w-28',
  '32': 'min-w-32',
  '36': 'min-w-36',
  '40': 'min-w-40',
  '44': 'min-w-44',
  '48': 'min-w-48',
  '52': 'min-w-52',
  '56': 'min-w-56',
  '60': 'min-w-60',
  '64': 'min-w-64',
  '72': 'min-w-72',
  '80': 'min-w-80',
  '96': 'min-w-96',
  px: 'min-w-px',
}

// Min-height classes
const MIN_H_CLASSES: Record<SpacingToken, string> = {
  '0': 'min-h-0',
  '0-5': 'min-h-0.5',
  '1': 'min-h-1',
  '1-5': 'min-h-1.5',
  '2': 'min-h-2',
  '2-5': 'min-h-2.5',
  '3': 'min-h-3',
  '3-5': 'min-h-3.5',
  '4': 'min-h-4',
  '5': 'min-h-5',
  '6': 'min-h-6',
  '7': 'min-h-7',
  '8': 'min-h-8',
  '9': 'min-h-9',
  '10': 'min-h-10',
  '11': 'min-h-11',
  '12': 'min-h-12',
  '14': 'min-h-14',
  '16': 'min-h-16',
  '20': 'min-h-20',
  '24': 'min-h-24',
  '28': 'min-h-28',
  '32': 'min-h-32',
  '36': 'min-h-36',
  '40': 'min-h-40',
  '44': 'min-h-44',
  '48': 'min-h-48',
  '52': 'min-h-52',
  '56': 'min-h-56',
  '60': 'min-h-60',
  '64': 'min-h-64',
  '72': 'min-h-72',
  '80': 'min-h-80',
  '96': 'min-h-96',
  px: 'min-h-px',
}

// Max-width classes
const MAX_W_CLASSES: Record<SpacingToken, string> = {
  '0': 'max-w-0',
  '0-5': 'max-w-0.5',
  '1': 'max-w-1',
  '1-5': 'max-w-1.5',
  '2': 'max-w-2',
  '2-5': 'max-w-2.5',
  '3': 'max-w-3',
  '3-5': 'max-w-3.5',
  '4': 'max-w-4',
  '5': 'max-w-5',
  '6': 'max-w-6',
  '7': 'max-w-7',
  '8': 'max-w-8',
  '9': 'max-w-9',
  '10': 'max-w-10',
  '11': 'max-w-11',
  '12': 'max-w-12',
  '14': 'max-w-14',
  '16': 'max-w-16',
  '20': 'max-w-20',
  '24': 'max-w-24',
  '28': 'max-w-28',
  '32': 'max-w-32',
  '36': 'max-w-36',
  '40': 'max-w-40',
  '44': 'max-w-44',
  '48': 'max-w-48',
  '52': 'max-w-52',
  '56': 'max-w-56',
  '60': 'max-w-60',
  '64': 'max-w-64',
  '72': 'max-w-72',
  '80': 'max-w-80',
  '96': 'max-w-96',
  px: 'max-w-px',
}

// Max-height classes
const MAX_H_CLASSES: Record<SpacingToken, string> = {
  '0': 'max-h-0',
  '0-5': 'max-h-0.5',
  '1': 'max-h-1',
  '1-5': 'max-h-1.5',
  '2': 'max-h-2',
  '2-5': 'max-h-2.5',
  '3': 'max-h-3',
  '3-5': 'max-h-3.5',
  '4': 'max-h-4',
  '5': 'max-h-5',
  '6': 'max-h-6',
  '7': 'max-h-7',
  '8': 'max-h-8',
  '9': 'max-h-9',
  '10': 'max-h-10',
  '11': 'max-h-11',
  '12': 'max-h-12',
  '14': 'max-h-14',
  '16': 'max-h-16',
  '20': 'max-h-20',
  '24': 'max-h-24',
  '28': 'max-h-28',
  '32': 'max-h-32',
  '36': 'max-h-36',
  '40': 'max-h-40',
  '44': 'max-h-44',
  '48': 'max-h-48',
  '52': 'max-h-52',
  '56': 'max-h-56',
  '60': 'max-h-60',
  '64': 'max-h-64',
  '72': 'max-h-72',
  '80': 'max-h-80',
  '96': 'max-h-96',
  px: 'max-h-px',
}

/**
 * Map of spacing class maps by prefix
 */
const SPACING_CLASS_MAPS: Record<string, Record<SpacingToken, string>> = {
  gap: GAP_CLASSES,
  p: P_CLASSES,
  px: PX_CLASSES,
  py: PY_CLASSES,
  m: M_CLASSES,
  mx: MX_CLASSES,
  my: MY_CLASSES,
  w: W_CLASSES,
  h: H_CLASSES,
  'min-w': MIN_W_CLASSES,
  'min-h': MIN_H_CLASSES,
  'max-w': MAX_W_CLASSES,
  'max-h': MAX_H_CLASSES,
}

// ============================================================================
// Responsive Class Maps (for breakpoint variants)
// ============================================================================

/**
 * Generate responsive class for a spacing token at a specific breakpoint
 */
function getResponsiveSpacingClass(prefix: string, token: SpacingToken, breakpoint: Breakpoint): string {
  const classMap = SPACING_CLASS_MAPS[prefix]
  if (!classMap) return ''
  const baseClass = classMap[token]
  if (!baseClass) return ''
  return `${breakpoint}:${baseClass}`
}

/**
 * Generate responsive class for a radius token at a specific breakpoint
 */
function getResponsiveRadiusClass(token: RadiusToken, breakpoint: Breakpoint): string {
  const baseClass = RADIUS_CLASSES[token]
  if (!baseClass) return ''
  return `${breakpoint}:${baseClass}`
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a value is a responsive object
 */
function isResponsiveValue<T>(value: ResponsiveValue<T>): value is {initial: T; [key: string]: T} {
  return typeof value === 'object' && value !== null && 'initial' in value
}

/**
 * Generate Tailwind classes for a responsive spacing property
 *
 * @param prefix - Tailwind prefix (e.g., 'gap', 'p', 'm')
 * @param value - Spacing token or responsive object
 * @returns Space-separated string of Tailwind classes
 *
 * @example
 * getSpacingClass('gap', '4') // => "gap-4"
 * getSpacingClass('gap', { initial: '2', md: '4' }) // => "gap-2 md:gap-4"
 */
export function getSpacingClass(prefix: string, value: ResponsiveValue<SpacingToken> | undefined): string {
  if (!value) return ''

  const classMap = SPACING_CLASS_MAPS[prefix]
  if (!classMap) {
    console.warn(`[system-props] Unknown spacing prefix: ${prefix}`)
    return ''
  }

  // Handle invalid/empty objects from Storybook controls
  if (typeof value === 'object' && !('initial' in value)) {
    console.warn(`[system-props] Invalid responsive value passed to ${prefix}:`, value)
    return ''
  }

  if (isResponsiveValue(value)) {
    const classes: string[] = []
    const initialClass = classMap[value.initial]
    if (initialClass) classes.push(initialClass)

    const breakpoints: Breakpoint[] = ['sm', 'md', 'lg', 'xl', '2xl']
    breakpoints.forEach(bp => {
      if (value[bp]) {
        const responsiveClass = getResponsiveSpacingClass(prefix, value[bp] as SpacingToken, bp)
        if (responsiveClass) classes.push(responsiveClass)
      }
    })

    return classes.join(' ')
  }

  // Ensure we have a string before looking up
  if (typeof value !== 'string') {
    console.warn(`[system-props] Expected string but got ${typeof value} for ${prefix}:`, value)
    return ''
  }

  return classMap[value] || ''
}

/**
 * Generate Tailwind classes for a responsive radius property
 *
 * @param value - Radius token or responsive object
 * @returns Space-separated string of Tailwind classes
 *
 * @example
 * getRadiusClass('md') // => "rounded-md"
 * getRadiusClass({ initial: 'sm', md: 'lg' }) // => "rounded-sm md:rounded-lg"
 */
export function getRadiusClass(value: ResponsiveValue<RadiusToken> | undefined): string {
  if (!value) return ''

  // Handle invalid/empty objects from Storybook controls
  if (typeof value === 'object' && !('initial' in value)) {
    console.warn('[system-props] Invalid responsive value passed to radius:', value)
    return ''
  }

  if (isResponsiveValue(value)) {
    const classes: string[] = []
    const initialClass = RADIUS_CLASSES[value.initial]
    if (initialClass) classes.push(initialClass)

    const breakpoints: Breakpoint[] = ['sm', 'md', 'lg', 'xl', '2xl']
    breakpoints.forEach(bp => {
      if (value[bp]) {
        const responsiveClass = getResponsiveRadiusClass(value[bp] as RadiusToken, bp)
        if (responsiveClass) classes.push(responsiveClass)
      }
    })

    return classes.join(' ')
  }

  // Ensure we have a valid string
  if (typeof value !== 'string') {
    console.warn(`[system-props] Expected string but got ${typeof value} for radius:`, value)
    return ''
  }

  return RADIUS_CLASSES[value] || ''
}

/**
 * Get alignment class for flex/grid
 */
export function getAlignClass(align: SystemProps['align']): string {
  if (!align) return ''

  const alignMap = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  }

  return alignMap[align]
}

/**
 * Get justify class for flex/grid
 */
export function getJustifyClass(justify: SystemProps['justify']): string {
  if (!justify) return ''

  const justifyMap = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  }

  return justifyMap[justify]
}

/**
 * Get direction class for flex
 */
export function getDirectionClass(direction: SystemProps['direction']): string {
  if (!direction) return ''

  const directionMap = {
    row: 'flex-row',
    column: 'flex-col',
    'row-reverse': 'flex-row-reverse',
    'column-reverse': 'flex-col-reverse',
  }

  return directionMap[direction]
}

/**
 * Resolve all system props to Tailwind classes
 *
 * @param props - System props object
 * @returns Object with className string and any remaining props
 */
export function resolveSystemProps(props: SystemProps): {
  className: string
  remainingProps: Record<string, unknown>
} {
  const classes: string[] = []

  // Spacing
  if (props.gap) classes.push(getSpacingClass('gap', props.gap))
  if (props.padding) classes.push(getSpacingClass('p', props.padding))
  if (props.margin) classes.push(getSpacingClass('m', props.margin))
  if (props.paddingX) classes.push(getSpacingClass('px', props.paddingX))
  if (props.paddingY) classes.push(getSpacingClass('py', props.paddingY))
  if (props.marginX) classes.push(getSpacingClass('mx', props.marginX))
  if (props.marginY) classes.push(getSpacingClass('my', props.marginY))

  // Radius
  if (props.radius) classes.push(getRadiusClass(props.radius))

  // Layout
  if (props.align) classes.push(getAlignClass(props.align))
  if (props.justify) classes.push(getJustifyClass(props.justify))
  if (props.direction) classes.push(getDirectionClass(props.direction))
  if (props.wrap !== undefined) classes.push(props.wrap ? 'flex-wrap' : 'flex-nowrap')

  // Props that shouldn't be passed to DOM
  const consumedProps: (keyof SystemProps)[] = [
    'gap',
    'padding',
    'margin',
    'paddingX',
    'paddingY',
    'marginX',
    'marginY',
    'radius',
    'align',
    'justify',
    'direction',
    'wrap',
  ]

  const remainingProps: Record<string, unknown> = {}
  Object.keys(props).forEach(key => {
    if (!consumedProps.includes(key as keyof SystemProps)) {
      remainingProps[key] = props[key as keyof SystemProps]
    }
  })

  return {
    className: classes.filter(Boolean).join(' '),
    remainingProps,
  }
}
