import { Link } from '@tanstack/react-router'
import { CRM_SEGMENTS, type CrmSegmentKey } from './crm-segments'

type CrmSegmentTabsProps = {
  activeSegment: CrmSegmentKey
}

export default function CrmSegmentTabs({ activeSegment }: CrmSegmentTabsProps) {
  return (
    <nav className="mt-5 overflow-x-auto pb-1" aria-label="Segmentos CRM">
      <div className="inline-flex min-w-full gap-2">
        {CRM_SEGMENTS.map((segment) => (
          <Link
            key={segment.key}
            to={segment.route}
            className={`rounded-sm border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] no-underline transition ${
              segment.key === activeSegment
                ? 'border-primary bg-primary text-white'
                : 'border-outline-variant bg-white text-on-surface-variant hover:border-primary hover:text-primary'
            }`}
          >
            {segment.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
