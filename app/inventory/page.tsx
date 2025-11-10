'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import StatCard from '@/components/StatCard'
import { Package, Plus, Search, Filter, Edit, Trash2, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

  useEffect(() => {
    const loadData = async () => {
      // Check for dev mode
      if (typeof window !== 'undefined') {
        const devUser = localStorage.getItem('dev_user')
        if (devUser) {
          try {
            const userData = JSON.parse(devUser)
            setUser(userData)
            // Mock inventory items for dev mode
            const mockItems: InventoryItem[] = [
              {
                id: '1',
                name: 'Rugby Balls',
                category: 'Equipment',
                quantity: 25,
                unit: 'pieces',
                location: 'Storage Room A',
                status: 'in_stock',
                lastUpdated: new Date().toISOString(),
                description: 'Official match rugby balls',
              },
              {
                id: '2',
                name: 'Jerseys',
                category: 'Apparel',
                quantity: 5,
                unit: 'pieces',
                location: 'Storage Room B',
                status: 'low_stock',
                lastUpdated: new Date(Date.now() - 86400000).toISOString(),
                description: 'Team jerseys size M-XL',
              },
              {
                id: '3',
                name: 'Cones',
                category: 'Training',
                quantity: 0,
                unit: 'pieces',
                location: 'Training Ground',
                status: 'out_of_stock',
                lastUpdated: new Date(Date.now() - 172800000).toISOString(),
                description: 'Training cones for drills',
              },
              {
                id: '4',
                name: 'First Aid Kit',
                category: 'Medical',
                quantity: 3,
                unit: 'kits',
                location: 'Medical Room',
                status: 'in_stock',
                lastUpdated: new Date(Date.now() - 3600000).toISOString(),
                description: 'Complete first aid supplies',
              },
              {
                id: '5',
                name: 'Water Bottles',
                category: 'Equipment',
                quantity: 8,
                unit: 'pieces',
                location: 'Storage Room A',
                status: 'low_stock',
                lastUpdated: new Date(Date.now() - 259200000).toISOString(),
                description: 'Reusable water bottles',
              },
            ]
            setItems(mockItems)
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
          // Fetch real inventory items
        }
      }
      setLoading(false)
    }

    loadData()
  }, [])

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

      setItems([formattedItem, ...items])
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

      setItems(items.map(item => item.id === selectedItem.id ? formattedItem : item))
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

      setItems(items.filter(item => item.id !== itemId))
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
        return 'bg-secondary/10 text-secondary'
      default:
        return 'bg-neutral-light text-neutral-medium'
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
            <h1 className="text-4xl font-extrabold text-club-gradient mb-2">Inventory Management</h1>
            <p className="text-lg text-neutral-medium font-medium">Track and manage club equipment and supplies</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary-gradient text-white px-6 py-3 rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Item
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Items"
            value={totalItems}
            icon={Package}
            iconColor="bg-primary"
            description="All inventory items"
          />
          <StatCard
            title="In Stock"
            value={inStockItems}
            icon={CheckCircle}
            iconColor="bg-success"
            description="Items with good stock"
          />
          <StatCard
            title="Low Stock"
            value={lowStockItems}
            icon={AlertCircle}
            iconColor="bg-warning"
            description="Items needing restock"
          />
          <StatCard
            title="Out of Stock"
            value={outOfStockItems}
            icon={XCircle}
            iconColor="bg-secondary"
            description="Items unavailable"
          />
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-card p-6 border border-neutral-light shadow-soft">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium w-5 h-5" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium w-5 h-5" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white text-neutral-text"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-medium w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all bg-white text-neutral-text"
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
        <div className="bg-white rounded-card shadow-soft border border-neutral-light overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-light bg-neutral-light">
            <h2 className="text-xl font-bold text-neutral-text">
              Inventory Items ({filteredItems.length})
            </h2>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-neutral-light rounded-full mb-4">
                <Package className="w-10 h-10 text-neutral-medium" />
              </div>
              <p className="text-xl font-bold text-neutral-text mb-2">No items found</p>
              <p className="text-neutral-medium">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-light">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Item Name</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Last Updated</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-neutral-text uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-light">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-neutral-light transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-neutral-text">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-neutral-medium">{item.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-neutral-text">{item.category}</td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-neutral-text">{item.quantity}</span>
                        <span className="text-neutral-medium ml-1">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-neutral-medium">{item.location}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusIcon(item.status)}
                          {item.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-medium">
                        {new Date(item.lastUpdated).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Item Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <h2 className="text-2xl font-bold text-neutral-text">Add New Item</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Item Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="e.g., Rugby Balls"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
                    <label className="block text-sm font-medium text-neutral-medium mb-2">Quantity</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">Unit</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      placeholder="e.g., pieces, kits"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="e.g., Storage Room A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="Optional description..."
                  />
                </div>
              </div>
              <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setFormData({ name: '', category: '', quantity: '', unit: '', location: '', description: '' })
                  }}
                  className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button font-semibold hover:bg-neutral-medium transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  className="px-6 py-3 bg-primary-gradient text-white rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {showEditModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-card shadow-large max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <h2 className="text-2xl font-bold text-neutral-text">Edit Item</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Item Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
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
                    <label className="block text-sm font-medium text-neutral-medium mb-2">Quantity</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-2">Unit</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-neutral-light rounded-button focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-neutral-light flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedItem(null)
                    setFormData({ name: '', category: '', quantity: '', unit: '', location: '', description: '' })
                  }}
                  className="px-6 py-3 bg-neutral-light text-neutral-text rounded-button font-semibold hover:bg-neutral-medium transition-all duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateItem}
                  className="px-6 py-3 bg-primary-gradient text-white rounded-button font-semibold hover:opacity-90 transition-all duration-300 shadow-soft hover:shadow-medium"
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

