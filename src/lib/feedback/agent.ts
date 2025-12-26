/**
 * Feedback Chat AI Agent
 *
 * Claude-powered assistant with custom tools for product queries.
 * Uses Anthropic SDK via OpenRouter's Anthropic-compatible endpoint.
 * Supports vision for screenshot/image analysis.
 *
 * Knowledge about FOSSAPP features comes from knowledge-base.ts
 * UPDATE THAT FILE when features change - the agent only knows what's documented there.
 */

import Anthropic from '@anthropic-ai/sdk'
import { supabaseServer } from '@fossapp/core/db/server'
import { calculateCost } from './pricing'
import { generateKnowledgeSummary } from './knowledge-base'
import type { ToolCall, Attachment } from '@/types/feedback'

// ============================================================================
// Configuration
// ============================================================================

// Initialize Anthropic client with OpenRouter's Anthropic skin
const anthropic = new Anthropic({
  baseURL: 'https://openrouter.ai/api',
  apiKey: process.env.FEEDBACK_CHAT_OPENROUTER_KEY || '',
  defaultHeaders: {
    'HTTP-Referer': 'https://fossapp.online',
    'X-Title': 'FOSSAPP Feedback Chat',
  },
})

const MODEL = process.env.FEEDBACK_CHAT_MODEL || 'anthropic/claude-sonnet-4'
const MAX_TOKENS = parseInt(process.env.FEEDBACK_CHAT_MAX_TOKENS || '4096')
const MAX_TOOL_ITERATIONS = 5 // Prevent infinite tool loops

// ============================================================================
// System Prompt
// ============================================================================

// Generate the knowledge base summary once at module load
const KNOWLEDGE_SUMMARY = generateKnowledgeSummary()

const SYSTEM_PROMPT = `You are **FOSSAPP Assistant**, an AI helper for the FOSSAPP lighting product database application used by lighting designers at Foss SA in Athens, Greece.

## Your Role
- Help users find lighting products in the FOSSAPP database (56,000+ products)
- Answer questions about product features, specifications, and ETIM classifications
- Explain how to use FOSSAPP features based on the Knowledge Base below
- Provide guidance on product selection for lighting projects
- Collect bug reports and feature requests (acknowledge and thank the user)
- **Analyze screenshots** when users share them to help identify UI issues

## Available Tools
- **search_products**: Search products by keyword (description, family, product ID)
- **get_product_details**: Get full specifications for a specific product
- **get_suppliers**: List available suppliers in the database

## CRITICAL Guidelines
1. **Only answer based on the Knowledge Base below** - Do NOT invent features, buttons, menus, or workflows that aren't documented
2. **If a feature isn't in the Knowledge Base**, say: "I don't have information about that specific feature. Let me note this question for the development team."
3. **Never make up UI elements** - Don't suggest right-click menus, context menus, or buttons unless they're documented
4. **Product data**: Always use the tools to get real product information - never make up product data
5. **Be honest about limitations**: If something isn't implemented yet, say so clearly
6. **Language**: Respond in the same language the user writes in (Greek or English)
7. **Screenshots**: Analyze what you see, but only explain features that are in the Knowledge Base

## Database Context
- **Suppliers**: Delta Light, MOLTO LUCE, Flos, and more
- **Classification**: Products use ETIM (European Technical Information Model)
- **Key features**: Lumens, wattage, color temperature, IP rating, dimensions, mounting type
- **Product IDs**: Format like "DT102149200B" (supplier prefix + code)

## Feedback Handling
When users report bugs or request features:
1. Acknowledge the feedback clearly
2. Summarize what you understood
3. Thank them for helping improve FOSSAPP
4. Assure them it will be reviewed by the development team
5. Do NOT promise specific timelines or implementations

${KNOWLEDGE_SUMMARY}`

// ============================================================================
// Tool Definitions (Anthropic format)
// ============================================================================

