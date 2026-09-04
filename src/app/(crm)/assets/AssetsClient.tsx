'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  Laptop,
  Smartphone,
  CreditCard,
  Car,
  Key,
  Monitor,
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  History,
  Edit2,
  Trash2,
  Download,
  Share2,
  Check,
  X,
  Info,
  ShieldCheck,
  Phone,
  FileText,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import type { CompanyAsset, Profile, AssetStatus, AssetCondition, AssetAssignmentLog } from '@/types/database'
import {
  createAsset,
  updateAsset,
  assignAsset,
  returnAsset,
  deleteAsset,
  getAssetLogs,
  type CreateAssetInput,
} from './actions'
import ConfirmModal from '@/components/ConfirmModal'

interface AssetsClientProps {
  currentProfile: Profile
  initialAssets: CompanyAsset[]
  teamMembers: Profile[]
}

const CATEGORIES = [
  'Laptop',
  'Mobile Phone',
  'SIM Card',
  'Vehicle',
  'Office Key / Access Card',
  'Tablet',
  'Monitor / Display',
  'Printer / Scanner',
  'Audio / Video Gear',
  'Furniture',
  'Other',
]

const CARRIERS = ['STC', 'Mobily', 'Zain', 'Salam', 'Red Bull Mobile', 'Virgin Mobile', 'Other']

