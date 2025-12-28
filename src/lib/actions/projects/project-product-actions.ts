'use server'

/**
 * Project Product Actions
 *
 * Operations for managing products within projects:
 * - Add product to project
 * - Update product quantity
 * - Remove product from project
 */

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@fossapp/core/db/server'

import type {
  AddProductToProjectInput,
  ActionResult,
} from '@fossapp/projects'

// ============================================================================
// ADD PRODUCT TO PROJECT
// ============================================================================

/**
 * Add a product to a project with default quantity of 1
 * Fetches product price from product_info and stores it
 */
export async function addProductToProjectAction(
  input: AddProductToProjectInput
): Promise<ActionResult<{ id: string }>> {
  try {
    // Validate UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(input.project_id)) {
      return { success: false, error: 'Invalid project ID format' }
    }
    if (!uuidRegex.test(input.product_id)) {
      return { success: false, error: 'Invalid product ID format' }
    }

    // Determine area_revision_id - required since products must belong to an area revision
    let areaRevisionId = input.area_revision_id

    if (!areaRevisionId) {
      // No area specified - get the first area's current revision for this project
      const { data: firstArea, error: areaError } = await supabaseServer
        .schema('projects')
        .from('project_areas')
        .select(`
          id,
          area_code,
          current_revision,
          project_area_revisions!inner (id, revision_number)
        `)
        .eq('project_id', input.project_id)
        .eq('is_active', true)
        .order('display_order')
        .order('floor_level', { nullsFirst: false })
        .limit(1)
        .single()

      if (areaError || !firstArea) {
        return {
          success: false,
          error: 'Project has no areas. Please create an area first before adding products.'
        }
      }

      // Get the current revision ID
      const revisions = firstArea.project_area_revisions as Array<{ id: string; revision_number: number }>
      const currentRevision = revisions.find(r => r.revision_number === firstArea.current_revision)

      if (!currentRevision) {
        return { success: false, error: 'Could not find current revision for area' }
      }

      areaRevisionId = currentRevision.id
    }

    // Fetch product price from product_info
    const { data: productData, error: productError } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('prices')
      .eq('product_id', input.product_id)
      .single()

    if (productError) {
      console.error('Fetch product price error:', productError)
    }

    // Extract price info from the prices array (use first/latest price entry)
    let unitPrice: number | null = null
    let discountPercent: number | null = null

    if (productData?.prices && Array.isArray(productData.prices) && productData.prices.length > 0) {
      const priceEntry = productData.prices[0] as {
        start_price?: number
        disc1?: number
        disc2?: number
        disc3?: number
      }
      unitPrice = priceEntry.start_price || null
      // Combine discounts (typically disc1 is the main discount)
      discountPercent = priceEntry.disc1 || 0
    }

    // Check if product already exists in this area revision
    const { data: existing, error: checkError } = await supabaseServer
      .schema('projects')
      .from('project_products')
      .select('id, quantity')
      .eq('project_id', input.project_id)
      .eq('product_id', input.product_id)
      .eq('area_revision_id', areaRevisionId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected if product doesn't exist
      console.error('Check existing product error:', checkError)
      return { success: false, error: 'Failed to check existing product' }
    }

    if (existing) {
      // Product already exists, increment quantity
      const newQuantity = existing.quantity + (input.quantity || 1)
      const { error: updateError } = await supabaseServer
        .schema('projects')
        .from('project_products')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (updateError) {
        console.error('Update product quantity error:', updateError)
        return { success: false, error: 'Failed to update product quantity' }
      }

      // Revalidate project page to show updated product
      revalidatePath(`/projects/${input.project_id}`)

      return { success: true, data: { id: existing.id } }
    }

    // Insert new product with price info (total_price is a generated column - calculated by DB)
    const quantity = input.quantity || 1
    const { data, error } = await supabaseServer
      .schema('projects')
      .from('project_products')
      .insert({
        project_id: input.project_id,
        product_id: input.product_id,
        area_revision_id: areaRevisionId,  // Required - links to area revision
        quantity: quantity,
        unit_price: unitPrice,
        discount_percent: discountPercent,
        // Note: total_price is a generated column, DB calculates it automatically
        room_location: input.room_location?.trim() || null,
        notes: input.notes?.trim() || null,
        status: 'specified',
      })
      .select('id')
      .single()

    if (error) {
      console.error('Add product to project error:', error)
      return { success: false, error: 'Failed to add product to project' }
    }

    // Revalidate project page to show new product
    revalidatePath(`/projects/${input.project_id}`)

    return { success: true, data: { id: data.id } }
  } catch (error) {
    console.error('Add product to project error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// UPDATE PROJECT PRODUCT QUANTITY
// ============================================================================

/**
 * Update the quantity of a product in a project
 * Note: total_price is a generated column - DB recalculates it automatically
 */
export async function updateProjectProductQuantityAction(
  projectProductId: string,
  quantity: number
): Promise<ActionResult> {
  try {
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectProductId)) {
      return { success: false, error: 'Invalid project product ID format' }
    }

    // Validate quantity
    if (quantity < 1 || !Number.isInteger(quantity)) {
      return { success: false, error: 'Quantity must be a positive integer' }
    }

    // Update quantity only - total_price is a generated column, DB recalculates automatically
    const { error } = await supabaseServer
      .schema('projects')
      .from('project_products')
      .update({
        quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectProductId)

    if (error) {
      console.error('Update project product quantity error:', error)
      return { success: false, error: 'Failed to update quantity' }
    }

    return { success: true }
  } catch (error) {
    console.error('Update project product quantity error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// ============================================================================
// REMOVE PRODUCT FROM PROJECT
// ============================================================================

/**
 * Remove a product from a project
 */
export async function removeProductFromProjectAction(
  projectProductId: string
): Promise<ActionResult> {
  try {
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(projectProductId)) {
      return { success: false, error: 'Invalid project product ID format' }
    }

    const { error } = await supabaseServer
      .schema('projects')
      .from('project_products')
      .delete()
      .eq('id', projectProductId)

    if (error) {
      console.error('Remove product from project error:', error)
      return { success: false, error: 'Failed to remove product' }
    }

    return { success: true }
  } catch (error) {
    console.error('Remove product from project error:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