const tools: Anthropic.Tool[] = [
  {
    name: 'search_products',
    description:
      'Search FOSSAPP product database by keyword. Searches product descriptions, family names, and product IDs. Returns up to 10 matching products with basic info.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query (e.g., "downlight 3000K", "wall luminaire IP65", "DT102")',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10, max: 20)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_details',
    description:
      'Get full details for a specific product including all features, specifications, and pricing. Use the product_id from search results or a FOSS PID like "DT102149200B".',
    input_schema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'UUID of the product OR FOSS PID (e.g., "DT102149200B")',
        },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'get_suppliers',
    description:
      'List all available suppliers in the FOSSAPP database with their product counts.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
]

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleSearchProducts(input: {
  query: string
  limit?: number
}): Promise<string> {
  const limit = Math.min(input.limit || 10, 20)
  const sanitizedQuery = input.query.replace(/[<>]/g, '').substring(0, 200)

  // Search across multiple fields for better coverage:
  // - description_short: product names
  // - description_long: technical specs (CCT, lumens, etc.)
  // - class_name: ETIM categories (Downlight, Pendant, etc.)
  // - foss_pid/family: product codes
  const { data, error } = await supabaseServer
    .schema('items')
    .from('product_info')
    .select(
      'product_id, foss_pid, description_short, supplier_name, class_name, family'
    )
    .or(
      `description_short.ilike.%${sanitizedQuery}%,description_long.ilike.%${sanitizedQuery}%,class_name.ilike.%${sanitizedQuery}%,foss_pid.ilike.%${sanitizedQuery}%,family.ilike.%${sanitizedQuery}%`
    )
    .limit(limit)

  if (error) {
    return `Error searching products: ${error.message}`
  }

  if (!data || data.length === 0) {
    return `No products found matching "${input.query}". Try different keywords or check the spelling.`
  }

  const results = data
    .map(
      (p) =>
        `- **${p.foss_pid}**: ${p.description_short} (${p.supplier_name}, ${p.class_name || 'Unclassified'})`
    )
    .join('\n')

  return `Found ${data.length} products:\n${results}`
}

async function handleGetProductDetails(input: {
  product_id: string
}): Promise<string> {
  const isUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.product_id
    )

  let query = supabaseServer.schema('items').from('product_info').select('*')

  if (isUUID) {
    query = query.eq('product_id', input.product_id)
  } else {
    query = query.eq('foss_pid', input.product_id.toUpperCase())
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return `Product not found: ${input.product_id}. Please check the product ID and try again.`
  }

  // Format key features
  interface ProductFeature {
    feature_name: string
    fvalueC_desc?: string
    fvalueN?: number
    unit_abbrev?: string
    fvalueB?: boolean
  }

  const features = ((data.features as ProductFeature[]) || [])
    .filter(
      (f: ProductFeature) =>
        f.fvalueC_desc || f.fvalueN !== null || f.fvalueB !== null
    )
    .slice(0, 15)
    .map((f: ProductFeature) => {
      const value =
        f.fvalueC_desc ||
        (f.fvalueN !== null ? `${f.fvalueN}${f.unit_abbrev || ''}` : null) ||
        (f.fvalueB !== null ? (f.fvalueB ? 'Yes' : 'No') : 'N/A')
      return `  - ${f.feature_name}: ${value}`
    })
    .join('\n')

  // Format price
  interface ProductPrice {
    start_price: number
    disc1?: number
  }

  const latestPrice = (data.prices as ProductPrice[] | null)?.[0]
  const priceInfo = latestPrice
    ? `€${latestPrice.start_price}${latestPrice.disc1 ? ` (${latestPrice.disc1}% discount available)` : ''}`
    : 'Price not available'

  return `
**${data.foss_pid}** - ${data.description_short}

**Supplier:** ${data.supplier_name}
**Category:** ${data.class_name || 'Unclassified'} (${data.class || 'N/A'})
**Family:** ${data.family || 'N/A'} > ${data.subfamily || 'N/A'}

**Price:** ${priceInfo}

**Key Features:**
${features || '  No features available'}

**Description:**
${data.description_long || 'No detailed description available'}
  `.trim()
}

async function handleGetSuppliers(): Promise<string> {
  const { data, error } = await supabaseServer
    .schema('items')
    .from('supplier')
    .select('supplier_name, country, url')

  if (error) {
    return `Error fetching suppliers: ${error.message}`
  }

  if (!data || data.length === 0) {
    return 'No suppliers found in the database.'
  }

  const list = data
    .map(
      (s) =>
        `- **${s.supplier_name}** (${s.country || 'Unknown'})${s.url ? ` - ${s.url}` : ''}`
    )
    .join('\n')

  return `Available suppliers in FOSSAPP:\n${list}`
}

