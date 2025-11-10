# AI Assistant Integration Guide

## Current Status
The AI Assistant is currently using **simulated responses** for demonstration purposes. To connect it to a real AI service, follow the steps below.

## Available AI Services

### Option 1: OpenAI (Recommended)
- **Service**: OpenAI GPT-4 or GPT-3.5
- **Cost**: Pay-per-use
- **Setup**: 
  1. Get API key from https://platform.openai.com/api-keys
  2. Install: `npm install ai @ai-sdk/openai`
  3. Add to `.env.local`: `OPENAI_API_KEY=your_key_here`
  4. Use the example route in `app/api/chat/route.example.ts`

### Option 2: Anthropic Claude
- **Service**: Anthropic Claude
- **Cost**: Pay-per-use
- **Setup**:
  1. Get API key from https://console.anthropic.com/
  2. Install: `npm install @ai-sdk/anthropic`
  3. Add to `.env.local`: `ANTHROPIC_API_KEY=your_key_here`

### Option 3: Google Gemini
- **Service**: Google Gemini
- **Cost**: Free tier available
- **Setup**:
  1. Get API key from https://makersuite.google.com/app/apikey
  2. Install: `npm install @ai-sdk/google`
  3. Add to `.env.local`: `GOOGLE_GENERATIVE_AI_API_KEY=your_key_here`

## Integration Steps

### Step 1: Install Dependencies
```bash
npm install ai @ai-sdk/openai
# or
npm install ai @ai-sdk/anthropic
# or
npm install ai @ai-sdk/google
```

### Step 2: Create API Route
1. Copy `app/api/chat/route.example.ts` to `app/api/chat/route.ts`
2. Update the model and API key configuration
3. Customize the system prompt for your needs

### Step 3: Update AIAssistant Component
Replace the `generateResponse()` function in `components/AIAssistant.tsx` with:

```typescript
const handleSend = async () => {
  if (!input.trim() || isLoading) return

  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: input.trim(),
    timestamp: new Date(),
  }

  setMessages((prev) => [...prev, userMessage])
  setInput('')
  setIsLoading(true)

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [...messages, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get AI response')
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let assistantContent = ''

    while (true) {
      const { done, value } = await reader!.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('0:')) {
          const data = JSON.parse(line.slice(2))
          assistantContent += data.content || ''
          
          // Update message in real-time
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1]
            if (lastMessage.role === 'assistant') {
              return [...prev.slice(0, -1), { ...lastMessage, content: assistantContent }]
            }
            return [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: assistantContent,
              timestamp: new Date(),
            }]
          })
        }
      }
    }
  } catch (error) {
    console.error('AI Error:', error)
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: 'Sorry, I encountered an error. Please try again.',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, errorMessage])
  } finally {
    setIsLoading(false)
  }
}
```

### Step 4: Environment Variables
Add to `.env.local`:
```
OPENAI_API_KEY=your_api_key_here
# or
ANTHROPIC_API_KEY=your_api_key_here
# or
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

## Features

### Current Features (Simulated)
- ✅ Floating chat button
- ✅ Chat interface
- ✅ Message history
- ✅ Basic responses for common queries
- ✅ Loading indicators

### After Integration
- ✅ Real AI-powered responses
- ✅ Context-aware conversations
- ✅ Streaming responses
- ✅ Better understanding of user queries

## Security Notes

1. **Never expose API keys** in client-side code
2. Always use API routes (server-side) for AI calls
3. Implement rate limiting to prevent abuse
4. Consider adding user authentication checks
5. Monitor API usage and costs

## Cost Considerations

- **OpenAI GPT-3.5**: ~$0.0015 per 1K tokens (cheaper)
- **OpenAI GPT-4**: ~$0.03 per 1K tokens (more capable)
- **Anthropic Claude**: ~$0.25 per 1M tokens
- **Google Gemini**: Free tier available

Start with GPT-3.5 or Gemini free tier for testing.

## Testing

1. Open any dashboard
2. Click the AI assistant button (bottom-right)
3. Type a message and press Enter
4. Verify the response appears correctly

## Troubleshooting

- **No response**: Check API key and network connection
- **CORS errors**: Ensure API route is in `app/api/` directory
- **Rate limits**: Implement request throttling
- **High costs**: Use cheaper models or implement caching

