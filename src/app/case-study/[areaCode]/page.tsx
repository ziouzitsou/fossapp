import { redirect } from 'next/navigation'

/**
 * Area Root Page
 * Redirects to products view for this area.
 *
 * Route: /case-study/gf → /case-study/gf/products
 */
export default async function AreaPage({
  params,
}: {
  params: Promise<{ areaCode: string }>
}) {
  const { areaCode } = await params
  redirect(`/case-study/${areaCode}/products`)
}
