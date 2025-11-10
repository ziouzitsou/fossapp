import { getProductCountAction } from '@/lib/actions'

export async function ProductCountDisplay() {
  const productCount = await getProductCountAction()

  if (productCount === null) {
    return <>Professional lighting database</>
  }

  return (
    <>
      Professional lighting database • {Math.floor(productCount / 100) * 100}+ products
    </>
  )
}
