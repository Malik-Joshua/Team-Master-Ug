'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send, Bot, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

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

    // Simulate AI response (replace with actual API call)
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateResponse(userMessage.content),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

  const generateResponse = (userInput: string): string => {
    const lowerInput = userInput.toLowerCase()

    // Simple response logic (replace with actual AI API call)
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return 'Hello! I\'m here to help you with your rugby club management. What would you like to know?'
    }
    if (lowerInput.includes('player') || lowerInput.includes('players')) {
      return 'I can help you with player management. You can view player profiles, update player information, or check player statistics. Would you like me to guide you to a specific feature?'
    }
    if (lowerInput.includes('training') || lowerInput.includes('session')) {
      return 'For training sessions, you can schedule new sessions, view upcoming sessions, or check attendance records. Would you like help with any of these?'
    }
    if (lowerInput.includes('finance') || lowerInput.includes('revenue') || lowerInput.includes('expense')) {
      return 'I can assist with financial management. You can add revenue or expenses, view financial reports, or check the monthly financial trends. What would you like to do?'
    }
    if (lowerInput.includes('inventory') || lowerInput.includes('equipment')) {
      return 'For inventory management, you can add new items, update quantities, check stock levels, or view item locations. How can I help?'
    }
    if (lowerInput.includes('match') || lowerInput.includes('game')) {
      return 'I can help with match management. You can log match statistics, view match history, or check player performance in matches. What do you need?'
    }
    if (lowerInput.includes('report') || lowerInput.includes('reports')) {
      return 'For reports, you can generate player performance reports, match statistics reports, training attendance reports, or financial summaries. Which report would you like to create?'
    }
    if (lowerInput.includes('help') || lowerInput.includes('how')) {
      return 'I can help you with:\n• Player management\n• Training sessions\n• Financial records\n• Inventory management\n• Match statistics\n• Generating reports\n\nWhat would you like assistance with?'
    }

    // Default response
    return `I understand you're asking about "${userInput}". I'm currently a demo assistant. In production, I would connect to an AI API (like OpenAI or Anthropic) to provide intelligent responses. For now, I can help guide you to the right features in the application. What specific task would you like help with?`
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating AI Assistant Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-large flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl border-2 border-white',
          isOpen ? 'bg-secondary' : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500'
        )}
        aria-label="Open AI Assistant"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <svg
            className="w-7 h-7 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Speech bubble with rounded corners and tail */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 9h8M8 13h6M12 21l-3-3H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-3l-3 3z"
            />
          </svg>
        )}
      </button>

      {/* AI Assistant Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white rounded-card shadow-large border border-neutral-light flex flex-col">
          {/* Header */}
          <div className="bg-club-gradient p-4 rounded-t-card flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">AI Assistant</h3>
                <p className="text-white/80 text-xs">Always here to help</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
              aria-label="Close AI Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-bg">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-start space-x-3',
                  message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    message.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-club-gradient text-white'
                  )}
                >
                  {message.role === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={cn(
                    'flex-1 rounded-lg p-3 max-w-[80%]',
                    message.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-white border border-neutral-light text-neutral-text'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs mt-2 opacity-70">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-club-gradient text-white flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-neutral-light rounded-lg p-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-neutral-light bg-white rounded-b-card">
            <div className="flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all text-neutral-text"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={cn(
                  'p-3 rounded-button transition-all duration-300',
                  input.trim() && !isLoading
                    ? 'bg-club-gradient text-white hover:opacity-90 shadow-soft hover:shadow-medium'
                    : 'bg-neutral-light text-neutral-medium cursor-not-allowed'
                )}
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-neutral-medium mt-2 text-center">
              Press Enter to send • AI responses are simulated
            </p>
          </div>
        </div>
      )}
    </>
  )
}

