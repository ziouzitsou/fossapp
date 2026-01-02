import { CaseStudyShell } from './case-study-shell'

/**
 * Case Study Layout (Server Component)
 *
 * This is a thin server component wrapper. The actual client-side
 * interactive content is in CaseStudyShell to avoid hydration mismatches
 * with Radix UI components.
 */
export default function CaseStudyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <CaseStudyShell>{children}</CaseStudyShell>
}
