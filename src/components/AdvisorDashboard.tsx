import type { DashboardData } from '../lib/scoring'
import RecommendationsPanel from './RecommendationsPanel'
import AdvisorPanel from './AdvisorPanel'

type Props = {
  data: DashboardData
  clientName: string | null
}

// The advisor's two-panel review of one client session: classification and
// recommendations on the left, raw scores / confidence / talking points on the
// right. Strictly advisor-facing — rendered only on #/advisor/session/:id.
export default function AdvisorDashboard({ data, clientName }: Props) {
  return (
    <div className="animate-fade-300 min-h-[100svh] w-full">
      <div className="print-report-grid mx-auto grid w-full max-w-6xl grid-cols-1 min-[900px]:grid-cols-[1.5fr_1fr]">
        {/* Left — classification + recommendations */}
        <div className="min-w-0">
          <RecommendationsPanel data={data} clientName={clientName} />
        </div>

        {/* Right — scores, confidence, talking points */}
        <aside className="min-w-0 border-t border-border bg-surface/40 min-[900px]:border-l min-[900px]:border-t-0">
          <AdvisorPanel data={data} />
        </aside>
      </div>
    </div>
  )
}
