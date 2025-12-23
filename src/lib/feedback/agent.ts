/**
 * Feedback Chat AI Agent
 *
 * Claude-powered assistant with custom tools for product queries.
 * Uses OpenAI SDK via OpenRouter for centralized key management.
 */

import OpenAI from 'openai'
import { supabaseServer } from '../supabase-server'
import { calculateCost } from './pricing'
import type { ToolCall } from '@/types/feedback'

// ============================================================================
// Configuration
// ============================================================================

// Initialize OpenAI client with OpenRouter
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.FEEDBACK_CHAT_OPENROUTER_KEY || '',
  defaultHeaders: {
    'HTTP-Referer': 'https://fossapp.online',
    'X-Title': 'FOSSAPP Feedback Chat',
  },
})

const MODEL = process.env.FEEDBACK_CHAT_MODEL || 'anthropic/claude-sonnet-4'
const MAX_TOKENS = parseInt(process.env.FEEDBACK_CHAT_MAX_TOKENS || '4096')

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are **FOSSAPP Assistant**, an AI helper for the FOSSAPP lighting product database application used by lighting designers at Foss SA in Athens, Greece.

## Your Role
- Help users find lighting products in the FOSSAPP database (56,000+ products)
- Answer questions about product features, specifications, and ETIM classifications
- Explain how to use FOSSAPP features (Tiles, Playground, Symbol Generator, Planner)
- Provide guidance on product selection for lighting projects
- Collect bug reports and feature requests (acknowledge and thank the user)

## Available Tools
- **search_products**: Search products by keyword (description, family, product ID)
- **get_product_details**: Get full specifications for a specific product
- **get_suppliers**: List available suppliers in the database

## Important Guidelines
1. **Focus**: Only answer questions related to FOSSAPP, lighting products, and the database
2. **Off-topic**: For unrelated questions, politely redirect: "I'm specialized in helping with FOSSAPP and lighting products. For that question, you might want to..."
3. **Accuracy**: Never make up product data - always use the tools to get real information
4. **Honesty**: If you can't find information, say so: "I couldn't find that product. Could you check the spelling or try a different search term?"
5. **Concise**: Be helpful but brief - users are busy lighting design professionals
6. **Language**: Respond in the same language the user writes in (Greek or English)

## Database Context
- **Suppliers**: Delta Light, MOLTO LUCE, Flos, and more
- **Classification**: Products use ETIM (European Technical Information Model)
- **Key features**: Lumens, wattage, color temperature, IP rating, dimensions, mounting type
- **Product IDs**: Format like "DT102149200B" (supplier prefix + code)

## Feedback Handling
When users report bugs or request features:
1. Acknowledge the feedback
2. Summarize what you understood
3. Thank them for helping improve FOSSAPP
4. Assure them it will be reviewed by the development team`

// ============================================================================
// Tool Definitions (OpenAI format)
// ============================================================================

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description:
        'Search FOSSAPP product database by keyword. Searches product descriptions, family names, and product IDs. Returns up to 10 matching products with basic info.',
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description:
        'Get full details for a specific product including all features, specifications, and pricing. Use the product_id from search results or a FOSS PID like "DT102149200B".',
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'get_suppliers',
      description:
        'List all available suppliers in the FOSSAPP database with their product counts.',
      parameters: {
        type: 'object',
        properties: {},
      },
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

  const { data, error } = await supabaseServer
    .schema('items')
    .from('product_info')
    .select(
      'product_id, foss_pid, description_short, supplier_name, class_name, family'
    )
    .or(
      `description_short.ilike.%${sanitizedQuery}%,foss_pid.ilike.%${sanitizedQuery}%,family.ilike.%${sanitizedQuery}%`
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
// Main Agent Function
// ============================================================================

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
 * Run the feedback agent with streaming
 *
 * @param messages - Conversation history
 * @param onEvent - Callback for streaming events
 */
export async function runFeedbackAgent(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onEvent?: (event: StreamEvent) => void
): Promise<AgentResult> {
  const toolCalls: ToolCall[] = []
  let fullContent = ''
  let totalInputTokens = 0
  let totalOutputTokens = 0

  try {
    // Convert to OpenAI message format
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    // Create streaming completion
    const stream = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: openaiMessages,
      tools,
      stream: true,
    })

    let pendingToolCalls: Array<{
      id: string
      name: string
      arguments: string
    }> = []

    // Process stream events
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta

      // Handle text content
      if (delta?.content) {
        fullContent += delta.content
        onEvent?.({ type: 'text', content: delta.content })
      }

      // Handle tool calls
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.index !== undefined) {
            // Initialize or update tool call
            if (!pendingToolCalls[toolCall.index]) {
              pendingToolCalls[toolCall.index] = {
                id: toolCall.id || '',
                name: toolCall.function?.name || '',
                arguments: '',
              }
            }
            if (toolCall.id) {
              pendingToolCalls[toolCall.index].id = toolCall.id
            }
            if (toolCall.function?.name) {
              pendingToolCalls[toolCall.index].name = toolCall.function.name
            }
            if (toolCall.function?.arguments) {
              pendingToolCalls[toolCall.index].arguments +=
                toolCall.function.arguments
            }
          }
        }
      }

      // Track usage from final chunk
      if (chunk.usage) {
        totalInputTokens = chunk.usage.prompt_tokens
        totalOutputTokens = chunk.usage.completion_tokens
      }
    }

    // Execute any tool calls
    if (pendingToolCalls.length > 0) {
      const toolResults: OpenAI.ChatCompletionToolMessageParam[] = []

      for (const tc of pendingToolCalls) {
        if (!tc.name) continue

        let toolInput: Record<string, unknown> = {}
        try {
          toolInput = JSON.parse(tc.arguments || '{}')
        } catch {
          toolInput = {}
        }

        onEvent?.({
          type: 'tool_start',
          toolName: tc.name,
          toolInput,
        })

        const { result, durationMs } = await handleToolCall(tc.name, toolInput)

        toolCalls.push({
          name: tc.name,
          input: toolInput,
          output: result,
          duration_ms: durationMs,
        })

        onEvent?.({
          type: 'tool_end',
          toolName: tc.name,
          toolResult: result,
        })

        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        })
      }

      // Continue conversation with tool results
      const continuationMessages: OpenAI.ChatCompletionMessageParam[] = [
        ...openaiMessages,
        {
          role: 'assistant',
          content: fullContent || null,
          tool_calls: pendingToolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        },
        ...toolResults,
      ]

      // Get final response after tool use
      const continuationStream = await openai.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: continuationMessages,
        tools,
        stream: true,
      })

      fullContent = '' // Reset for final response

      for await (const chunk of continuationStream) {
        const delta = chunk.choices[0]?.delta

        if (delta?.content) {
          fullContent += delta.content
          onEvent?.({ type: 'text', content: delta.content })
        }

        if (chunk.usage) {
          totalInputTokens += chunk.usage.prompt_tokens
          totalOutputTokens += chunk.usage.completion_tokens
        }
      }
    }

    const cost = calculateCost(MODEL, totalInputTokens, totalOutputTokens)

    onEvent?.({
      type: 'done',
      usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      cost,
    })

    return {
      content: fullContent,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cost,
      toolCalls,
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
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentResult> {
  return runFeedbackAgent(messages)
}
