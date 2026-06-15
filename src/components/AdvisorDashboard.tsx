import type { DashboardData } from '../lib/scoring'
import ClientPanel from './ClientPanel'
import AdvisorPanel from './AdvisorPanel'

type Props = {
  data: DashboardData
  onRetake: () => void
}

export default function AdvisorDashboard({ data, onRetake }: Props) {
  return (
    <div className="animate-fade-300 min-h-[100svh] w-full">
      <div className="print-report-grid mx-auto grid w-full max-w-6xl grid-cols-1 min-[900px]:grid-cols-[1.5fr_1fr]">
        {/* Left — client-facing */}
        <div className="min-w-0">
          <ClientPanel data={data} onRetake={onRetake} />
        </div>

        {/* Right — advisor-only, separated */}
        <aside className="min-w-0 border-t border-border bg-surface/40 min-[900px]:border-l min-[900px]:border-t-0">
          <AdvisorPanel data={data} />
        </aside>
      </div>
    </div>
  )
}
