import { redirect } from 'next/navigation'

/**
 * Case Study Root Page
 *
 * Redirects to a default area code. The CaseStudyShell will handle
 * redirecting to the correct area if this one doesn't exist.
 *
 * Route: /case-study → /case-study/gf/products
 */
export default function CaseStudyPage() {
  // Redirect to products view with default area code
  // The shell will redirect to actual first area if 'gf' doesn't exist
  redirect('/case-study/gf/products')
}
