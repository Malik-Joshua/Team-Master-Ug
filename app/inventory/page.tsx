'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import {
  Package, Plus, Search, Filter, Edit, Trash2, AlertCircle, CheckCircle, XCircle,
  ArrowUpRight, ArrowDownLeft, ClipboardCheck, History, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'

interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  location: string
  description?: string
  quantityInStore: number
  quantityInUse: number
  quantitySpoilt: number
  quantityLost: number
  quantity: number // in_store + in_use, kept for anything reading the old flat total
  lowStockThreshold: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  lastUpdated: string
  lastReconciledAt: string | null
  reconciliationOverdue: boolean
}

const MANAGER_ROLES = ['admin', 'data_admin', 'finance_admin', 'coach']

export default function InventoryPage() {
  const [user, setUser] = useState<any>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Log New Stock (receive)
  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [receiveForm, setReceiveForm] = useState({
    mode: 'existing' as 'existing' | 'new',
    item_id: '',
    item_name: '',
    category: 'Equipment',
    unit: 'pieces',
    location: '',
    description: '',
    low_stock_threshold: '10',
    source: '',
    date_received: new Date().toISOString().split('T')[0],
    quantity_received: '',
    notes: '',
  })
  const [savingReceive, setSavingReceive] = useState(false)

  // Edit item details (metadata only — never quantity)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ id: '', name: '', category: '', unit: '', location: '', description: '', low_stock_threshold: '10' })
  const [savingEdit, setSavingEdit] = useState(false)

  // Quick Issue / Return-Report — one shared modal, configured per action
  const [moveModal, setMoveModal] = useState<{
    item: InventoryItem
    action: 'issue' | 'return'
    destination: 'in_store' | 'spoilt' | 'lost' // only relevant for 'return'
  } | null>(null)
  const [moveQuantity, setMoveQuantity] = useState('')
  const [moveNote, setMoveNote] = useState('')
  const [savingMove, setSavingMove] = useState(false)

  // Reconcile
  const [reconcileItem, setReconcileItem] = useState<InventoryItem | null>(null)
  const [reconcileFoundQty, setReconcileFoundQty] = useState('')
  const [reconcileShortfallQty, setReconcileShortfallQty] = useState('')
  const [reconcileShortfallDest, setReconcileShortfallDest] = useState<'spoilt' | 'lost'>('spoilt')
  const [reconcileNote, setReconcileNote] = useState('')
  const [savingReconcile, setSavingReconcile] = useState(false)

  // History
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null)
  const [historyData, setHistoryData] = useState<{ batches: any[]; transactions: any[] } | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const canManage = user && MANAGER_ROLES.includes(user.role)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { setLoading(false); return }

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', authUser.id).single()
    if (!profile) { setLoading(false); return }
    setUser(profile)

    try {
      const response = await fetch('/api/admin/inventory', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
      } else {
        const error = await response.json()
        console.error('Error fetching inventory:', error)
      }
    } catch (error) {
      console.error('Error fetching inventory from API:', error)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const resetReceiveForm = () => setReceiveForm({
    mode: 'existing', item_id: '', item_name: '', category: 'Equipment', unit: 'pieces',
    location: '', description: '', low_stock_threshold: '10', source: '',
    date_received: new Date().toISOString().split('T')[0], quantity_received: '', notes: '',
  })

  const handleReceiveSubmit = async () => {
    const qty = parseInt(receiveForm.quantity_received, 10)
    if (!qty || qty <= 0) { alert('Enter how many units were received'); return }
    if (receiveForm.mode === 'existing' && !receiveForm.item_id) { alert('Pick an item type'); return }
    if (receiveForm.mode === 'new' && !receiveForm.item_name.trim()) { alert('Enter a name for the new item type'); return }

    setSavingReceive(true)
    try {
      const payload: Record<string, any> = {
        quantity_received: qty,
        source: receiveForm.source || null,
        date_received: receiveForm.date_received,
        notes: receiveForm.notes || null,
      }
      if (receiveForm.mode === 'existing') {
        payload.item_id = receiveForm.item_id
      } else {
        payload.item_name = receiveForm.item_name.trim()
        payload.category = receiveForm.category
        payload.unit = receiveForm.unit
        payload.location = receiveForm.location
        payload.description = receiveForm.description
        payload.low_stock_threshold = parseInt(receiveForm.low_stock_threshold, 10) || 10
      }

      const res = await fetch('/api/inventory/receive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to log received stock')

      await loadData()
      setShowReceiveModal(false)
      resetReceiveForm()
      alert('Stock received and logged!')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSavingReceive(false)
    }
  }

  const openEdit = (item: InventoryItem) => {
    setEditForm({
      id: item.id, name: item.name, category: item.category, unit: item.unit,
      location: item.location, description: item.description || '', low_stock_threshold: String(item.lowStockThreshold),
    })
    setShowEditModal(true)
  }

  const handleEditSubmit = async () => {
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/inventory/${editForm.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: editForm.name, category: editForm.category, unit: editForm.unit,
          location: editForm.location, description: editForm.description,
          low_stock_threshold: parseInt(editForm.low_stock_threshold, 10) || 10,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update item')
      await loadData()
      setShowEditModal(false)
      alert('Item details updated!')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Delete this item type? This also permanently removes its batch and transaction history.')) return
    try {
      const res = await fetch(`/api/inventory/${itemId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete item')
      await loadData()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  const openMove = (item: InventoryItem, action: 'issue' | 'return') => {
    setMoveModal({ item, action, destination: 'in_store' })
    setMoveQuantity('')
    setMoveNote('')
  }

  const handleMoveSubmit = async () => {
    if (!moveModal) return
    const qty = parseInt(moveQuantity, 10)
    if (!qty || qty <= 0) { alert('Enter a quantity'); return }

    const { item, action, destination } = moveModal
    const body = action === 'issue'
      ? { item_id: item.id, from_status: 'in_store', to_status: 'in_use', quantity: qty, type: 'issue', note: moveNote || null }
      : { item_id: item.id, from_status: 'in_use', to_status: destination, quantity: qty, type: destination === 'in_store' ? 'return' : destination === 'spoilt' ? 'damage' : 'loss', note: moveNote || null }

    setSavingMove(true)
    try {
      const res = await fetch('/api/inventory/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update stock')
      await loadData()
      setMoveModal(null)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSavingMove(false)
    }
  }

  const openReconcile = (item: InventoryItem) => {
    setReconcileItem(item)
    setReconcileFoundQty('')
    setReconcileShortfallQty('')
    setReconcileShortfallDest('spoilt')
    setReconcileNote('')
  }

  const handleConfirmAccurate = async () => {
    if (!reconcileItem) return
    setSavingReconcile(true)
    try {
      const res = await fetch('/api/inventory/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: reconcileItem.id, quantity: 0, type: 'reconcile', note: 'Confirmed accurate' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to confirm reconciliation')
      await loadData()
      setReconcileItem(null)
      alert('Marked as reconciled.')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSavingReconcile(false)
    }
  }

  const handleReconcileFound = async () => {
    if (!reconcileItem) return
    const qty = parseInt(reconcileFoundQty, 10)
    if (!qty || qty <= 0) { alert('Enter how many units were found'); return }
    setSavingReconcile(true)
    try {
      const res = await fetch('/api/inventory/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: reconcileItem.id, from_status: null, to_status: 'in_store', quantity: qty, type: 'reconcile', note: reconcileNote || 'Found during reconciliation' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to log found stock')
      await loadData()
      setReconcileItem(null)
      alert('Found stock logged!')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSavingReconcile(false)
    }
  }

  const handleReconcileShortfall = async () => {
    if (!reconcileItem) return
    const qty = parseInt(reconcileShortfallQty, 10)
    if (!qty || qty <= 0) { alert('Enter how many units are missing'); return }
    setSavingReconcile(true)
    try {
      const res = await fetch('/api/inventory/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: reconcileItem.id, from_status: 'in_store', to_status: reconcileShortfallDest, quantity: qty, type: 'reconcile', note: reconcileNote || 'Shortfall found during reconciliation' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to log shortfall')
      await loadData()
      setReconcileItem(null)
      alert('Shortfall logged!')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setSavingReconcile(false)
    }
  }

  const openHistory = async (item: InventoryItem) => {
    setHistoryItem(item)
    setLoadingHistory(true)
    setHistoryData(null)
    try {
      const res = await fetch(`/api/inventory/${item.id}/history`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setHistoryData({ batches: data.batches || [], transactions: data.transactions || [] })
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock': return 'bg-success/10 text-success'
      case 'low_stock': return 'bg-warning/10 text-warning'
      case 'out_of_stock': return 'bg-[#E05757]/10 text-[#E05757]'
      default: return 'bg-tm-surface-hover text-tm-text-3'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_stock': return <CheckCircle className="w-4 h-4" />
      case 'low_stock': return <AlertCircle className="w-4 h-4" />
      case 'out_of_stock': return <XCircle className="w-4 h-4" />
      default: return null
    }
  }

  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus
    return matchesSearch && matchesCategory && matchesStatus
  })

  const totalItems = items.length
  const lowStockItems = items.filter(item => item.status === 'low_stock').length
  const outOfStockItems = items.filter(item => item.status === 'out_of_stock').length
  const overdueReconciliation = items.filter(item => item.reconciliationOverdue).length
  const categories = Array.from(new Set(items.map(item => item.category)))

  if (loading) {
    return (
      <Layout pageTitle="Inventory">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    )
  }

  if (!user) return null

  return (
    <Layout pageTitle="Inventory">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1">
              {user.role === 'physio' ? 'Medical Inventory' : 'Inventory Management'}
            </h1>
            <p className="text-[13px] text-tm-text-3">
              {user.role === 'physio'
                ? 'Track medical kit supplies and equipment'
                : 'Track stock, log usage, and keep counts accurate'}
            </p>
          </div>
          <div className="flex gap-3">
            <RefreshButton onRefresh={loadData} />
            {canManage && (
              <button
                onClick={() => setShowReceiveModal(true)}
                className="bg-tm-secondary text-tm-on-secondary px-4 py-2.5 rounded-[8px] text-[13px] font-semibold hover:opacity-90 hover:-translate-y-0.5 transition-all duration-200 shadow-soft inline-flex items-center whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Log New Stock
              </button>
            )}
          </div>
        </div>

        {/* Reconciliation overdue banner — the periodic-check safety net */}
        {(user.role === 'finance_admin' || user.role === 'admin') && overdueReconciliation > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-card p-4 flex items-start gap-3">
            <ClipboardCheck className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-tm-text-1">
                {overdueReconciliation} item{overdueReconciliation === 1 ? '' : 's'} need{overdueReconciliation === 1 ? 's' : ''} a reconciliation check
              </p>
              <p className="text-xs text-tm-text-3 mt-0.5">
                It&apos;s been over 30 days since these were last confirmed. Use &quot;Reconcile&quot; on each item below to catch unlogged loss, damage, or theft.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
          <StatCard title="Total Items" value={totalItems} icon={Package} iconColor="bg-primary" iconTextColor="text-tm-on-secondary" description="Item types tracked" />
          <StatCard title="Low Stock" value={lowStockItems} icon={AlertCircle} iconColor="bg-warning" iconTextColor="text-white" description="Below reorder threshold" />
          <StatCard title="Out of Stock" value={outOfStockItems} icon={XCircle} iconColor="bg-secondary" iconTextColor="text-tm-on-secondary" description="Nothing in store or in use" />
          <StatCard title="Needs Reconciling" value={overdueReconciliation} icon={ClipboardCheck} iconColor="bg-info" iconTextColor="text-white" description="Not checked in 30+ days" />
        </div>

        {/* Search and Filters — matches the filter bar on the Players page
            (search grows, selects sit at a fixed width beside it) rather than
            an even 3-up grid, so the two short dropdowns don't stretch to a
            third of the screen each.

            The leading icons need `pointer-events-none z-10`: a native
            <select> paints its own opaque background, so without the z-index
            the icon is covered by it (and without pointer-events-none it
            swallows clicks meant for the select). That was the bug where the
            funnel icons appeared to bleed out from behind the dropdowns. */}
        <div className="bg-tm-surface rounded-card p-4 sm:p-5 border border-tm-border shadow-soft">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tm-text-3 w-[18px] h-[18px] pointer-events-none z-10" />
              <input
                type="text" placeholder="Search items..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="tm-input pl-10"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-tm-text-3 w-[18px] h-[18px] pointer-events-none z-10" />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="tm-select pl-10 pr-8 appearance-none w-full md:w-52">
                <option value="all">All Categories</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-tm-text-3 w-[18px] h-[18px] pointer-events-none z-10" />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="tm-select pl-10 pr-8 appearance-none w-full md:w-48">
                <option value="all">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Active-filter summary — makes it obvious why the list is short
              and gives a one-click way back to the full inventory. */}
          {(searchQuery || filterCategory !== 'all' || filterStatus !== 'all') && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-tm-border pt-3">
              <span className="text-xs text-tm-text-3">
                Showing {filteredItems.length} of {items.length} items
              </span>
              <button
                onClick={() => { setSearchQuery(''); setFilterCategory('all'); setFilterStatus('all') }}
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-tm-border bg-tm-surface-hover px-2.5 py-1 text-xs font-medium text-tm-text-1 transition-colors hover:border-primary hover:text-primary"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Inventory list */}
        <div className="bg-tm-surface rounded-card shadow-soft border border-tm-border overflow-hidden">
          <div className="px-6 py-4 border-b border-tm-border bg-tm-surface-hover">
            <h2 className="text-xl font-bold text-tm-text-1">Inventory Items ({filteredItems.length})</h2>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-tm-surface-hover rounded-full mb-4">
                <Package className="w-10 h-10 text-tm-text-3" />
              </div>
              <p className="text-xl font-bold text-tm-text-1 mb-2">No items found</p>
              <p className="text-tm-text-3">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="divide-y divide-tm-border">
              {filteredItems.map((item) => (
                <div key={item.id} className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-semibold text-tm-text-1">{item.name}</p>
                        <span className="px-2 py-0.5 rounded-full bg-tm-surface-hover text-tm-text-3 text-[11px]">{item.category}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                          {item.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        {item.reconciliationOverdue && (user.role === 'finance_admin' || user.role === 'admin') && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-info/10 text-info">
                            <ClipboardCheck className="w-3 h-3" /> Reconcile due
                          </span>
                        )}
                      </div>
                      {item.description && <p className="text-xs text-tm-text-3 mb-1">{item.description}</p>}
                      <p className="text-xs text-tm-text-3">{item.location || 'No location set'}</p>
                    </div>

                    {/* Status breakdown */}
                    <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-lg font-bold text-tm-text-1">{item.quantityInStore}</p>
                        <p className="text-[10px] uppercase tracking-wide text-tm-text-3">In Store</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-tm-text-1">{item.quantityInUse}</p>
                        <p className="text-[10px] uppercase tracking-wide text-tm-text-3">In Use</p>
                      </div>
                      {item.quantitySpoilt > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-secondary">{item.quantitySpoilt}</p>
                          <p className="text-[10px] uppercase tracking-wide text-tm-text-3">Spoilt</p>
                        </div>
                      )}
                      {item.quantityLost > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-bold text-secondary">{item.quantityLost}</p>
                          <p className="text-[10px] uppercase tracking-wide text-tm-text-3">Lost</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                      {canManage && (
                        <>
                          <button onClick={() => openMove(item, 'issue')} disabled={item.quantityInStore === 0} title="Issue units" className="p-2 text-primary hover:bg-primary-subtle rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <button onClick={() => openMove(item, 'return')} disabled={item.quantityInUse === 0} title="Return / report damaged or lost" className="p-2 text-success hover:bg-success/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <ArrowDownLeft className="w-4 h-4" />
                          </button>
                          <button onClick={() => openReconcile(item)} title="Reconcile stock" className="p-2 text-info hover:bg-info/10 rounded-lg transition-colors">
                            <ClipboardCheck className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button onClick={() => openHistory(item)} title="View history" className="p-2 text-tm-text-3 hover:bg-tm-surface-hover rounded-lg transition-colors">
                        <History className="w-4 h-4" />
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => openEdit(item)} title="Edit details" className="p-2 text-tm-text-3 hover:bg-tm-surface-hover rounded-lg transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                          {(user.role === 'admin' || user.role === 'data_admin') && (
                            <button onClick={() => handleDeleteItem(item.id)} title="Delete item type" className="p-2 text-secondary hover:bg-secondary/10 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      {!canManage && user.role === 'physio' && <span className="text-xs text-tm-text-3 px-2">View Only</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Log New Stock (receive) ─────────────────────────────────── */}
        {showReceiveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto border border-tm-border">
              <div className="p-4 sm:p-6 border-b border-tm-border flex items-center justify-between">
                <h2 className="text-2xl font-bold text-tm-text-1">Log New Stock</h2>
                <button onClick={() => { setShowReceiveModal(false); resetReceiveForm() }} className="text-tm-text-3 hover:text-tm-text-1"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex gap-2 bg-tm-surface-hover p-1 rounded-lg w-fit">
                  <button onClick={() => setReceiveForm({ ...receiveForm, mode: 'existing' })} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${receiveForm.mode === 'existing' ? 'bg-primary text-tm-on-secondary' : 'text-tm-text-3'}`}>Existing item</button>
                  <button onClick={() => setReceiveForm({ ...receiveForm, mode: 'new' })} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${receiveForm.mode === 'new' ? 'bg-primary text-tm-on-secondary' : 'text-tm-text-3'}`}>New item type</button>
                </div>

                {receiveForm.mode === 'existing' ? (
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Item</label>
                    <select value={receiveForm.item_id} onChange={(e) => setReceiveForm({ ...receiveForm, item_id: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary">
                      <option value="">Select item...</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">Item Name</label>
                      <input type="text" value={receiveForm.item_name} onChange={(e) => setReceiveForm({ ...receiveForm, item_name: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" placeholder="e.g., Rugby ball, size 5" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-tm-text-3 mb-2">Category</label>
                        <select value={receiveForm.category} onChange={(e) => setReceiveForm({ ...receiveForm, category: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary">
                          <option value="Equipment">Equipment</option>
                          <option value="Apparel">Apparel</option>
                          <option value="Training">Training</option>
                          <option value="Medical">Medical</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-tm-text-3 mb-2">Unit</label>
                        <input type="text" value={receiveForm.unit} onChange={(e) => setReceiveForm({ ...receiveForm, unit: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" placeholder="e.g., pieces, kits" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-tm-text-3 mb-2">Location</label>
                        <input type="text" value={receiveForm.location} onChange={(e) => setReceiveForm({ ...receiveForm, location: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" placeholder="e.g., Storage Room A" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-tm-text-3 mb-2">Low-stock alert below</label>
                        <input type="number" min="0" value={receiveForm.low_stock_threshold} onChange={(e) => setReceiveForm({ ...receiveForm, low_stock_threshold: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-tm-text-3 mb-2">Description</label>
                      <textarea value={receiveForm.description} onChange={(e) => setReceiveForm({ ...receiveForm, description: e.target.value })} rows={2} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" placeholder="Optional" />
                    </div>
                  </>
                )}

                <div className="border-t border-tm-border pt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Quantity Received *</label>
                    <input type="number" min="1" value={receiveForm.quantity_received} onChange={(e) => setReceiveForm({ ...receiveForm, quantity_received: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" placeholder="e.g., 13" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Date Received</label>
                    <input type="date" value={receiveForm.date_received} onChange={(e) => setReceiveForm({ ...receiveForm, date_received: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Source</label>
                  <input type="text" value={receiveForm.source} onChange={(e) => setReceiveForm({ ...receiveForm, source: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" placeholder="e.g., Donation — Platinum Credit" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Notes</label>
                  <textarea value={receiveForm.notes} onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })} rows={2} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" placeholder="Optional" />
                </div>
                <p className="text-xs text-tm-text-3">All {receiveForm.quantity_received || 'N'} units will start &quot;In Store.&quot;</p>
              </div>
              <div className="p-6 border-t border-tm-border flex justify-end space-x-3">
                <button onClick={() => { setShowReceiveModal(false); resetReceiveForm() }} className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold hover:opacity-80 transition-all" disabled={savingReceive}>Cancel</button>
                <button onClick={handleReceiveSubmit} disabled={savingReceive} className="px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-all disabled:opacity-50">{savingReceive ? 'Saving...' : 'Log Stock'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit item details ───────────────────────────────────────── */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large w-full max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto border border-tm-border">
              <div className="p-4 sm:p-6 border-b border-tm-border flex items-center justify-between">
                <h2 className="text-2xl font-bold text-tm-text-1">Edit Item Details</h2>
                <button onClick={() => setShowEditModal(false)} className="text-tm-text-3 hover:text-tm-text-1"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <p className="text-xs text-tm-text-3 -mt-2">Quantity isn&apos;t edited here — use Issue / Return / Reconcile so every change stays logged.</p>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Item Name</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Category</label>
                    <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary">
                      <option value="Equipment">Equipment</option>
                      <option value="Apparel">Apparel</option>
                      <option value="Training">Training</option>
                      <option value="Medical">Medical</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Unit</label>
                    <input type="text" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Location</label>
                    <input type="text" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Low-stock alert below</label>
                    <input type="number" min="0" value={editForm.low_stock_threshold} onChange={(e) => setEditForm({ ...editForm, low_stock_threshold: e.target.value })} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Description</label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div className="p-6 border-t border-tm-border flex justify-end space-x-3">
                <button onClick={() => setShowEditModal(false)} className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold hover:opacity-80" disabled={savingEdit}>Cancel</button>
                <button onClick={handleEditSubmit} disabled={savingEdit} className="px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 disabled:opacity-50">{savingEdit ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Issue / Return quick-action modal ───────────────────────── */}
        {moveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large w-full max-w-md border border-tm-border">
              <div className="p-5 border-b border-tm-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-tm-text-1">
                  {moveModal.action === 'issue' ? `Issue ${moveModal.item.name}` : `Return / Report ${moveModal.item.name}`}
                </h3>
                <button onClick={() => setMoveModal(null)} className="text-tm-text-3 hover:text-tm-text-1"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                {moveModal.action === 'return' && (
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Where are these units going?</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { value: 'in_store', label: 'Back to Store' },
                        { value: 'spoilt', label: 'Damaged' },
                        { value: 'lost', label: 'Lost' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setMoveModal({ ...moveModal, destination: opt.value })}
                          className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-colors ${moveModal.destination === opt.value ? 'bg-primary text-tm-on-secondary border-primary' : 'border-tm-border text-tm-text-2 hover:bg-tm-surface-hover'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">
                    Quantity <span className="text-tm-text-3 font-normal">(max {moveModal.action === 'issue' ? moveModal.item.quantityInStore : moveModal.item.quantityInUse})</span>
                  </label>
                  <input
                    type="number" min="1" max={moveModal.action === 'issue' ? moveModal.item.quantityInStore : moveModal.item.quantityInUse}
                    value={moveQuantity} onChange={(e) => setMoveQuantity(e.target.value)}
                    className="w-full px-4 py-3 text-lg font-bold border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" placeholder="0" autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Note <span className="font-normal">(optional)</span></label>
                  <input type="text" value={moveNote} onChange={(e) => setMoveNote(e.target.value)} className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary" placeholder={moveModal.action === 'issue' ? 'e.g., Issued to U18 training' : 'e.g., Punctured during match'} />
                </div>
              </div>
              <div className="p-5 border-t border-tm-border flex justify-end gap-3">
                <button onClick={() => setMoveModal(null)} className="px-5 py-2.5 border border-tm-border rounded-[6px] font-semibold text-tm-text-1 hover:bg-tm-surface-hover" disabled={savingMove}>Cancel</button>
                <button onClick={handleMoveSubmit} disabled={savingMove} className="px-5 py-2.5 bg-primary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 disabled:opacity-50">{savingMove ? 'Saving...' : 'Confirm'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Reconcile modal ─────────────────────────────────────────── */}
        {reconcileItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large w-full max-w-lg max-h-[90vh] overflow-y-auto border border-tm-border">
              <div className="p-5 border-b border-tm-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-tm-text-1">Reconcile {reconcileItem.name}</h3>
                <button onClick={() => setReconcileItem(null)} className="text-tm-text-3 hover:text-tm-text-1"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-5">
                <div className="bg-tm-surface-hover rounded-lg p-4 grid grid-cols-4 gap-3 text-center">
                  <div><p className="text-lg font-bold text-tm-text-1">{reconcileItem.quantityInStore}</p><p className="text-[10px] uppercase text-tm-text-3">In Store</p></div>
                  <div><p className="text-lg font-bold text-tm-text-1">{reconcileItem.quantityInUse}</p><p className="text-[10px] uppercase text-tm-text-3">In Use</p></div>
                  <div><p className="text-lg font-bold text-secondary">{reconcileItem.quantitySpoilt}</p><p className="text-[10px] uppercase text-tm-text-3">Spoilt</p></div>
                  <div><p className="text-lg font-bold text-secondary">{reconcileItem.quantityLost}</p><p className="text-[10px] uppercase text-tm-text-3">Lost</p></div>
                </div>
                <p className="text-xs text-tm-text-3">
                  {reconcileItem.lastReconciledAt ? `Last confirmed ${new Date(reconcileItem.lastReconciledAt).toLocaleDateString()}.` : 'Never confirmed yet.'} Does this match what&apos;s physically there?
                </p>
                <button onClick={handleConfirmAccurate} disabled={savingReconcile} className="w-full px-4 py-3 bg-success/10 text-success rounded-[6px] font-semibold hover:bg-success/20 transition-colors disabled:opacity-50">
                  ✓ Yes, counts are correct
                </button>

                <div className="border-t border-tm-border pt-4">
                  <p className="text-sm font-semibold text-tm-text-1 mb-2">Found extra stock?</p>
                  <div className="flex gap-2">
                    <input type="number" min="1" value={reconcileFoundQty} onChange={(e) => setReconcileFoundQty(e.target.value)} className="flex-1 px-3 py-2 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary text-sm" placeholder="Quantity" />
                    <button onClick={handleReconcileFound} disabled={savingReconcile || !reconcileFoundQty} className="px-4 py-2 bg-primary text-tm-on-secondary rounded-[6px] font-semibold text-sm hover:opacity-90 disabled:opacity-50">Add to Store</button>
                  </div>
                </div>

                <div className="border-t border-tm-border pt-4">
                  <p className="text-sm font-semibold text-tm-text-1 mb-2">Missing from store?</p>
                  <div className="flex gap-2 mb-2">
                    <input type="number" min="1" max={reconcileItem.quantityInStore} value={reconcileShortfallQty} onChange={(e) => setReconcileShortfallQty(e.target.value)} className="flex-1 px-3 py-2 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary text-sm" placeholder="Quantity" />
                    <select value={reconcileShortfallDest} onChange={(e) => setReconcileShortfallDest(e.target.value as 'spoilt' | 'lost')} className="px-3 py-2 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary text-sm">
                      <option value="spoilt">Damaged</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>
                  <button onClick={handleReconcileShortfall} disabled={savingReconcile || !reconcileShortfallQty} className="w-full px-4 py-2 bg-secondary text-tm-on-secondary rounded-[6px] font-semibold text-sm hover:opacity-90 disabled:opacity-50">Log Shortfall</button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Note <span className="font-normal">(optional, applies to found/shortfall above)</span></label>
                  <input type="text" value={reconcileNote} onChange={(e) => setReconcileNote(e.target.value)} className="w-full px-4 py-2.5 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary text-sm" placeholder="e.g., Found in kit bag from last season" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── History modal ───────────────────────────────────────────── */}
        {historyItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-tm-border">
              <div className="p-5 border-b border-tm-border flex items-center justify-between sticky top-0 bg-tm-surface">
                <h3 className="text-lg font-bold text-tm-text-1">History — {historyItem.name}</h3>
                <button onClick={() => setHistoryItem(null)} className="text-tm-text-3 hover:text-tm-text-1"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5">
                {loadingHistory ? (
                  <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                ) : !historyData || historyData.transactions.length === 0 ? (
                  <p className="text-center text-tm-text-3 py-8">No transactions logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {historyData.transactions.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-tm-surface-hover/50 rounded-lg border border-tm-border text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold text-tm-text-1 capitalize">
                            {t.type}{t.quantity > 0 ? ` · ${t.quantity} units` : ''}
                            {t.from_status && t.to_status && ` (${t.from_status.replace('_', ' ')} → ${t.to_status.replace('_', ' ')})`}
                            {!t.from_status && t.to_status && ` (→ ${t.to_status.replace('_', ' ')})`}
                          </p>
                          {t.note && <p className="text-xs text-tm-text-3 truncate">{t.note}</p>}
                          <p className="text-xs text-tm-text-3">{t.performed_by_name} · {new Date(t.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