export default function AssetsClient({
  currentProfile,
  initialAssets,
  teamMembers,
}: AssetsClientProps) {
  const [assets, setAssets] = useState<CompanyAsset[]>(initialAssets)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('ALL')

  // Pagination
  const PAGE_SIZE = 20
  const [currentPage, setCurrentPage] = useState(1)

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<CompanyAsset | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Loading & Submitting
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Asset Logs
  const [assetLogs, setAssetLogs] = useState<AssetAssignmentLog[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  // Form states
  const [formData, setFormData] = useState<Partial<CreateAssetInput>>({
    name: '',
    category: 'Laptop',
    model_number: '',
    serial_number: '',
    sim_number: '',
    sim_carrier: '',
    condition: 'GOOD',
    status: 'AVAILABLE',
    assigned_to: '',
    assignment_notes: '',
    purchase_date: '',
    purchase_cost: undefined,
    warranty_expiry: '',
    notes: '',
  })

  const [assignForm, setAssignForm] = useState({
    assigned_to: '',
    assignment_notes: '',
    condition: 'GOOD' as AssetCondition,
  })

  const [returnForm, setReturnForm] = useState({
    notes: '',
    condition: 'GOOD' as AssetCondition,
    targetStatus: 'AVAILABLE' as AssetStatus,
  })

  const isAdmin = currentProfile.role === 'ADMIN'
  const isManager = currentProfile.role === 'SALES_MANAGER'
  const canManage = isAdmin || isManager

  // Toast feedback helper
  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg)
      setTimeout(() => setErrorMsg(null), 5000)
    } else {
      setSuccessMsg(msg)
      setTimeout(() => setSuccessMsg(null), 4000)
    }
  }

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesCategory = selectedCategory === 'ALL' || asset.category === selectedCategory
      const matchesStatus = selectedStatus === 'ALL' || asset.status === selectedStatus
      const matchesAssignee =
        selectedAssignee === 'ALL' ||
        (selectedAssignee === 'UNASSIGNED' && !asset.assigned_to) ||
        asset.assigned_to === selectedAssignee

      if (!matchesCategory || !matchesStatus || !matchesAssignee) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()

      const matchName = asset.name?.toLowerCase().includes(q)
      const matchTag = asset.asset_tag?.toLowerCase().includes(q)
      const matchModel = asset.model_number?.toLowerCase().includes(q)
      const matchSerial = asset.serial_number?.toLowerCase().includes(q)
      const matchSim = asset.sim_number?.toLowerCase().includes(q)
      const matchAssignee = asset.possessor?.name?.toLowerCase().includes(q)
      const matchNotes = asset.notes?.toLowerCase().includes(q)

      return matchName || matchTag || matchModel || matchSerial || matchSim || matchAssignee || matchNotes
    })
  }, [assets, selectedCategory, selectedStatus, selectedAssignee, searchQuery])

  // Reset to page 1 whenever filters or search change
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE))
  const pagedAssets = filteredAssets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // KPIs
  const stats = useMemo(() => {
    const total = assets.length
    const assigned = assets.filter((a) => a.status === 'ASSIGNED').length
    const available = assets.filter((a) => a.status === 'AVAILABLE').length
    const maintenance = assets.filter((a) => a.status === 'MAINTENANCE').length
    const totalValue = assets.reduce((sum, a) => sum + (Number(a.purchase_cost) || 0), 0)

    return { total, assigned, available, maintenance, totalValue }
  }, [assets])

  // Helper for Category Icon
  const getCategoryIcon = (category: string) => {
    const cat = category.toLowerCase()
    if (cat.includes('laptop') || cat.includes('computer')) return <Laptop size={16} />
    if (cat.includes('phone') || cat.includes('mobile')) return <Smartphone size={16} />
    if (cat.includes('sim')) return <CreditCard size={16} />
    if (cat.includes('vehicle') || cat.includes('car')) return <Car size={16} />
    if (cat.includes('key') || cat.includes('access')) return <Key size={16} />
    if (cat.includes('monitor') || cat.includes('display')) return <Monitor size={16} />
    return <Package size={16} />
  }

  // Helper for Status Badge
  const renderStatusBadge = (status: AssetStatus) => {
    switch (status) {
      case 'ASSIGNED':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#2563EB', border: '1px solid rgba(59, 130, 246, 0.25)', fontWeight: 600 }}>
            <UserCheck size={12} style={{ marginRight: '4px' }} /> In Use
          </span>
        )
      case 'AVAILABLE':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)', fontWeight: 600 }}>
            <CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Available
          </span>
        )
      case 'MAINTENANCE':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#D97706', border: '1px solid rgba(245, 158, 11, 0.25)', fontWeight: 600 }}>
            <Wrench size={12} style={{ marginRight: '4px' }} /> Repair / Maintenance
          </span>
        )
      case 'LOST':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#DC2626', border: '1px solid rgba(239, 68, 68, 0.25)', fontWeight: 600 }}>
            <AlertTriangle size={12} style={{ marginRight: '4px' }} /> Lost / Damaged
          </span>
        )
      case 'RETIRED':
        return (
          <span className="badge" style={{ backgroundColor: 'rgba(107, 114, 128, 0.12)', color: '#6B7280', border: '1px solid rgba(107, 114, 128, 0.25)', fontWeight: 600 }}>
            <XCircle size={12} style={{ marginRight: '4px' }} /> Retired
          </span>
        )
      default:
        return <span className="badge">{status}</span>
    }
  }

  // Open Create Modal
  const handleOpenCreate = () => {
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({
      asset_tag: `AST-${rand}`,
      name: '',
      category: 'Laptop',
      model_number: '',
      serial_number: '',
      sim_number: '',
      sim_carrier: '',
      condition: 'NEW',
      status: 'AVAILABLE',
      assigned_to: '',
      assignment_notes: '',
      purchase_date: '',
      purchase_cost: undefined,
      warranty_expiry: '',
      notes: '',
    })
    setIsCreateModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (asset: CompanyAsset) => {
    setSelectedAsset(asset)
    setFormData({
      asset_tag: asset.asset_tag,
      name: asset.name,
      category: asset.category,
      model_number: asset.model_number || '',
      serial_number: asset.serial_number || '',
      sim_number: asset.sim_number || '',
      sim_carrier: asset.sim_carrier || '',
      condition: asset.condition,
      status: asset.status,
      assigned_to: asset.assigned_to || '',
      assignment_notes: asset.assignment_notes || '',
      purchase_date: asset.purchase_date || '',
      purchase_cost: asset.purchase_cost ?? undefined,
      warranty_expiry: asset.warranty_expiry || '',
      notes: asset.notes || '',
    })
    setIsEditModalOpen(true)
  }

  // Open Assign Modal
  const handleOpenAssign = (asset: CompanyAsset) => {
    setSelectedAsset(asset)
    setAssignForm({
      assigned_to: '',
      assignment_notes: '',
      condition: asset.condition || 'GOOD',
    })
    setIsAssignModalOpen(true)
  }

  // Open Return Modal
  const handleOpenReturn = (asset: CompanyAsset) => {
    setSelectedAsset(asset)
    setReturnForm({
      notes: '',
      condition: asset.condition || 'GOOD',
      targetStatus: 'AVAILABLE',
    })
    setIsReturnModalOpen(true)
  }

  // Open History Log Modal
  const handleOpenHistory = async (asset: CompanyAsset) => {
    setSelectedAsset(asset)
    setIsHistoryModalOpen(true)
    setIsLoadingLogs(true)
    const res = await getAssetLogs(asset.id)
    if (res.success) {
      setAssetLogs(res.logs)
    } else {
      showToast('Could not load asset logs', true)
    }
    setIsLoadingLogs(false)
  }

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      showToast('Asset name is required', true)
      return
    }

    setIsSubmitting(true)
    const res = await createAsset(formData as CreateAssetInput)
    setIsSubmitting(false)

    if (res.success && res.asset) {
      // Find possessor profile if assigned
      let possessor = null
      if (res.asset.assigned_to) {
        possessor = teamMembers.find((m) => m.id === res.asset.assigned_to) || null
      }
      const newAssetWithRelations: CompanyAsset = {
        ...res.asset,
        possessor: possessor,
        creator: currentProfile,
      }
      setAssets((prev) => [newAssetWithRelations, ...prev])
      setIsCreateModalOpen(false)
      showToast('Company asset registered successfully!')
    } else {
      showToast(res.error || 'Failed to create asset', true)
    }
  }

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAsset) return

    setIsSubmitting(true)
    const res = await updateAsset({
      id: selectedAsset.id,
      ...formData,
    })
    setIsSubmitting(false)

    if (res.success && res.asset) {
      let possessor = null
      if (res.asset.assigned_to) {
        possessor = teamMembers.find((m) => m.id === res.asset.assigned_to) || null
      }
      const updatedWithRelations: CompanyAsset = {
        ...res.asset,
        possessor: possessor,
        creator: selectedAsset.creator,
      }
      setAssets((prev) => prev.map((a) => (a.id === selectedAsset.id ? updatedWithRelations : a)))
      setIsEditModalOpen(false)
      showToast('Asset information updated!')
    } else {
      showToast(res.error || 'Failed to update asset', true)
    }
  }

  // Submit Assign
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAsset || !assignForm.assigned_to) {
      showToast('Please select a team member', true)
      return
    }

    setIsSubmitting(true)
    const res = await assignAsset(
      selectedAsset.id,
      assignForm.assigned_to,
      assignForm.assignment_notes,
      assignForm.condition
    )
    setIsSubmitting(false)

    if (res.success && res.asset) {
      const possessor = teamMembers.find((m) => m.id === assignForm.assigned_to) || null
      setAssets((prev) =>
        prev.map((a) =>
          a.id === selectedAsset.id
            ? { ...res.asset, possessor, creator: selectedAsset.creator }
            : a
        )
      )
      setIsAssignModalOpen(false)
      showToast(`Asset assigned to ${possessor?.name || 'team member'}!`)
    } else {
      showToast(res.error || 'Failed to assign asset', true)
    }
  }

  // Submit Return
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAsset) return

    setIsSubmitting(true)
    const res = await returnAsset(
      selectedAsset.id,
      returnForm.notes,
      returnForm.condition,
      returnForm.targetStatus
    )
    setIsSubmitting(false)

    if (res.success && res.asset) {
      setAssets((prev) =>
        prev.map((a) =>
          a.id === selectedAsset.id
            ? { ...res.asset, possessor: null, creator: selectedAsset.creator }
            : a
        )
      )
      setIsReturnModalOpen(false)
      showToast('Asset returned back to inventory!')
    } else {
      showToast(res.error || 'Failed to return asset', true)
    }
  }

  // Submit Delete
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    setIsSubmitting(true)
    const res = await deleteAsset(deleteConfirmId)
    setIsSubmitting(false)

    if (res.success) {
      setAssets((prev) => prev.filter((a) => a.id !== deleteConfirmId))
      setDeleteConfirmId(null)
      showToast('Asset deleted from registry')
    } else {
      showToast(res.error || 'Failed to delete asset', true)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Asset Tag',
      'Name',
      'Category',
      'Model',
      'Serial Number',
      'SIM Number',
      'Carrier',
      'Status',
      'Condition',
      'Possessor Name',
      'Possessor Email',
      'Assigned Date',
      'Purchase Date',
      'Purchase Cost (SAR)',
      'Warranty Expiry',
      'Notes',
    ]

    const rows = filteredAssets.map((a) => [
      `"${a.asset_tag || ''}"`,
      `"${a.name || ''}"`,
      `"${a.category || ''}"`,
      `"${a.model_number || ''}"`,
      `"${a.serial_number || ''}"`,
      `"${a.sim_number || ''}"`,
      `"${a.sim_carrier || ''}"`,
      `"${a.status || ''}"`,
      `"${a.condition || ''}"`,
      `"${a.possessor?.name || 'Unassigned'}"`,
      `"${a.possessor?.email || ''}"`,
      `"${a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : ''}"`,
      `"${a.purchase_date || ''}"`,
      `"${a.purchase_cost || 0}"`,
      `"${a.warranty_expiry || ''}"`,
      `"${(a.notes || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `asaheeb_assets_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Toast Notifications */}
      {successMsg && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '14px',
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '14px',
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(217, 119, 6, 0.12)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Laptop size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Company Assets & Equipment
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
                Track and manage company laptops, mobile devices, SIM cards, serials, and staff possession.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={handleExportCSV}
            className="btn btn-outline"
            style={{ fontSize: '13px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          {canManage && (
            <button
              onClick={handleOpenCreate}
              className="btn btn-primary"
              style={{ fontSize: '13px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Register Asset</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="rg-4 asset-kpi-grid" style={{ marginBottom: '28px' }}>
        <div
          className="card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: '#6366F1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              {isAdmin || isManager ? 'Total Assets' : 'My Assets'}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3B82F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              In Possession
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
              {stats.assigned}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Available in Stock
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
              {stats.available}
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid var(--border)',
            borderRadius: '12px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wrench size={22} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
              Under Maintenance
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
              {stats.maintenance}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div
            className="card"
            style={{
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              border: '1px solid var(--border)',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Valuation
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                SAR {stats.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters & Search Toolbar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '240px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="text"
            className="input"
            placeholder="Search by Item, Model, Serial, SIM #, or Possessor..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
            style={{ paddingLeft: '38px', width: '100%', fontSize: '13px' }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setCurrentPage(1) }}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Category:</span>
            <select
              className="input"
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1) }}
              style={{ fontSize: '13px', padding: '6px 12px', width: 'auto' }}
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Status:</span>
            <select
              className="input"
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1) }}
              style={{ fontSize: '13px', padding: '6px 12px', width: 'auto' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">In Use (Assigned)</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="LOST">Lost / Damaged</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>

          {/* Assignee Filter (Only for Admins/Managers) */}
          {canManage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Possessor:</span>
              <select
                className="input"
                value={selectedAssignee}
                onChange={(e) => { setSelectedAssignee(e.target.value); setCurrentPage(1) }}
                style={{ fontSize: '13px', padding: '6px 12px', maxWidth: '170px' }}
              >
                <option value="ALL">All Staff</option>
                <option value="UNASSIGNED">Unassigned (In Stock)</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Asset Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div className="table-responsive-wrapper" style={{ overflowX: 'auto', width: '100%', minHeight: '180px' }}>
          <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-sunken)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: '22%', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Asset Tag & Item
                </th>
                <th style={{ width: '18%', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Model & Specs
                </th>
                <th style={{ width: '18%', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Serial / SIM Number
                </th>
                <th style={{ width: '18%', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Possessor / Assigned To
                </th>
                <th style={{ width: '10%', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ width: '7%', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Condition
                </th>
                <th style={{ width: '7%', padding: '14px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Package size={40} style={{ color: 'var(--text-tertiary)' }} />
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>No Assets Found</div>
                      <div style={{ fontSize: '13px', maxWidth: '420px', color: 'var(--text-secondary)' }}>
                        {searchQuery || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || selectedAssignee !== 'ALL'
                          ? 'No assets match the selected filters or search keywords. Try adjusting your filter options.'
                          : canManage
                          ? 'No company assets registered yet. Click "Register Asset" to add company hardware, SIM cards, or equipment.'
                          : 'You currently have no company assets assigned to you.'}
                      </div>
                      {canManage && (
                        <button
                          onClick={handleOpenCreate}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: '10px' }}
                        >
                          <Plus size={14} /> Register New Asset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedAssets.map((asset) => {
                  const hasSim = !!asset.sim_number
                  const hasSerial = !!asset.serial_number
                  const isAssigned = asset.status === 'ASSIGNED' && !!asset.assigned_to

                  return (
                    <tr
                      key={asset.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="table-row-hover"
                    >
                      {/* Asset Tag & Item */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(217, 119, 6, 0.1)',
                              color: 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {getCategoryIcon(asset.category)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                              {asset.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  backgroundColor: 'var(--surface-sunken)',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--border)',
                                }}
                              >
                                {asset.asset_tag}
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>•</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{asset.category}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Model & Specs */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {asset.model_number || '—'}
                          </span>
                          {asset.notes && (
                            <span
                              title={asset.notes}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                color: '#2563EB',
                                cursor: 'help',
                                flexShrink: 0,
                              }}
                            >
                              <Info size={12} />
                            </span>
                          )}
                        </div>
                        {asset.notes && (
                          <div
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-secondary)',
                              marginTop: '2px',
                              maxWidth: '200px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={asset.notes}
                          >
                            {asset.notes}
                          </div>
                        )}
                      </td>

                      {/* Serial / SIM */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {hasSerial ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>S/N:</span>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {asset.serial_number}
                              </span>
                            </div>
                          ) : null}

                          {hasSim ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                              <Phone size={12} style={{ color: '#2563EB' }} />
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1E40AF' }}>
                                {asset.sim_number}
                              </span>
                              {asset.sim_carrier && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    color: '#2563EB',
                                    padding: '0 4px',
                                    borderRadius: '3px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {asset.sim_carrier}
                                </span>
                              )}
                            </div>
                          ) : null}

                          {!hasSerial && !hasSim && (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>—</span>
                          )}
                        </div>
                      </td>

                      {/* Possessor */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        {isAssigned && asset.possessor ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--accent)',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '12px',
                                flexShrink: 0,
                              }}
                            >
                              {asset.possessor.name ? asset.possessor.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {asset.possessor.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>{asset.possessor.role === 'ADMIN' ? 'Admin' : asset.possessor.role === 'SALES_MANAGER' ? 'Manager' : 'Agent'}</span>
                                {asset.assigned_at && (
                                  <>
                                    <span>•</span>
                                    <span>{new Date(asset.assigned_at).toLocaleDateString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                            <UserX size={14} />
                            <span>In Storage / Unassigned</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        {renderStatusBadge(asset.status)}
                      </td>

                      {/* Condition */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color:
                              asset.condition === 'NEW' || asset.condition === 'EXCELLENT'
                                ? '#059669'
                                : asset.condition === 'GOOD'
                                ? '#2563EB'
                                : asset.condition === 'FAIR'
                                ? '#D97706'
                                : '#DC2626',
                          }}
                        >
                          {asset.condition || 'GOOD'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {/* Assignment / Return Button (Admin/Manager only) */}
                          {canManage && (
                            <>
                              {isAssigned ? (
                                <button
                                  onClick={() => handleOpenReturn(asset)}
                                  className="btn btn-outline btn-sm"
                                  title="Return / Check-in Asset"
                                  style={{ padding: '4px 8px', fontSize: '12px', color: '#D97706' }}
                                >
                                  <RotateCcw size={13} style={{ marginRight: '4px' }} /> Return
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenAssign(asset)}
                                  className="btn btn-primary btn-sm"
                                  title="Assign to Staff Member"
                                  style={{ padding: '4px 8px', fontSize: '12px' }}
                                >
                                  <UserCheck size={13} style={{ marginRight: '4px' }} /> Assign
                                </button>
                              )}
                            </>
                          )}

                          {/* History */}
                          <button
                            onClick={() => handleOpenHistory(asset)}
                            className="btn btn-ghost btn-sm"
                            title="View Handover History & Logs"
                            style={{ padding: '6px', color: 'var(--text-secondary)' }}
                          >
                            <History size={15} />
                          </button>

                          {/* Edit (Admin/Manager only) */}
                          {canManage && (
                            <button
                              onClick={() => handleOpenEdit(asset)}
                              className="btn btn-ghost btn-sm"
                              title="Edit Asset Details"
                              style={{ padding: '6px', color: 'var(--text-secondary)' }}
                            >
                              <Edit2 size={15} />
                            </button>
                          )}

                          {/* Delete (Admin only) */}
                          {isAdmin && (
                            <button
                              onClick={() => setDeleteConfirmId(asset.id)}
                              className="btn btn-ghost btn-sm"
                              title="Delete Asset"
                              style={{ padding: '6px', color: '#EF4444' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Pagination Bar ---- */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAssets.length)}
            </strong>{' '}
            of{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{filteredAssets.length}</strong>{' '}
            assets
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn btn-outline btn-sm"
              style={{ padding: '6px 12px', fontSize: '12px', opacity: currentPage === 1 ? 0.4 : 1 }}
            >
              ← Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
              .reduce<(number | '...')[]>((acc, page, idx, arr) => {
                if (idx > 0 && page - (arr[idx - 1] as number) > 1) acc.push('...')
                acc.push(page)
                return acc
              }, [])
              .map((item, i) =>
                item === '...' ? (
                  <span
                    key={`ellipsis-${i}`}
                    style={{ padding: '0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item as number)}
                    className={currentPage === item ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                    style={{ padding: '6px 10px', fontSize: '12px', minWidth: '34px' }}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-outline btn-sm"
              style={{ padding: '6px 12px', fontSize: '12px', opacity: currentPage === totalPages ? 0.4 : 1 }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. REGISTER ASSET MODAL */}
      {/* ============================================================ */}
      {isCreateModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            style={{
              maxWidth: '620px',
              width: '95vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="modal-header" style={{ padding: '18px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(217, 119, 6, 0.12)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Laptop size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Register Company Asset
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Add hardware, mobile device, SIM card, or office gear to company inventory
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="btn btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Asset Tag / Code <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.asset_tag || ''}
                      onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Category <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <select
                      className="input"
                      value={formData.category || 'Laptop'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Item / Asset Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. MacBook Pro 14 M3, iPhone 15 Pro, STC 5G Line"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Model Number / Specs
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. A2992, 16GB / 512GB"
                      value={formData.model_number || ''}
                      onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Serial Number / Hardware ID
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. C02G40AAQ05D"
                      value={formData.serial_number || ''}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    />
                  </div>
                </div>

                {/* SIM & Carrier Section */}
                <div
                  style={{
                    padding: '14px 16px',
                    backgroundColor: 'var(--surface-sunken)',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Smartphone size={15} style={{ color: '#2563EB' }} />
                    <span>Cellular &amp; SIM Card Details (If Applicable)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', display: 'block' }}>
                        SIM Phone / ICCID Number
                      </label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. +966 50 123 4567 or 89966..."
                        value={formData.sim_number || ''}
                        onChange={(e) => setFormData({ ...formData, sim_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', display: 'block' }}>
                        Telecom Carrier
                      </label>
                      <select
                        className="input"
                        value={formData.sim_carrier || ''}
                        onChange={(e) => setFormData({ ...formData, sim_carrier: e.target.value })}
                      >
                        <option value="">Select carrier...</option>
                        {CARRIERS.map((car) => (
                          <option key={car} value={car}>
                            {car}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Status & Initial Assignee */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Initial Possessor (Assign to)
                    </label>
                    <select
                      className="input"
                      value={formData.assigned_to || ''}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    >
                      <option value="">Leave Unassigned (In Storage)</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Asset Condition
                    </label>
                    <select
                      className="input"
                      value={formData.condition || 'NEW'}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value as AssetCondition })}
                    >
                      <option value="NEW">Brand New</option>
                      <option value="EXCELLENT">Excellent</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                      <option value="DAMAGED">Needs Repair / Damaged</option>
                    </select>
                  </div>
                </div>

                {/* Purchase info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Purchase Cost (SAR)
                    </label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 6500"
                      value={formData.purchase_cost || ''}
                      onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={formData.purchase_date || ''}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Warranty Expiry
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={formData.warranty_expiry || ''}
                      onChange={(e) => setFormData({ ...formData, warranty_expiry: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Notes &amp; Accessories Included
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="e.g. Includes 96W USB-C power adapter and laptop sleeve."
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{ padding: '14px 24px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-outline"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Registering...' : 'Register Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. EDIT ASSET MODAL */}
      {/* ============================================================ */}
      {isEditModalOpen && selectedAsset && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            style={{
              maxWidth: '620px',
              width: '95vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="modal-header" style={{ padding: '18px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(217, 119, 6, 0.12)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Edit2 size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Edit Asset ({selectedAsset.asset_tag})
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Modify item specifications, serial numbers, or possession status
                  </p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="btn btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Asset Tag / Code <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.asset_tag || ''}
                      onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Category <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <select
                      className="input"
                      value={formData.category || 'Laptop'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Item / Asset Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Model Number / Specs
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.model_number || ''}
                      onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Serial Number / Hardware ID
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={formData.serial_number || ''}
                      onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    />
                  </div>
                </div>

                {/* SIM & Carrier Section */}
                <div
                  style={{
                    padding: '14px 16px',
                    backgroundColor: 'var(--surface-sunken)',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Smartphone size={15} style={{ color: '#2563EB' }} />
                    <span>Cellular &amp; SIM Card Details (If Applicable)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', display: 'block' }}>
                        SIM Phone / ICCID Number
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.sim_number || ''}
                        onChange={(e) => setFormData({ ...formData, sim_number: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', display: 'block' }}>
                        Telecom Carrier
                      </label>
                      <select
                        className="input"
                        value={formData.sim_carrier || ''}
                        onChange={(e) => setFormData({ ...formData, sim_carrier: e.target.value })}
                      >
                        <option value="">None / Select carrier...</option>
                        {CARRIERS.map((car) => (
                          <option key={car} value={car}>
                            {car}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Status & Possessor */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Possessor (Assignee)
                    </label>
                    <select
                      className="input"
                      value={formData.assigned_to || ''}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    >
                      <option value="">Unassigned (In Storage)</option>
                      {teamMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Condition
                    </label>
                    <select
                      className="input"
                      value={formData.condition || 'GOOD'}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value as AssetCondition })}
                    >
                      <option value="NEW">Brand New</option>
                      <option value="EXCELLENT">Excellent</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                      <option value="DAMAGED">Needs Repair / Damaged</option>
                    </select>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Asset Status
                  </label>
                  <select
                    className="input"
                    value={formData.status || 'AVAILABLE'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AssetStatus })}
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="ASSIGNED">In Use (Assigned)</option>
                    <option value="MAINTENANCE">Maintenance / In Repair</option>
                    <option value="LOST">Lost / Damaged</option>
                    <option value="RETIRED">Retired</option>
                  </select>
                </div>

                {/* Purchase info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Purchase Cost (SAR)
                    </label>
                    <input
                      type="number"
                      className="input"
                      value={formData.purchase_cost || ''}
                      onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={formData.purchase_date || ''}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                      Warranty Expiry
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={formData.warranty_expiry || ''}
                      onChange={(e) => setFormData({ ...formData, warranty_expiry: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Notes &amp; Details
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{ padding: '14px 24px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-outline"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. ASSIGN / CHECKOUT MODAL */}
      {/* ============================================================ */}
      {isAssignModalOpen && selectedAsset && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            style={{
              maxWidth: '520px',
              width: '95vw',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="modal-header" style={{ padding: '18px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserCheck size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Assign Asset to Staff
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    {selectedAsset.name} ({selectedAsset.asset_tag})
                  </p>
                </div>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} className="btn btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="modal-body" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Select Staff Member <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    className="input"
                    value={assignForm.assigned_to}
                    onChange={(e) => setAssignForm({ ...assignForm, assigned_to: e.target.value })}
                    required
                  >
                    <option value="">-- Choose Team Member --</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role === 'ADMIN' ? 'Admin' : m.role === 'SALES_MANAGER' ? 'Manager' : 'Agent'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Handover Condition
                  </label>
                  <select
                    className="input"
                    value={assignForm.condition}
                    onChange={(e) => setAssignForm({ ...assignForm, condition: e.target.value as AssetCondition })}
                  >
                    <option value="NEW">Brand New</option>
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Handover Notes / Remarks
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="e.g. Handed over with charger, mouse, and SIM active. Signed agreement acknowledged."
                    value={assignForm.assignment_notes}
                    onChange={(e) => setAssignForm({ ...assignForm, assignment_notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 24px' }}>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="btn btn-outline"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. RETURN / CHECK-IN MODAL */}
      {/* ============================================================ */}
      {isReturnModalOpen && selectedAsset && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            style={{
              maxWidth: '520px',
              width: '95vw',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="modal-header" style={{ padding: '18px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Return / Check-In Asset
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Returning from {selectedAsset.possessor?.name || 'Staff'} ({selectedAsset.asset_tag})
                  </p>
                </div>
              </div>
              <button onClick={() => setIsReturnModalOpen(false)} className="btn btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="modal-body" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Returned Condition
                  </label>
                  <select
                    className="input"
                    value={returnForm.condition}
                    onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value as AssetCondition })}
                  >
                    <option value="EXCELLENT">Excellent</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair (Minor Scratches/Wear)</option>
                    <option value="DAMAGED">Damaged / Needs Repair</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Destination Status
                  </label>
                  <select
                    className="input"
                    value={returnForm.targetStatus}
                    onChange={(e) => setReturnForm({ ...returnForm, targetStatus: e.target.value as AssetStatus })}
                  >
                    <option value="AVAILABLE">Available in Stock</option>
                    <option value="MAINTENANCE">Under Repair / Maintenance</option>
                    <option value="RETIRED">Disposed / Retired</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block' }}>
                    Return Notes &amp; Inspection Remarks
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="e.g. Returned in good condition, charger and SIM returned."
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 24px' }}>
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="btn btn-outline"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. HISTORY & AUDIT LOGS MODAL */}
      {/* ============================================================ */}
      {isHistoryModalOpen && selectedAsset && (
        <div className="modal-backdrop">
          <div
            className="modal-content"
            style={{
              maxWidth: '640px',
              width: '95vw',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="modal-header" style={{ padding: '18px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    color: '#6366F1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <History size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Asset Audit Trail &amp; Possession History
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    {selectedAsset.name} • {selectedAsset.asset_tag}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="btn btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '22px 24px', overflowY: 'auto' }}>
              {isLoadingLogs ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Clock size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ marginTop: '8px', fontSize: '13px' }}>Loading audit logs...</div>
                </div>
              ) : assetLogs.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <History size={32} style={{ color: 'var(--text-tertiary)' }} />
                  <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600 }}>No History Records</div>
                  <div style={{ fontSize: '12px' }}>This asset has no recorded handovers or changes yet.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {assetLogs.map((log) => {
                    const isAssign = log.action === 'ASSIGNED'
                    const isReturn = log.action === 'RETURNED'

                    return (
                      <div
                        key={log.id}
                        style={{
                          padding: '14px 16px',
                          backgroundColor: 'var(--surface-sunken)',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: isAssign
                              ? 'rgba(59, 130, 246, 0.12)'
                              : isReturn
                              ? 'rgba(245, 158, 11, 0.12)'
                              : 'rgba(16, 185, 129, 0.12)',
                            color: isAssign ? '#2563EB' : isReturn ? '#D97706' : '#10B981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isAssign ? <UserCheck size={16} /> : isReturn ? <RotateCcw size={16} /> : <FileText size={16} />}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {log.action === 'ASSIGNED'
                                ? `Assigned to ${log.user?.name || 'Staff'}`
                                : log.action === 'RETURNED'
                                ? `Returned by ${log.user?.name || 'Staff'}`
                                : log.action}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>

                          {log.notes && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {log.notes}
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {log.condition_at_time && (
                              <span style={{ backgroundColor: 'var(--surface)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                Condition: <strong>{log.condition_at_time}</strong>
                              </span>
                            )}
                            {log.performer?.name && (
                              <span>Recorded by: {log.performer.name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 24px' }}>
              <button onClick={() => setIsHistoryModalOpen(false)} className="btn btn-outline">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <ConfirmModal
          isOpen={true}
          title="Delete Company Asset"
          message="Are you sure you want to permanently delete this asset from the registry? This will remove all associated logs and history."
          confirmLabel="Delete Asset"
          cancelLabel="Cancel"
          variant="danger"
          loading={isSubmitting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  )
}
