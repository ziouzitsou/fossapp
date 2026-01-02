import { redirect } from 'next/navigation'
import { MOCK_AREAS } from './types'

/**
 * Case Study Root Page
 * Redirects to the first area's products view.
 *
 * Route: /case-study → /case-study/gf/products
 */
export default function CaseStudyPage() {
  // Get default area code (first area, lowercase)
  const defaultAreaCode = MOCK_AREAS[0]?.areaCode.toLowerCase() ?? 'gf'

  // Redirect to products view for default area
  redirect(`/case-study/${defaultAreaCode}/products`)
}
