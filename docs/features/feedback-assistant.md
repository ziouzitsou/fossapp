# Feedback Assistant

AI-powered chat assistant for FOSSAPP users to ask questions, report bugs, and request features.

## Overview

The feedback assistant is a Claude-powered chatbot accessible from the sidebar. It helps users with:
- Finding products in the database
- Understanding FOSSAPP features
- Reporting bugs and issues
- Requesting new features

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Frontend: FeedbackChatPanel                             │
│ src/components/feedback/feedback-chat-panel.tsx         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ API: /api/feedback/chat                                 │
│ src/app/api/feedback/chat/route.ts                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Agent: runFeedbackAgent()                               │
│ src/lib/feedback/agent.ts                               │
│                                                         │
│ Uses:                                                   │
│ - knowledge-base.ts (FOSSAPP feature knowledge)         │
│ - pricing.ts (cost calculation)                         │
│ - Tools: search_products, get_product_details, etc.     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ LLM: Claude via OpenRouter                              │
│ Model: anthropic/claude-sonnet-4                        │
└─────────────────────────────────────────────────────────┘
```

## Knowledge Base

**IMPORTANT**: The assistant only knows what's documented in the knowledge base.

### Location
```
src/lib/feedback/knowledge-base.ts
```

### When to Update

**Update the knowledge base whenever you:**
- Add a new feature to FOSSAPP
- Change how an existing feature works
- Add new statuses, options, or workflows
- Fix a bug that changes user-facing behavior
- Remove or deprecate a feature

### Structure

```typescript
export const FOSSAPP_KNOWLEDGE: KnowledgeBase = {
  appName: 'FOSSAPP',
  lastUpdated: '2025-12-23',  // Update this date!

  features: {
    featureName: {
      name: 'Feature Display Name',
      description: 'What the feature does',
      capabilities: ['What users can do'],
      limitations: ['What users cannot do'],
      howTo: {
        'action': 'Step-by-step instructions',
      },
      statuses: {
        'status_value': 'What this status means',
      },
    },
  },

  commonQuestions: {
    'question keyword': 'Quick answer',
  },
}
```

### Example: Adding a New Feature

When you add a new "Reports" feature:

```typescript
// In knowledge-base.ts, add to features:
reports: {
  name: 'Reports',
  description: 'Generate project reports and analytics',
  capabilities: [
    'Generate PDF project summaries',
    'Export product lists to Excel',
    'View cost breakdowns',
  ],
  limitations: [
    'Reports are read-only',
    'Maximum 1000 products per report',
  ],
  howTo: {
    'generateReport': 'Open a project, click "Reports" tab, select report type, click "Generate".',
    'exportExcel': 'In Reports tab, click "Export to Excel" button.',
  },
},
```

### Example: Adding New Statuses

When you add new product statuses to projects:

```typescript
// In knowledge-base.ts, update projectProducts.statuses:
statuses: {
  'specified': 'Product has been specified for the project',
  'ordered': 'Product has been ordered from supplier',      // NEW
  'delivered': 'Product has been delivered to site',        // NEW
  'installed': 'Product has been installed',                // NEW
},
```

## Chat Persistence

The feedback chat persists across page navigation:

1. **localStorage** stores `fossapp_feedback_chat_id`
2. On panel open, checks localStorage for existing chat
3. If found, loads chat history from database
4. Chat survives page refresh and navigation
5. Cleared on "Submit" or "New Chat"

## Database Schema

Tables in `feedback` schema:

- `feedback.chats` - Chat sessions
- `feedback.chat_messages` - Individual messages

See migrations for full schema.

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/feedback/chat` | POST | Send message, get AI response (SSE) |
| `/api/feedback/chat` | GET | List chats or get chat messages |
| `/api/feedback/chat/status` | POST | Update chat status (resolve, archive) |
| `/api/feedback/upload` | POST | Upload attachments (screenshots, files) |

## Environment Variables

```bash
FEEDBACK_CHAT_OPENROUTER_KEY=sk-or-...  # OpenRouter API key
FEEDBACK_CHAT_MODEL=anthropic/claude-sonnet-4  # Optional, default shown
FEEDBACK_CHAT_MAX_TOKENS=4096  # Optional, default shown
```

## Cost Tracking

- Costs are calculated per message using `pricing.ts`
- Displayed in EUR (converted from USD)
- Stored per message and aggregated per chat
- Session cost shown in panel header

## Development Checklist

When modifying the feedback assistant:

- [ ] Update `knowledge-base.ts` if features changed
- [ ] Update `lastUpdated` date in knowledge base
- [ ] Test that agent gives accurate answers
- [ ] Check that agent doesn't hallucinate features
- [ ] Verify chat persistence works across navigation
