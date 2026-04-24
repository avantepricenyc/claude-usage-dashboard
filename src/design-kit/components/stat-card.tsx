'use client'

import * as React from 'react'

import {Inline} from './layout/Inline'
import {Stack} from './layout/Stack'
import {Skeleton} from './skeleton'
import {Span} from './text'
import {cn} from '../lib/utils'
import {ArrowDownRight, ArrowUpRight} from 'lucide-react'

// =============================================================================
// Trend Types
// =============================================================================

export interface StatTrend {
  /** Pre-formatted comparison value (e.g., "$542", "49") */
  value: string
  /** Trend direction for icon */
  direction: 'up' | 'down' | 'neutral'
  /** Comparison period text (e.g., "vs last 7 days") */
  comparisonLabel: string
}

// =============================================================================
// Props
// =============================================================================

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label describing the metric (e.g., "Net revenue", "Tickets sold") */
  label: string
  /** Pre-formatted value string (e.g., "$1,043.19", "300 / 300") */
  value: string
  /** Optional trend/comparison data */
  trend?: StatTrend
  /** Show loading skeleton */
  loading?: boolean
}

// =============================================================================
// Component
// =============================================================================

const trendIcons = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: null,
}

/**
 * StatCard - Display a metric with label, value, and optional trend
 *
 * This is a presentation-only component that accepts pre-formatted strings.
 * Consuming apps should handle number/currency formatting with their own i18n utilities.
 *
 * @example
 * // Currency (formatted by consuming app)
 * <StatCard
 *   label="Net revenue"
 *   value="$1,043.19"
 *   trend={{ value: "$542", direction: "up", comparisonLabel: "vs last 7 days" }}
 * />
 *
 * @example
 * // Ratio
 * <StatCard
 *   label="Tickets sold"
 *   value="300 / 300"
 *   trend={{ value: "49", direction: "up", comparisonLabel: "vs last 7 days" }}
 * />
 *
 * @example
 * // Loading state
 * <StatCard label="Net revenue" value="" loading />
 */
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({className, label, value, trend, loading = false, ...props}, ref) => {
    const TrendIcon = trend ? trendIcons[trend.direction] : null

    if (loading) {
      return (
        <Stack ref={ref} data-slot='stat-card' gap='1' className={cn('min-w-[140px]', className)} {...props}>
          <Skeleton className='h-4 w-20 rounded' />
          <Skeleton className='h-4 w-28 rounded' />
          <Skeleton className='h-4 w-32 rounded' />
        </Stack>
      )
    }

    return (
      <Stack ref={ref} data-slot='stat-card' gap='2' className={cn('min-w-[140px]', className)} {...props}>
        <Span variant='text-xs' className='leading-4 text-muted-foreground'>
          {label}
        </Span>

        <Span className='text-xl font-medium text-foreground'>{value}</Span>
        {trend && (
          <Inline gap='1' align='center'>
            {TrendIcon && <TrendIcon className='stroke-icon-lg size-4 text-foreground' aria-hidden='true' />}
            <Span variant='text-xs' className='leading-4 text-foreground'>
              {trend.value}
            </Span>
            <Span variant='text-xs' className='leading-4 text-muted-foreground'>
              {trend.comparisonLabel}
            </Span>
          </Inline>
        )}
      </Stack>
    )
  },
)
StatCard.displayName = 'StatCard'

export {StatCard}
