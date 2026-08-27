import { Badge } from '@/components/ui/badge'
import type {
  ComparisonQuality,
  MeasurementStatus,
  TargetStatus,
} from '@/types/hr-impact'

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'ghost'

/**
 * Monochrome by weight. "Target met" and "Not met" must be distinguishable in
 * greyscale, so the word carries the meaning and the badge weight only
 * reinforces it.
 */
const MEASUREMENT_LABELS: Record<MeasurementStatus, string> = {
  'measurement-available': 'Measurement available',
  'awaiting-measurement': 'Awaiting measurement',
  'insufficient-data': 'Impact measurement not configured',
}

const MEASUREMENT_VARIANTS: Record<MeasurementStatus, BadgeVariant> = {
  'measurement-available': 'default',
  'awaiting-measurement': 'secondary',
  'insufficient-data': 'ghost',
}

const TARGET_LABELS: Record<TargetStatus, string> = {
  met: 'Target met',
  'partially-met': 'Partially met',
  'not-met': 'Not met',
  'not-measured': 'Not measured',
}

const TARGET_VARIANTS: Record<TargetStatus, BadgeVariant> = {
  met: 'default',
  'partially-met': 'secondary',
  'not-met': 'outline',
  'not-measured': 'ghost',
}

/** Sample-size wording only. This is never a statistical confidence claim. */
const QUALITY_LABELS: Record<ComparisonQuality, string> = {
  comparable: 'Comparable',
  limited: 'Limited comparison',
  'not-comparable': 'No comparison',
}

export function MeasurementStatusBadge({ status }: { status: MeasurementStatus }) {
  return <Badge variant={MEASUREMENT_VARIANTS[status]}>{MEASUREMENT_LABELS[status]}</Badge>
}

export function TargetStatusBadge({ status }: { status: TargetStatus }) {
  return <Badge variant={TARGET_VARIANTS[status]}>{TARGET_LABELS[status]}</Badge>
}

export function ComparisonQualityBadge({ quality }: { quality: ComparisonQuality }) {
  if (quality === 'comparable') return null
  return (
    <Badge variant="ghost" className="text-muted-foreground">
      {QUALITY_LABELS[quality]}
    </Badge>
  )
}
