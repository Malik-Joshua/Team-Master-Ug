'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import { MessageSquare, Send, User, Mail, Clock, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  sender_name: string
  sender_role: string
  subject: string
  message: string
  read: boolean
  created_at: string
}

export default function MessagesPage() {
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [composeData, setComposeData] = useState({
    recipient: '',
    subject: '',
    message: '',
  })

  useEffect(() => {
    const loadData = async () => {
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            // Mock messages for dev mode
            setMessages([
              {
                id: 'msg-1',
                sender_name: 'Coach John',
                sender_role: 'coach',
                subject: 'Training Schedule Update',
                message: 'Hi team, just a reminder that training on Tuesday will be at 6 PM instead of 5 PM due to pitch availability. Please confirm your attendance. Thanks!',
                read: false,
                created_at: new Date(Date.now() - 3600000).toISOString(),
              },
              {
                id: 'msg-2',
                sender_name: 'Admin Sarah',
                sender_role: 'admin',
                subject: 'Important: Kit Collection',
                message: 'Dear players, new club kits are available for collection at the clubhouse this Saturday from 10 AM to 2 PM. Please ensure you pick up your kit before the next match.',
                read: true,
                created_at: new Date(Date.now() - 86400000).toISOString(),
              },
              {
                id: 'msg-3',
                sender_name: 'Finance Admin',
                sender_role: 'finance_admin',
                subject: 'Membership Fee Reminder',
                message: 'A friendly reminder that the annual membership fees are due by the end of the month. Please make your payments to ensure uninterrupted access to club facilities.',
                read: true,
                created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
              },
            ])
            setLoading(false)
            return
          } catch (e) {
            // Fall through
          }
        }
      }

      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (authUser) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)
          // Fetch messages
          const { data: fetchedMessages } = await supabase
            .from('messages')
            .select(`
              *,
              sender:sender_id(name, role),
              recipient:recipient_id(name, role)
            `)
            .or(`sender_id.eq.${authUser.id},recipient_id.eq.${authUser.id}`)
            .order('created_at', { ascending: false })

          if (fetchedMessages) {
            const formattedMessages: Message[] = fetchedMessages.map((msg: any) => ({
              id: msg.id,
              sender_name: msg.sender.name,
              sender_role: msg.sender.role,
              subject: msg.subject,
              message: msg.message,
              read: msg.read,
              created_at: msg.created_at,
            }))
            setMessages(formattedMessages)
          }
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

  const handleSendMessage = async () => {
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        alert('Please log in to send messages')
        return
      }

      if (!composeData.subject || !composeData.message) {
        alert('Please fill in subject and message')
        return
      }

      // Determine recipient
      let recipientId: string | null = null
      let recipientRole: string | null = null

      if (composeData.recipient === 'admin') {
        recipientRole = 'admin'
      } else if (composeData.recipient === 'coach') {
        recipientRole = 'coach'
      } else {
        // If specific recipient selected, get their ID
        const { data: recipientProfile } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('role', composeData.recipient)
          .limit(1)
          .single()

        if (recipientProfile) {
          recipientId = recipientProfile.user_id
        }
      }

      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert({
          sender_id: authUser.id,
          recipient_id: recipientId,
          recipient_role: recipientRole,
          subject: composeData.subject,
          message: composeData.message,
        })
        .select(`
          *,
          sender:user_profiles!messages_sender_id_fkey(name, role)
        `)
        .single()

      if (error) throw error

      // Add to local state
      const formattedMessage: Message = {
        id: newMessage.id,
        sender_name: newMessage.sender?.name || user.name,
        sender_role: newMessage.sender?.role || user.role,
        subject: newMessage.subject || '',
        message: newMessage.message,
        read: false,
        created_at: newMessage.created_at,
      }

      setMessages([formattedMessage, ...messages])
      setComposeData({ recipient: '', subject: '', message: '' })
      setShowCompose(false)
      alert('Message sent successfully!')
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert(`Error sending message: ${error.message}`)
    }
  }

  if (loading) {
    return (
      <Layout pageTitle="Messages">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  const unreadCount = messages.filter((m) => !m.read).length

  return (
    <Layout pageTitle="Messages">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div className="mb-2">
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Messages</h1>
            <p className="text-lg text-neutral-medium font-medium">Communicate with coaches and administrators</p>
          </div>
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="bg-club-gradient text-white px-6 py-3 rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
          >
            <Send className="w-5 h-5 mr-2" />
            New Message
          </button>
        </div>

        {/* Compose Message */}
        {showCompose && (
          <div className="bg-white rounded-card shadow-soft border border-neutral-light p-6">
            <h2 className="text-xl font-semibold text-neutral-text mb-4">Compose Message</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">
                  To (Admin or Coach)
                </label>
                <select
                  value={composeData.recipient}
                  onChange={(e) => setComposeData({ ...composeData, recipient: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                >
                  <option value="">Select recipient...</option>
                  <option value="admin">Administrator</option>
                  <option value="coach">Coach</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Subject</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  placeholder="e.g., Availability Update, Injury Report"
                  className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-2">Message</label>
                <textarea
                  value={composeData.message}
                  onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                  rows={6}
                  placeholder="Type your message here..."
                  className="w-full px-4 py-2 border-2 border-neutral-light rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSendMessage}
                  className="px-6 py-3 bg-club-gradient text-white rounded-button hover:opacity-90 transition-all duration-300 font-semibold shadow-soft hover:shadow-medium"
                >
                  Send Message
                </button>
                <button
                  onClick={() => {
                    setShowCompose(false)
                    setComposeData({ recipient: '', subject: '', message: '' })
                  }}
                  className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button hover:bg-neutral-medium transition-all duration-300 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages List */}
        <div className="bg-white rounded-card shadow-soft border border-neutral-light">
          <div className="p-6 border-b border-neutral-light">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-text">Inbox</h2>
              {unreadCount > 0 && (
                <span className="bg-club-gradient text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-soft">
                  {unreadCount} unread
                </span>
              )}
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-light rounded-full mb-4">
                <MessageSquare className="w-10 h-10 text-neutral-medium" />
              </div>
              <h3 className="text-xl font-bold text-neutral-text mb-2">No Messages</h3>
              <p className="text-neutral-medium">You don&apos;t have any messages yet</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-light">
              {messages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => setSelectedMessage(message)}
                  className={`p-6 cursor-pointer hover:bg-neutral-light transition-all duration-200 ${
                    !message.read ? 'bg-blue-50/50 border-l-4 border-primary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-neutral-text">{message.sender_name}</h3>
                        <span className="text-xs font-medium text-neutral-medium bg-neutral-light px-2 py-0.5 rounded-full capitalize">
                          {message.sender_role.replace('_', ' ')}
                        </span>
                        {!message.read && (
                          <span className="bg-club-gradient text-white text-xs px-2.5 py-1 rounded-full font-semibold shadow-soft">
                            New
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-neutral-text mb-1">{message.subject}</p>
                      <p className="text-sm text-neutral-medium line-clamp-2">{message.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-medium">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(message.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Detail Modal */}
        {selectedMessage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-text mb-2">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-4 text-sm text-neutral-medium">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-1" />
                        {selectedMessage.sender_name}
                      </div>
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-1" />
                        {selectedMessage.sender_role.replace('_', ' ')}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {new Date(selectedMessage.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMessage(null)}
                    className="text-neutral-medium hover:text-neutral-text"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="prose max-w-none">
                  <p className="text-neutral-text whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>
              </div>
              <div className="p-6 border-t border-neutral-light flex justify-end">
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button hover:bg-neutral-medium transition-all duration-300 font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

