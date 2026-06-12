'use client'

import { useEffect, useState, useCallback } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Package, Plus, Search, Filter, Edit, Trash2, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RefreshButton from '@/components/RefreshButton'

interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  location: string
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  lastUpdated: string
  description?: string
}

export default function InventoryPage() {
  const [user, setUser] = useState<any>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    unit: '',
    location: '',
    description: '',
  })

  const loadData = useCallback(async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setLoading(false)
        return
      }

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (profile) {
          setUser(profile)
        
        // Fetch inventory items - use API route for admin/data_admin/physio to bypass RLS
        if (profile.role === 'admin' || profile.role === 'data_admin' || profile.role === 'physio') {
          try {
            console.log('Fetching inventory from API route for admin user...', profile.role)
            const response = await fetch('/api/admin/inventory', {
              cache: 'no-store', // Ensure fresh data
            })
            console.log('API response status:', response.status)
            if (response.ok) {
              const data = await response.json()
              console.log('Inventory items fetched:', data.items?.length || 0, 'items')
              if (data.items && data.items.length > 0) {
                console.log('Sample item:', data.items[0])
              }
              setItems(data.items || [])
            } else {
              const error = await response.json()
              console.error('Error fetching inventory:', error)
              // Show user-friendly error message
              if (error.error?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
                alert('Configuration Error: The SUPABASE_SERVICE_ROLE_KEY environment variable is not set in Vercel. Please check your deployment settings.')
              } else if (error.error) {
                console.error('API Error Details:', error)
              }
              // Fallback to direct query
              const { data: itemsData, error: queryError } = await supabase
                .from('inventory')
                .select('*')
                .order('item_name', { ascending: true })
              if (!queryError && itemsData) {
                const formattedItems: InventoryItem[] = itemsData.map((item: any) => ({
                  id: item.id,
                  name: item.item_name || item.name, // Use item_name from database
                  category: item.category || 'Equipment',
                  quantity: item.quantity || 0,
                  unit: item.unit || 'pieces',
                  location: item.location || '',
                  status: item.quantity === 0 ? 'out_of_stock' : item.quantity < 10 ? 'low_stock' : 'in_stock',
                  lastUpdated: item.updated_at || item.created_at || new Date().toISOString(),
                  description: item.description || '',
                }))
                setItems(formattedItems)
              }
            }
          } catch (error) {
            console.error('Error fetching inventory from API:', error)
            // Fallback to direct query
            const { data: itemsData, error: queryError } = await supabase
              .from('inventory')
              .select('*')
              .order('item_name', { ascending: true })
            if (!queryError && itemsData) {
              const formattedItems: InventoryItem[] = itemsData.map((item: any) => ({
                id: item.id,
                name: item.item_name || item.name, // Use item_name from database
                category: item.category || 'Equipment',
                quantity: item.quantity || 0,
                unit: item.unit || 'pieces',
                location: item.location || '',
                status: item.quantity === 0 ? 'out_of_stock' : item.quantity < 10 ? 'low_stock' : 'in_stock',
                lastUpdated: item.updated_at || item.created_at || new Date().toISOString(),
                description: item.description || '',
              }))
              setItems(formattedItems)
            }
          }
        } else {
          // For other roles, use direct query (they can only see their own data)
          const { data: itemsData, error } = await supabase
            .from('inventory')
            .select('*')
            .order('item_name', { ascending: true })

          if (error) {
            console.error('Error fetching inventory:', error)
          } else if (itemsData) {
            const formattedItems: InventoryItem[] = itemsData.map((item: any) => ({
              id: item.id,
              name: item.item_name || item.name, // Use item_name from database
              category: item.category || 'Equipment',
              quantity: item.quantity || 0,
              unit: item.unit || 'pieces',
              location: item.location || '',
              status: item.quantity === 0 ? 'out_of_stock' : item.quantity < 10 ? 'low_stock' : 'in_stock',
              lastUpdated: item.updated_at || item.created_at || new Date().toISOString(),
              description: item.description || '',
            }))
            setItems(formattedItems)
          }
        }
      }
      setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Refresh function to reload inventory data
  const refreshInventory = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      if (user.role === 'admin' || user.role === 'data_admin' || user.role === 'physio') {
        console.log('Refreshing inventory via API route...')
        const response = await fetch('/api/admin/inventory', {
          cache: 'no-store',
        })
        console.log('Refresh API response status:', response.status)
        if (response.ok) {
          const data = await response.json()
          console.log('Refreshed inventory items:', data.items?.length || 0)
          setItems(data.items || [])
        } else {
          const errorData = await response.json()
          console.error('Error from refresh API:', errorData)
          // Fallback to direct query
          const supabase = createClient()
          const { data: itemsData, error: queryError } = await supabase
            .from('inventory')
            .select('*')
            .order('item_name', { ascending: true })
          if (!queryError && itemsData) {
            const formattedItems: InventoryItem[] = itemsData.map((item: any) => ({
              id: item.id,
              name: item.item_name || item.name,
              category: item.category || 'Equipment',
              quantity: item.quantity || 0,
              unit: item.unit || 'pieces',
              location: item.location || '',
              status: item.quantity === 0 ? 'out_of_stock' : item.quantity < 10 ? 'low_stock' : 'in_stock',
              lastUpdated: item.updated_at || item.created_at || new Date().toISOString(),
              description: item.description || '',
            }))
            setItems(formattedItems)
          }
        }
      } else {
        const supabase = createClient()
        const { data: itemsData, error } = await supabase
          .from('inventory')
          .select('*')
          .order('item_name', { ascending: true })
        if (!error && itemsData) {
          const formattedItems: InventoryItem[] = itemsData.map((item: any) => ({
            id: item.id,
            name: item.item_name || item.name,
            category: item.category || 'Equipment',
            quantity: item.quantity || 0,
            unit: item.unit || 'pieces',
            location: item.location || '',
            status: item.quantity === 0 ? 'out_of_stock' : item.quantity < 10 ? 'low_stock' : 'in_stock',
            lastUpdated: item.updated_at || item.created_at || new Date().toISOString(),
            description: item.description || '',
          }))
          setItems(formattedItems)
        }
      }
    } catch (error) {
      console.error('Error refreshing inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('Please log in to add items')
        return
      }

      if (!formData.name || !formData.category) {
        alert('Please fill in required fields')
        return
      }

      const { data: newItem, error } = await supabase
        .from('inventory')
        .insert({
          item_name: formData.name,
          category: formData.category,
          quantity: parseInt(formData.quantity) || 0,
          unit: formData.unit || 'pieces',
          location: formData.location,
          description: formData.description,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      // Add to local state
      const formattedItem: InventoryItem = {
        id: newItem.id,
        name: newItem.item_name,
        category: newItem.category || '',
        quantity: newItem.quantity,
        unit: newItem.unit || 'pieces',
        location: newItem.location || '',
        status: newItem.quantity > 10 ? 'in_stock' : newItem.quantity > 0 ? 'low_stock' : 'out_of_stock',
        lastUpdated: newItem.updated_at || newItem.created_at,
        description: newItem.description || '',
      }

      // Refetch inventory items to ensure we have the latest data (especially for admin/physio users)
      if (user?.role === 'admin' || user?.role === 'data_admin' || user?.role === 'physio') {
        try {
          const response = await fetch('/api/admin/inventory')
          if (response.ok) {
            const data = await response.json()
            setItems(data.items || [])
          }
        } catch (error) {
          console.error('Error refetching inventory:', error)
          // Fallback: add to local state
          setItems([formattedItem, ...items])
        }
      } else {
      setItems([formattedItem, ...items])
      }
      setFormData({ name: '', category: '', quantity: '', unit: '', location: '', description: '' })
      setShowAddModal(false)
      alert('Item added successfully!')
    } catch (error: any) {
      console.error('Error adding item:', error)
      alert(`Error adding item: ${error.message}`)
    }
  }

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item)
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity.toString(),
      unit: item.unit,
      location: item.location,
      description: item.description || '',
    })
    setShowEditModal(true)
  }

  const handleUpdateItem = async () => {
    if (!selectedItem) return

    try {
      const supabase = createClient()

      const { data: updatedItem, error } = await supabase
        .from('inventory')
        .update({
          item_name: formData.name,
          category: formData.category,
          quantity: parseInt(formData.quantity) || 0,
          unit: formData.unit || 'pieces',
          location: formData.location,
          description: formData.description,
        })
        .eq('id', selectedItem.id)
        .select()
        .single()

      if (error) throw error

      // Update local state
      const formattedItem: InventoryItem = {
        id: updatedItem.id,
        name: updatedItem.item_name,
        category: updatedItem.category || '',
        quantity: updatedItem.quantity,
        unit: updatedItem.unit || 'pieces',
        location: updatedItem.location || '',
        status: updatedItem.quantity > 10 ? 'in_stock' : updatedItem.quantity > 0 ? 'low_stock' : 'out_of_stock',
        lastUpdated: updatedItem.updated_at || updatedItem.created_at,
        description: updatedItem.description || '',
      }

      // Refetch inventory items to ensure we have the latest data (especially for admin users)
      await refreshInventory()
      setShowEditModal(false)
      setSelectedItem(null)
      setFormData({ name: '', category: '', quantity: '', unit: '', location: '', description: '' })
      alert('Item updated successfully!')
    } catch (error: any) {
      console.error('Error updating item:', error)
      alert(`Error updating item: ${error.message}`)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemId)

      if (error) throw error

      // Refetch inventory items to ensure we have the latest data (especially for admin users)
      await refreshInventory()
      alert('Item deleted successfully!')
    } catch (error: any) {
      console.error('Error deleting item:', error)
      alert(`Error deleting item: ${error.message}`)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'bg-success/10 text-success'
      case 'low_stock':
        return 'bg-warning/10 text-warning'
      case 'out_of_stock':
        return 'bg-[#E05757]/10 text-[#E05757]'
      default:
        return 'bg-tm-surface-hover text-tm-text-3'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <CheckCircle className="w-4 h-4" />
      case 'low_stock':
        return <AlertCircle className="w-4 h-4" />
      case 'out_of_stock':
        return <XCircle className="w-4 h-4" />
      default:
        return null
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
  const inStockItems = items.filter(item => item.status === 'in_stock').length
  const lowStockItems = items.filter(item => item.status === 'low_stock').length
  const outOfStockItems = items.filter(item => item.status === 'out_of_stock').length
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-[20px] font-medium text-tm-text-1">
              {user.role === 'physio' ? 'Medical Inventory' : 'Inventory Management'}
            </h1>
            <p className="text-[13px] text-tm-text-3">
              {user.role === 'physio' 
                ? 'Track and manage medical kit supplies and equipment' 
                : 'Track and manage club equipment and supplies'}
            </p>
          </div>
          <div className="flex gap-3">
            <RefreshButton onRefresh={loadData} />
          {(user.role === 'admin' || user.role === 'data_admin') && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-tm-secondary text-tm-on-secondary px-6 py-3 rounded-[6px] font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Item
          </button>
          )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Items"
            value={totalItems}
            icon={Package}
            iconColor="bg-primary"
            iconTextColor="text-tm-on-secondary"
            description="All inventory items"
          />
          <StatCard
            title="In Stock"
            value={inStockItems}
            icon={CheckCircle}
            iconColor="bg-success"
            iconTextColor="text-white"
            description="Items with good stock"
          />
          <StatCard
            title="Low Stock"
            value={lowStockItems}
            icon={AlertCircle}
            iconColor="bg-warning"
            iconTextColor="text-white"
            description="Items needing restock"
          />
          <StatCard
            title="Out of Stock"
            value={outOfStockItems}
            icon={XCircle}
            iconColor="bg-secondary"
            iconTextColor="text-tm-on-secondary"
            description="Items unavailable"
          />
        </div>

        {/* Search and Filters */}
        <div className="bg-tm-surface rounded-card p-6 border border-tm-border shadow-soft">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tm-text-3 w-5 h-5" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tm-text-3 w-5 h-5" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-tm-surface text-tm-text-1"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tm-text-3 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-tm-surface text-tm-text-1"
              >
                <option value="all">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="bg-tm-surface rounded-card shadow-soft border border-tm-border overflow-hidden">
          <div className="px-6 py-4 border-b border-tm-border bg-tm-surface-hover">
            <h2 className="text-xl font-bold text-tm-text-1">
              Inventory Items ({filteredItems.length})
            </h2>
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
            <>
              <div className="md:hidden divide-y divide-tm-border">
                {filteredItems.map((item) => (
                  <div key={item.id} className="p-4 space-y-3">
                    <div>
                      <p className="font-semibold text-tm-text-1">{item.name}</p>
                      {item.description && (
                        <p className="text-sm text-tm-text-3">{item.description}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-full bg-tm-surface-hover text-tm-text-1">{item.category}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)}
                        {item.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-tm-text-3">
                      <div>
                        <p className="text-xs text-tm-text-3">Quantity</p>
                        <p className="font-semibold text-tm-text-1">{item.quantity} {item.unit}</p>
                      </div>
                      <div>
                        <p className="text-xs text-tm-text-3">Location</p>
                        <p className="font-semibold text-tm-text-1">{item.location || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-tm-text-3">Updated</p>
                        <p className="font-semibold text-tm-text-1">{new Date(item.lastUpdated).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(user.role === 'admin' || user.role === 'data_admin') && (
                        <>
                          <button
                            onClick={() => handleEditItem(item)}
                            className="p-2 text-info hover:bg-info/10 rounded-lg transition-colors"
                            title="Edit Item"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {user.role === 'physio' && (
                        <span className="text-sm text-tm-text-3">View Only</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                <thead className="bg-tm-surface-hover">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Last Updated</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-tm-text-1 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tm-border">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-tm-surface-hover transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-tm-text-1">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-tm-text-3">{item.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-tm-text-1">{item.category}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-tm-text-1">{item.quantity}</span>
                        <span className="text-tm-text-3 ml-1">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-tm-text-3">{item.location}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                          {item.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-tm-text-3">
                        {new Date(item.lastUpdated).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {(user.role === 'admin' || user.role === 'data_admin') && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="p-2 text-info hover:bg-info/10 rounded-lg transition-colors"
                            title="Edit Item"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-2 text-secondary hover:bg-secondary/10 rounded-lg transition-colors"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        )}
                        {user.role === 'physio' && (
                          <span className="text-sm text-tm-text-3">View Only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Add Item Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto border border-tm-border">
              <div className="p-4 sm:p-6 border-b border-tm-border">
                <h2 className="text-2xl font-bold text-tm-text-1">Add New Item</h2>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Item Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="e.g., Rugby Balls"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">Select category...</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Training">Training</option>
                    <option value="Medical">Medical</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Quantity</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Unit</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      placeholder="e.g., pieces, kits"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="e.g., Storage Room A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="Optional description..."
                  />
                </div>
              </div>
              <div className="p-6 border-t border-tm-border flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setFormData({ name: '', category: '', quantity: '', unit: '', location: '', description: '' })
                  }}
                  className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold hover:bg-tm-surface-hover transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  className="px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {showEditModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 backdrop-blur-sm">
            <div className="bg-tm-surface rounded-card shadow-large w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto border border-tm-border">
              <div className="p-4 sm:p-6 border-b border-tm-border">
                <h2 className="text-2xl font-bold text-tm-text-1">Edit Item</h2>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Item Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  >
                    <option value="">Select category...</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Training">Training</option>
                    <option value="Medical">Medical</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Quantity</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-tm-text-3 mb-2">Unit</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-tm-text-3 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-tm-border rounded-[6px] focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-tm-border flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedItem(null)
                    setFormData({ name: '', category: '', quantity: '', unit: '', location: '', description: '' })
                  }}
                  className="px-6 py-3 bg-tm-surface-hover text-tm-text-1 rounded-[6px] font-semibold hover:bg-tm-surface-hover transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateItem}
                  className="px-6 py-3 bg-tm-secondary text-tm-on-secondary rounded-[6px] font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium"
                >
                  Update Item
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