// ============================================================================
// Tool Router
// ============================================================================

async function handleToolCall(
  name: string,
  input: Record<string, unknown>
): Promise<{ result: string; durationMs: number }> {
  const start = Date.now()
  let result: string

  switch (name) {
    case 'search_products':
      result = await handleSearchProducts(
        input as { query: string; limit?: number }
      )
      break
    case 'get_product_details':
      result = await handleGetProductDetails(input as { product_id: string })
      break
    case 'get_suppliers':
      result = await handleGetSuppliers()
      break
    default:
      result = `Unknown tool: ${name}`
  }

  return {
    result,
    durationMs: Date.now() - start,
  }
}

// ============================================================================
// Vision Support
// ============================================================================

/**
 * Fetch an image from URL and convert to base64
 */
async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' } | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`[Vision] Failed to fetch image: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Map content type to Anthropic's expected media types
    let mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' = 'image/png'
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      mediaType = 'image/jpeg'
    } else if (contentType.includes('gif')) {
      mediaType = 'image/gif'
    } else if (contentType.includes('webp')) {
      mediaType = 'image/webp'
    }

    return { base64, mediaType }
  } catch (error) {
    console.error('[Vision] Error fetching image:', error)
    return null
  }
}

/**
 * Build content blocks for a message, including images if attachments are present
 */
async function buildMessageContent(
  text: string,
  attachments?: Attachment[]
): Promise<Anthropic.ContentBlockParam[]> {
  const content: Anthropic.ContentBlockParam[] = []

  // Add image attachments first (so Claude sees them before the text)
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      // Only process image types
      if (attachment.type === 'image' || attachment.type === 'screenshot') {
        const imageData = await fetchImageAsBase64(attachment.url)
        if (imageData) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.mediaType,
              data: imageData.base64,
            },
          })
        }
      }
      // PDFs are not supported by vision - could add text extraction later
    }
  }

  // Add text content
  if (text) {
    content.push({
      type: 'text',
      text,
    })
  }

  return content
}

// ============================================================================
// Main Agent Function
// ============================================================================

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: Attachment[]
}

export interface AgentResult {
  content: string
  inputTokens: number
  outputTokens: number
  cost: number
  toolCalls: ToolCall[]
}

export interface StreamEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'done' | 'error'
  content?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  usage?: { inputTokens: number; outputTokens: number }
  cost?: number
  error?: string
}

/**
 * Process a message stream and collect text content and tool uses
 */
async function processStream(
  stream: ReturnType<typeof anthropic.messages.stream>,
  onEvent?: (event: StreamEvent) => void
): Promise<{
  textContent: string
  pendingToolUse: Array<{ id: string; name: string; input: Record<string, unknown> }>
  inputTokens: number
  outputTokens: number
  finalMessage: Anthropic.Message
}> {
  let textContent = ''
  const pendingToolUse: Array<{
    id: string
    name: string
    input: Record<string, unknown>
  }> = []
  let currentToolUse: {
    id: string
    name: string
    inputJson: string
  } | null = null
  let inputTokens = 0
  let outputTokens = 0

  for await (const event of stream) {
    if (event.type === 'content_block_start') {
      if (event.content_block.type === 'tool_use') {
        currentToolUse = {
          id: event.content_block.id,
          name: event.content_block.name,
          inputJson: '',
        }
      }
    } else if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        textContent += event.delta.text
        onEvent?.({ type: 'text', content: event.delta.text })
      } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
        currentToolUse.inputJson += event.delta.partial_json
      }
    } else if (event.type === 'content_block_stop') {
      if (currentToolUse) {
        let parsedInput: Record<string, unknown> = {}
        try {
          parsedInput = JSON.parse(currentToolUse.inputJson || '{}')
        } catch {
          parsedInput = {}
        }
        pendingToolUse.push({
          id: currentToolUse.id,
          name: currentToolUse.name,
          input: parsedInput,
        })
        currentToolUse = null
      }
    } else if (event.type === 'message_delta') {
      if (event.usage) {
        outputTokens = event.usage.output_tokens
      }
    } else if (event.type === 'message_start') {
      if (event.message.usage) {
        inputTokens = event.message.usage.input_tokens
      }
    }
  }

  const finalMessage = await stream.finalMessage()
  inputTokens = finalMessage.usage.input_tokens
  outputTokens = finalMessage.usage.output_tokens

  return { textContent, pendingToolUse, inputTokens, outputTokens, finalMessage }
}

/**
 * Run the feedback agent with streaming
 *
 * Supports multi-turn tool use: Claude can call multiple tools in sequence
 * before providing a final text response.
 *
 * @param messages - Conversation history with optional attachments
 * @param onEvent - Callback for streaming events
 */
export async function runFeedbackAgent(
  messages: AgentMessage[],
  onEvent?: (event: StreamEvent) => void
): Promise<AgentResult> {
  const allToolCalls: ToolCall[] = []
  let finalTextContent = ''
  let totalInputTokens = 0
  let totalOutputTokens = 0

  try {
    // Convert to Anthropic message format with vision support
    const anthropicMessages: Anthropic.MessageParam[] = await Promise.all(
      messages.map(async (m) => {
        const hasImages = m.attachments?.some(
          (a) => a.type === 'image' || a.type === 'screenshot'
        )

        if (hasImages && m.role === 'user') {
          const content = await buildMessageContent(m.content, m.attachments)
          return { role: m.role, content }
        }

        return { role: m.role, content: m.content }
      })
    )

    // Mutable conversation history for the agentic loop
    let conversationMessages = [...anthropicMessages]
    let iteration = 0

    // Agentic loop: continue while Claude wants to use tools
    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++

      // Create streaming message
      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: conversationMessages,
        tools,
      })

      // Process the stream
      const { textContent, pendingToolUse, inputTokens, outputTokens, finalMessage } =
        await processStream(stream, onEvent)

      totalInputTokens += inputTokens
      totalOutputTokens += outputTokens

      // If no tool calls, we're done - this is the final response
      if (pendingToolUse.length === 0) {
        finalTextContent = textContent
        break
      }

      // Execute tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const tu of pendingToolUse) {
        onEvent?.({
          type: 'tool_start',
          toolName: tu.name,
          toolInput: tu.input,
        })

        const { result, durationMs } = await handleToolCall(tu.name, tu.input)

        allToolCalls.push({
          name: tu.name,
          input: tu.input,
          output: result,
          duration_ms: durationMs,
        })

        onEvent?.({
          type: 'tool_end',
          toolName: tu.name,
          toolResult: result,
        })

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result,
        })
      }

      // Add assistant message (with tool use) and user message (with tool results)
      // to conversation for the next iteration
      conversationMessages = [
        ...conversationMessages,
        {
          role: 'assistant',
          content: finalMessage.content,
        },
        {
          role: 'user',
          content: toolResults,
        },
      ]

      // Store any text content from this iteration (usually empty when tools are called)
      // The final text will come in the last iteration when no tools are called
      if (textContent) {
        finalTextContent = textContent
      }
    }

    // Safety check: if we hit max iterations, log a warning
    if (iteration >= MAX_TOOL_ITERATIONS) {
      console.warn(
        `[Feedback Agent] Hit max tool iterations (${MAX_TOOL_ITERATIONS}). ` +
        `Response may be incomplete. Tool calls: ${allToolCalls.length}`
      )
    }

    const cost = calculateCost(MODEL, totalInputTokens, totalOutputTokens)

    onEvent?.({
      type: 'done',
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      cost,
    })

    return {
      content: finalTextContent,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cost,
      toolCalls: allToolCalls,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('[Feedback Agent] Error:', errorMessage)

    onEvent?.({
      type: 'error',
      error: errorMessage,
    })

    throw error
  }
}

/**
 * Run the feedback agent without streaming (simpler API)
 */
export async function runFeedbackAgentSync(
  messages: AgentMessage[]
): Promise<AgentResult> {
  return runFeedbackAgent(messages)
}
