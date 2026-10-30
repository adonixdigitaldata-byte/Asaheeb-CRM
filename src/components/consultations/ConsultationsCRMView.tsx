'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar,
  Clock,
  Phone,
  MessageCircle,
  Video,
  Building,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Sparkles,
  Ticket,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  User,
  TrendingUp,
  MapPin,
  CalendarCheck,
  Plus,
  ShieldCheck,
  X,
  Mail,
  Award,
  FileText,
  Edit3,
  ShoppingCart,
  CreditCard,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SaudiRiyalIcon } from '@/components/SaudiRiyalIcon'
import type { ConsultationBooking, ConsultationSettings, Profile } from '@/types/database'

interface Props {
  profile: Profile
}

export default function ConsultationsCRMView({ profile }: Props) {
  const supabase = createClient()
  const canManage = profile.role === 'ADMIN' || profile.role === 'SALES_MANAGER'

  const [activeTab, setActiveTab] = useState<
    'NEEDS_SCHEDULING' | 'SCHEDULED' | 'COMPLETED' | 'ACTIVE_VOUCHERS' | 'REDEEMED' | 'ABANDONED_CHECKOUT'
  >('NEEDS_SCHEDULING')
  const [bookings, setBookings] = useState<ConsultationBooking[]>([])
  const [settings, setSettings] = useState<ConsultationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newBookingAlert, setNewBookingAlert] = useState<string | null>(null)

  // Modals
  const [selectedBooking, setSelectedBooking] = useState<ConsultationBooking | null>(null)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false)
  const [isTestBookingModalOpen, setIsTestBookingModalOpen] = useState(false)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [isEditNotesModalOpen, setIsEditNotesModalOpen] = useState(false)
  const [meetingNotesInput, setMeetingNotesInput] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  // Schedule Inputs
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingTime, setMeetingTime] = useState('16:00')
  const [meetingMode, setMeetingMode] = useState<'ONLINE_VIDEO' | 'IN_PERSON_OFFICE' | 'ON_SITE_WALKTHROUGH'>('ONLINE_VIDEO')
  const [meetingVenueOrUrl, setMeetingVenueOrUrl] = useState('https://meet.google.com/asb-vip-consult')
  const [conciergeNotes, setConciergeNotes] = useState('')
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)

  // Redeem Inputs
  const [dealId, setDealId] = useState('')
  const [isRedeeming, setIsRedeeming] = useState(false)

  // Settings Inputs
  const [editFee, setEditFee] = useState(500)
  const [editCapacity, setEditCapacity] = useState(10)
  const [editMultiplier, setEditMultiplier] = useState(1.0)
  const [editIsActive, setEditIsActive] = useState(true)
  const [editBannerEn, setEditBannerEn] = useState('')
  const [editBannerAr, setEditBannerAr] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Simulation Inputs
  const [testFullName, setTestFullName] = useState('Eng. Sultan Al-Ghamdi')
  const [testPhone, setTestPhone] = useState('+966501234567')
  const [testEmail, setTestEmail] = useState('sultan.ghamdi@example.com')
  const [testBudget, setTestBudget] = useState('SAR 2M – 4M')
  const [testIntent, setTestIntent] = useState('HIGH_RENTAL_YIELD')
  const [testMode, setTestMode] = useState<'ONLINE_VIDEO' | 'IN_PERSON_OFFICE'>('ONLINE_VIDEO')
  const [isSubmittingTest, setIsSubmittingTest] = useState(false)

  // 1. Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: settingsData } = await supabase
        .from('consultation_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (settingsData) {
        setSettings(settingsData)
        setEditFee(settingsData.fee_amount)
        setEditCapacity(settingsData.weekly_slot_capacity)
        setEditMultiplier(settingsData.credit_multiplier || 1.0)
        setEditIsActive(settingsData.is_active)
        setEditBannerEn(settingsData.custom_urgency_banner_en || '')
        setEditBannerAr(settingsData.custom_urgency_banner_ar || '')
      }

      const { data: bookingsData } = await supabase
        .from('consultation_bookings')
        .select('*')
        .order('created_at', { ascending: false })

      if (bookingsData) {
        setBookings(bookingsData as ConsultationBooking[])
      }
    } catch (err) {
      console.error('Failed to fetch CRM consultation data:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()

    // Realtime listener for website bookings
    const channel = supabase
      .channel('consultations-live-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consultation_bookings' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as ConsultationBooking
            if (newRow.status === 'PAYMENT_PENDING' || newRow.payment_status === 'PENDING') {
              setNewBookingAlert(`🛒 Checkout Started (Pending Payment): ${newRow.full_name}`)
            } else {
              setNewBookingAlert(`🎉 New Confirmed VIP Booking: ${newRow.full_name} (${newRow.amount_paid} SAR Paid)`)
            }
            setTimeout(() => setNewBookingAlert(null), 8000)
          }
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consultation_settings' },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchData, supabase])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filter Bookings by Tab & Search
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const q = searchTerm.trim().toLowerCase()
      if (!q) return true
      return (
        b.full_name?.toLowerCase().includes(q) ||
        b.phone_number?.includes(q) ||
        b.booking_reference?.toLowerCase().includes(q) ||
        b.city_or_country?.toLowerCase().includes(q) ||
        b.voucher_code?.toLowerCase().includes(q)
      )
    })
  }, [bookings, searchTerm])

  // 1. Abandoned Carts / Unpaid Checkouts
  const abandonedCheckoutList = useMemo(
    () => filteredBookings.filter((b) => b.status === 'PAYMENT_PENDING' || b.payment_status === 'PENDING'),
    [filteredBookings]
  )

  // 2. Paid Website Bookings Awaiting Concierge Scheduling
  const needsSchedulingList = useMemo(
    () =>
      filteredBookings.filter(
        (b) => b.status === 'PAID_UNSCHEDULED' && b.payment_status !== 'PENDING'
      ),
    [filteredBookings]
  )
  const scheduledList = useMemo(
    () => filteredBookings.filter((b) => b.status === 'SCHEDULED'),
    [filteredBookings]
  )
  const completedList = useMemo(
    () => filteredBookings.filter((b) => b.status === 'COMPLETED'),
    [filteredBookings]
  )
  const activeVouchersList = useMemo(
    () => filteredBookings.filter((b) => b.status === 'COMPLETED' && b.voucher_status === 'ACTIVE'),
    [filteredBookings]
  )
  const redeemedVouchersList = useMemo(
    () => filteredBookings.filter((b) => b.voucher_status === 'REDEEMED'),
    [filteredBookings]
  )

  // Extract Meeting Notes helper
  const getBookingMeetingNotes = (booking: ConsultationBooking): string => {
    if ((booking as any).meeting_notes) {
      return (booking as any).meeting_notes
    }
    const notes = booking.concierge_notes || ''
    const marker = '[Meeting Notes / Advisory Summary]:'
    if (notes.includes(marker)) {
      return notes.split(marker)[1]?.split('[Redeemed on Deal/Unit:')[0]?.trim() || ''
    }
    return ''
  }

  // Extract Redeemed Deal Reference helper
  const getRedeemedDealRef = (booking: ConsultationBooking): string => {
    if (booking.redeemed_deal_id) {
      return booking.redeemed_deal_id
    }
    const notes = booking.concierge_notes || ''
    const marker = '[Redeemed on Deal/Unit:'
    if (notes.includes(marker)) {
      const after = notes.split(marker)[1]
      return after.split(']')[0]?.trim() || 'Recorded Deal'
    }
    return 'Recorded Deal'
  }

  // 2. Schedule Lock-In Handler
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBooking) return

    setIsSavingSchedule(true)
    const combinedDateTime = `${meetingDate}T${meetingTime}:00Z`

    try {
      const { error } = await supabase
        .from('consultation_bookings')
        .update({
          status: 'SCHEDULED',
          scheduled_date: combinedDateTime,
          confirmed_meeting_mode: meetingMode,
          meeting_link_or_venue: meetingVenueOrUrl,
          concierge_notes: conciergeNotes,
          assigned_concierge_id: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedBooking.id)

      if (!error) {
        setIsScheduleModalOpen(false)
        setSelectedBooking(null)
        await fetchData()
      } else {
        alert('Failed to update schedule in Supabase: ' + error.message)
      }
    } catch (err: any) {
      alert('Error saving schedule: ' + err.message)
    } finally {
      setIsSavingSchedule(false)
    }
  }

    // 3. Open Complete Modal & Notes
    const handleOpenCompleteModal = (booking: ConsultationBooking) => {
      setSelectedBooking(booking)
      setMeetingNotesInput(getBookingMeetingNotes(booking))
      setIsCompleteModalOpen(true)
    }

    const handleOpenEditNotesModal = (booking: ConsultationBooking) => {
      setSelectedBooking(booking)
      setMeetingNotesInput(getBookingMeetingNotes(booking))
      setIsEditNotesModalOpen(true)
    }

  // Mark Completed with Notes Handler
  const handleConfirmCompleteWithNotes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBooking) return

    setIsSavingNotes(true)
    const cleanNotes = meetingNotesInput.trim()

    try {
      // 1. Try updating meeting_notes column directly
      let { error } = await supabase
        .from('consultation_bookings')
        .update({
          status: 'COMPLETED',
          voucher_status: 'ACTIVE',
          meeting_notes: cleanNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedBooking.id)

      // 2. If meeting_notes column does not exist yet, fallback to concierge_notes
      if (error && (error.message.includes('column') || error.code === '42703')) {
        const existing = selectedBooking.concierge_notes || ''
        const cleanedExisting = existing.replace(/\[Meeting Notes \/ Advisory Summary\]:[\s\S]*?(?=\[Redeemed on Deal\/Unit:|$)/g, '').trim()
        const merged = cleanNotes
          ? (cleanedExisting ? `${cleanedExisting}\n\n[Meeting Notes / Advisory Summary]:\n${cleanNotes}` : `[Meeting Notes / Advisory Summary]:\n${cleanNotes}`)
          : cleanedExisting

        const fallback = await supabase
          .from('consultation_bookings')
          .update({
            status: 'COMPLETED',
            voucher_status: 'ACTIVE',
            concierge_notes: merged,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedBooking.id)

        error = fallback.error
      }

      if (!error) {
        setIsCompleteModalOpen(false)
        setSelectedBooking(null)
        setMeetingNotesInput('')
        await fetchData()
      } else {
        alert('Failed to complete consultation: ' + error.message)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSavingNotes(false)
    }
  }

  // Save / Update Only Meeting Notes Handler
  const handleSaveOnlyMeetingNotes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBooking) return

    setIsSavingNotes(true)
    const cleanNotes = meetingNotesInput.trim()

    try {
      // 1. Try updating meeting_notes column
      let { error } = await supabase
        .from('consultation_bookings')
        .update({
          meeting_notes: cleanNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedBooking.id)

      // 2. Fallback to concierge_notes if column not present yet
      if (error && (error.message.includes('column') || error.code === '42703')) {
        const existing = selectedBooking.concierge_notes || ''
        const cleanedExisting = existing.replace(/\[Meeting Notes \/ Advisory Summary\]:[\s\S]*?(?=\[Redeemed on Deal\/Unit:|$)/g, '').trim()
        const merged = cleanNotes
          ? (cleanedExisting ? `${cleanedExisting}\n\n[Meeting Notes / Advisory Summary]:\n${cleanNotes}` : `[Meeting Notes / Advisory Summary]:\n${cleanNotes}`)
          : cleanedExisting

        const fallback = await supabase
          .from('consultation_bookings')
          .update({
            concierge_notes: merged,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedBooking.id)

        error = fallback.error
      }

      if (!error) {
        setIsEditNotesModalOpen(false)
        setSelectedBooking(null)
        setMeetingNotesInput('')
        await fetchData()
      } else {
        alert('Failed to save notes: ' + error.message)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSavingNotes(false)
    }
  }

  // 4. Redeem Voucher Handler (Resilient to Text/UUID deal references)
  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBooking || !dealId.trim()) return

    setIsRedeeming(true)
    const cleanDealRef = dealId.trim()

    try {
      // 1. Attempt updating redeemed_deal_id directly (works when column is text or valid uuid)
      let { error } = await supabase
        .from('consultation_bookings')
        .update({
          voucher_status: 'REDEEMED',
          redeemed_deal_id: cleanDealRef,
          redeemed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedBooking.id)

      // 2. If Postgres throws UUID syntax error (invalid input syntax for type uuid)
      if (error && (error.message.includes('uuid') || error.code === '22P02')) {
        const existingNotes = selectedBooking.concierge_notes || ''
        const updatedNotes = existingNotes
          ? `${existingNotes}\n[Redeemed on Deal/Unit: ${cleanDealRef}]`
          : `[Redeemed on Deal/Unit: ${cleanDealRef}]`

        const fallback = await supabase
          .from('consultation_bookings')
          .update({
            voucher_status: 'REDEEMED',
            redeemed_at: new Date().toISOString(),
            concierge_notes: updatedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedBooking.id)

        error = fallback.error
      }

      if (!error) {
        setIsRedeemModalOpen(false)
        setSelectedBooking(null)
        setDealId('')
        await fetchData()
      } else {
        alert('Failed to redeem voucher: ' + error.message)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsRedeeming(false)
    }
  }

  // 4b. Mark Abandoned Cart / Unpaid Booking as Successfully Paid (Offline/Recovery)
  const handleMarkAsPaid = async (booking: ConsultationBooking) => {
    if (
      !confirm(
        `Confirm that payment of ${booking.currency || 'SAR'} ${booking.amount_paid || 500} for "${booking.full_name}" has been received?\n\nThis will confirm the booking, allocate a weekly quota slot, and move the client to "Needs Scheduling" for concierge triage.`
      )
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('consultation_bookings')
        .update({
          status: 'PAID_UNSCHEDULED',
          payment_status: 'SUCCESS',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      if (!error) {
        await fetchData()
      } else {
        alert('Failed to update status: ' + error.message)
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

  // 5. Save Global Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)
    try {
      const updatePayload = {
        fee_amount: editFee,
        weekly_slot_capacity: editCapacity,
        credit_multiplier: editMultiplier,
        is_active: editIsActive,
        custom_urgency_banner_en: editBannerEn || null,
        custom_urgency_banner_ar: editBannerAr || null,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      }

      const query = settings?.id
        ? supabase.from('consultation_settings').update(updatePayload).eq('id', settings.id)
        : supabase.from('consultation_settings').update(updatePayload).neq('id', '00000000-0000-0000-0000-000000000000')

      const { error } = await query

      if (!error) {
        setIsSettingsModalOpen(false)
        await fetchData()
      } else {
        alert('Error saving settings: ' + error.message)
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Quick Toggle for Booking Engine (Pause / Resume directly from header or banner)
  const handleToggleActiveBooking = async (active: boolean) => {
    try {
      const updatePayload = {
        is_active: active,
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      }

      const query = settings?.id
        ? supabase.from('consultation_settings').update(updatePayload).eq('id', settings.id)
        : supabase.from('consultation_settings').update(updatePayload).neq('id', '00000000-0000-0000-0000-000000000000')

      const { error } = await query
      if (!error) {
        await fetchData()
      } else {
        alert('Failed to update booking status: ' + error.message)
      }
    } catch (err: any) {
      alert(err.message)
    }
  }

    // 6. Simulate Booking
    const handleCreateTestBooking = async (e: React.FormEvent) => {
      e.preventDefault()
      setIsSubmittingTest(true)
      try {
        const ref = `ASB-${Date.now().toString().slice(-6)}`
        const voucher = `VOUCH-500-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
        const fee = settings?.fee_amount || 500
        const weekCycle = settings?.current_week_cycle || 'Sat Oct 24 – Thu Oct 29, 2026'

        const { error } = await supabase.from('consultation_bookings').insert({
          booking_reference: ref,
          voucher_code: voucher,
          full_name: testFullName,
          phone_number: testPhone,
          email: testEmail,
          city_or_country: 'Jeddah, Saudi Arabia',
          buyer_intent: testIntent,
          budget_range: testBudget,
          preferred_meeting_mode: testMode,
          notes_or_questions: 'Interested in luxury waterfront units or off-plan villas with 3-year payment plans.',
          amount_paid: fee,
          currency: 'SAR',
          payment_gateway: 'MADA_CHECKOUT',
          payment_status: 'SUCCESS',
          paid_at: new Date().toISOString(),
          credit_value: fee * (settings?.credit_multiplier || 1.0),
          voucher_status: 'ACTIVE',
          week_cycle: weekCycle,
          status: 'PAID_UNSCHEDULED',
        })

        if (!error) {
          setIsTestBookingModalOpen(false)
          await fetchData()
        } else {
          alert('Error creating simulation booking: ' + error.message)
        }
      } catch (err: any) {
        alert(err.message)
      } finally {
        setIsSubmittingTest(false)
      }
    }

    // Only confirmed paid bookings count towards revenue and slot quota
    const confirmedPaidBookings = useMemo(
      () =>
        bookings.filter(
          (b) =>
            b.payment_status === 'SUCCESS' &&
            b.status !== 'CANCELLED_REFUNDED' &&
            b.status !== 'PAYMENT_PENDING'
        ),
      [bookings]
    )

    const totalInflow = useMemo(
      () => confirmedPaidBookings.reduce((sum, b) => sum + (Number(b.amount_paid) || 0), 0),
      [confirmedPaidBookings]
    )

    const slotsBookedThisWeek = useMemo(() => {
      return confirmedPaidBookings.length
    }, [confirmedPaidBookings])

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)' }}>
        {/* Toast Notification */}
        {newBookingAlert && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px 18px',
              backgroundColor: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: 8,
              color: '#92400E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-md)',
              animation: 'fadeIn 200ms ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 13 }}>
              <Sparkles size={16} color="#D97706" />
              <span>{newBookingAlert}</span>
            </div>
            <button
              type="button"
              onClick={() => setNewBookingAlert(null)}
              style={{ background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', padding: 4 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(217, 119, 6, 0.15)',
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 className="text-page-title" style={{ margin: 0 }}>
                  VIP Strategic Consultations
                </h1>
                {settings?.is_active ? (
                  <span
                    className="badge"
                    style={{
                      backgroundColor: '#DCFCE7',
                      color: '#166534',
                      fontWeight: 700,
                      fontSize: 11,
                      border: '1px solid #BBF7D0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#16A34A' }} />
                    <span>Website Bookings Active</span>
                  </span>
                ) : (
                  <span
                    className="badge"
                    style={{
                      backgroundColor: '#FEE2E2',
                      color: '#991B1B',
                      fontWeight: 700,
                      fontSize: 11,
                      border: '1px solid #FECACA',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#DC2626' }} />
                    <span>Bookings Paused / Stopped</span>
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                1-on-1 Sessions with Founder Nabeel booked via website. Concierge triage, schedule locks & deal vouchers.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {canManage && settings && !settings.is_active && (
              <button
                type="button"
                onClick={() => handleToggleActiveBooking(true)}
                className="btn btn-sm"
                style={{ backgroundColor: '#16A34A', color: '#FFFFFF', borderColor: '#16A34A', fontWeight: 700 }}
              >
                ▶ Resume Bookings
              </button>
            )}

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="btn btn-outline btn-sm"
              title="Refresh Bookings"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => setIsTestBookingModalOpen(true)}
                className="btn btn-outline btn-sm"
                style={{ color: '#D97706', borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }}
              >
                <Plus size={14} />
                <span>+ Simulate Website Booking</span>
              </button>
            )}

            {canManage && (
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="btn btn-primary btn-sm"
                style={{
                  backgroundColor: '#D97706',
                  borderColor: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Settings size={14} />
                <span>Consultation Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Body */}
        <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* KPI Metric Cards */}
          {settings && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: 16,
              }}
            >
              {/* Weekly Quota Card */}
              <div
                className="card"
                style={{
                  padding: '16px 20px',
                  borderLeft: '4px solid #D97706',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Weekly Quota
                  </span>
                  <CalendarCheck size={18} color="#D97706" />
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {slotsBookedThisWeek}{' '}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      / {settings.weekly_slot_capacity} booked
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: 6,
                      backgroundColor: '#E4E4E7',
                      borderRadius: 3,
                      marginTop: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: '#D97706',
                        borderRadius: 3,
                        width: `${Math.min(100, (slotsBookedThisWeek / (settings.weekly_slot_capacity || 10)) * 100)}%`,
                        transition: 'width 300ms ease',
                      }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{Math.max(0, settings.weekly_slot_capacity - slotsBookedThisWeek)} allocations left</span>
                  <span style={{ fontWeight: 600, color: '#D97706' }}>{settings.current_week_cycle}</span>
                </div>
              </div>

              {/* Booking Fee Card */}
              <div
                className="card"
                style={{
                  padding: '16px 20px',
                  borderLeft: '4px solid #16A34A',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Booking Fee & Credit
                  </span>
                  <SaudiRiyalIcon size={18} color="#16A34A" />
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#16A34A' }}>
                    {settings.currency} {settings.fee_amount}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span
                      className="badge"
                      style={{ backgroundColor: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 700 }}
                    >
                      {settings.credit_multiplier}x Property Voucher ({settings.currency} {settings.fee_amount * (settings.credit_multiplier || 1)})
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  100% deductible upon deal closing
                </div>
              </div>

              {/* Needs Scheduling Card */}
              <div
                className="card"
                style={{
                  padding: '16px 20px',
                  borderLeft: '4px solid #DC2626',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Awaiting Coordination
                  </span>
                  <AlertTriangle size={18} color="#DC2626" />
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#DC2626' }}>
                      {needsSchedulingList.length}
                    </span>
                    {needsSchedulingList.length > 0 && (
                      <span
                        className="badge"
                        style={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: 11, fontWeight: 700 }}
                      >
                        Urgent Callback
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Clients ready for calendar lock-in
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: '#991B1B', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} />
                  <span>Target callback: within 60 minutes</span>
                </div>
              </div>

              {/* Retainer Inflow Card */}
              <div
                className="card"
                style={{
                  padding: '16px 20px',
                  borderLeft: '4px solid #4F46E5',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3730A3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Retainer Inflow
                  </span>
                  <TrendingUp size={18} color="#4F46E5" />
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#4F46E5' }}>
                    {settings.currency} {totalInflow.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                    From <strong style={{ color: 'var(--text-primary)' }}>{confirmedPaidBookings.length}</strong> paid consultations
                    {abandonedCheckoutList.length > 0 && (
                      <span style={{ color: '#D97706', marginLeft: 6, fontSize: 11, fontWeight: 600 }}>
                        ({abandonedCheckoutList.length} uncompleted in cart)
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
                  Upfront commitment fee collected
                </div>
              </div>
            </div>
          )}

          {/* Tab & Search Filter Bar */}
          <div className="card" style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              {/* Tab Pill Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('NEEDS_SCHEDULING')}
                  className={`btn btn-sm ${activeTab === 'NEEDS_SCHEDULING' ? 'btn-primary' : 'btn-outline'}`}
                  style={
                    activeTab === 'NEEDS_SCHEDULING'
                      ? { backgroundColor: '#DC2626', borderColor: '#DC2626', color: '#FFFFFF' }
                      : {}
                  }
                >
                  <span>🚨 Needs Scheduling</span>
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      fontWeight: 700,
                      backgroundColor: activeTab === 'NEEDS_SCHEDULING' ? 'rgba(255,255,255,0.25)' : '#FEE2E2',
                      color: activeTab === 'NEEDS_SCHEDULING' ? '#FFFFFF' : '#991B1B',
                    }}
                  >
                    {needsSchedulingList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('SCHEDULED')}
                  className={`btn btn-sm ${activeTab === 'SCHEDULED' ? 'btn-primary' : 'btn-outline'}`}
                  style={
                    activeTab === 'SCHEDULED'
                      ? { backgroundColor: '#D97706', borderColor: '#D97706', color: '#FFFFFF' }
                      : {}
                  }
                >
                  <span>📅 Scheduled Upcoming</span>
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      fontWeight: 700,
                      backgroundColor: activeTab === 'SCHEDULED' ? 'rgba(255,255,255,0.25)' : '#FEF3C7',
                      color: activeTab === 'SCHEDULED' ? '#FFFFFF' : '#92400E',
                    }}
                  >
                    {scheduledList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('COMPLETED')}
                  className={`btn btn-sm ${activeTab === 'COMPLETED' ? 'btn-primary' : 'btn-outline'}`}
                  style={
                    activeTab === 'COMPLETED'
                      ? { backgroundColor: '#0284C7', borderColor: '#0284C7', color: '#FFFFFF' }
                      : {}
                  }
                >
                  <span>🤝 Completed Meetings &amp; Notes</span>
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      fontWeight: 700,
                      backgroundColor: activeTab === 'COMPLETED' ? 'rgba(255,255,255,0.25)' : '#E0F2FE',
                      color: activeTab === 'COMPLETED' ? '#FFFFFF' : '#0369A1',
                    }}
                  >
                    {completedList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ACTIVE_VOUCHERS')}
                  className={`btn btn-sm ${activeTab === 'ACTIVE_VOUCHERS' ? 'btn-primary' : 'btn-outline'}`}
                  style={
                    activeTab === 'ACTIVE_VOUCHERS'
                      ? { backgroundColor: '#16A34A', borderColor: '#16A34A', color: '#FFFFFF' }
                      : {}
                  }
                >
                  <span>💎 Active Vouchers</span>
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      fontWeight: 700,
                      backgroundColor: activeTab === 'ACTIVE_VOUCHERS' ? 'rgba(255,255,255,0.25)' : '#DCFCE7',
                      color: activeTab === 'ACTIVE_VOUCHERS' ? '#FFFFFF' : '#166534',
                    }}
                  >
                    {activeVouchersList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('REDEEMED')}
                  className={`btn btn-sm ${activeTab === 'REDEEMED' ? 'btn-primary' : 'btn-outline'}`}
                  style={
                    activeTab === 'REDEEMED'
                      ? { backgroundColor: '#4F46E5', borderColor: '#4F46E5', color: '#FFFFFF' }
                      : {}
                  }
                >
                  <span>✅ Deals Redeemed</span>
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      fontWeight: 700,
                      backgroundColor: activeTab === 'REDEEMED' ? 'rgba(255,255,255,0.25)' : '#EEF2FF',
                      color: activeTab === 'REDEEMED' ? '#FFFFFF' : '#3730A3',
                    }}
                  >
                    {redeemedVouchersList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ABANDONED_CHECKOUT')}
                  className={`btn btn-sm ${activeTab === 'ABANDONED_CHECKOUT' ? 'btn-primary' : 'btn-outline'}`}
                  style={
                    activeTab === 'ABANDONED_CHECKOUT'
                      ? { backgroundColor: '#B45309', borderColor: '#B45309', color: '#FFFFFF' }
                      : { borderColor: '#FDBA74', color: '#9A3412', backgroundColor: '#FFF7ED' }
                  }
                >
                  <ShoppingCart size={13} style={{ marginRight: 4 }} />
                  <span>🛒 Unbooked / Cart Left Out</span>
                  <span
                    style={{
                      marginLeft: 6,
                      padding: '1px 6px',
                      borderRadius: 10,
                      fontSize: 10.5,
                      fontWeight: 700,
                      backgroundColor: activeTab === 'ABANDONED_CHECKOUT' ? 'rgba(255,255,255,0.25)' : '#FFEDD5',
                      color: activeTab === 'ABANDONED_CHECKOUT' ? '#FFFFFF' : '#9A3412',
                    }}
                  >
                    {abandonedCheckoutList.length}
                  </span>
                </button>
              </div>

              {/* Search Input */}
              <div style={{ position: 'relative', width: 260 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  placeholder="Search name, phone, ref..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: 32, fontSize: 12.5, height: 34 }}
                />
              </div>
            </div>
          </div>

          {/* Feed of Bookings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {loading ? (
              <div className="card" style={{ padding: '48px 20px', textAlign: 'center' }}>
                <RefreshCw size={24} className="spin" style={{ margin: '0 auto', color: '#D97706' }} />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, fontWeight: 500 }}>
                  Loading VIP consultation bookings from database...
                </div>
              </div>
            ) : (
              <>
                {/* TAB 1: NEEDS SCHEDULING */}
                {activeTab === 'NEEDS_SCHEDULING' && (
                  needsSchedulingList.length === 0 ? (
                    <div
                      className="card"
                      style={{
                        padding: '48px 20px',
                        textAlign: 'center',
                        borderStyle: 'dashed',
                        backgroundColor: '#FAFBFD',
                      }}
                    >
                      <CheckCircle2 size={36} color="#16A34A" style={{ margin: '0 auto' }} />
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 12 }}>
                        All paid website consultations are scheduled!
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 460, margin: '6px auto 0' }}>
                        When clients book and pay SAR 500 on the website, they appear here instantly for concierge coordination.
                      </p>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setIsTestBookingModalOpen(true)}
                          className="btn btn-outline btn-sm"
                          style={{ marginTop: 16, color: '#D97706', borderColor: '#FDE68A' }}
                        >
                          <Plus size={13} />
                          <span>Simulate Website Booking</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    needsSchedulingList.map((item) => (
                      <div
                        key={item.id}
                        className="card"
                        style={{
                          padding: '18px 22px',
                          borderLeft: '4px solid #D97706',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        {/* Top Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span
                              className="badge"
                              style={{ backgroundColor: '#DCFCE7', color: '#166534', fontWeight: 700, fontSize: 11 }}
                            >
                              ✓ PAID {item.currency} {item.amount_paid} ({item.payment_gateway || 'MADA'})
                            </span>

                            <span
                              className="badge"
                              style={{ backgroundColor: '#F4F4F5', color: '#52525B', fontFamily: 'monospace', fontWeight: 600, fontSize: 11 }}
                            >
                              REF: {item.booking_reference}
                            </span>

                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                              Booked {new Date(item.created_at).toLocaleDateString()} at{' '}
                              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <span
                            className="badge"
                            style={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontWeight: 700, fontSize: 11 }}
                          >
                            🚨 Coordination Pending
                          </span>
                        </div>

                        {/* Client Header & Details */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 280 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                              {item.full_name}{' '}
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                                ({item.city_or_country || 'Saudi Arabia'})
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Phone size={14} color="#D97706" />
                                <a href={`tel:${item.phone_number}`} style={{ fontWeight: 600, color: '#D97706' }}>
                                  {item.phone_number}
                                </a>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(item.phone_number, `ph-${item.id}`)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}
                                  title="Copy Phone"
                                >
                                  {copiedId === `ph-${item.id}` ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}
                                </button>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                                <Mail size={14} />
                                <span>{item.email}</span>
                              </div>

                              <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Budget: </span>
                                <strong style={{ color: '#16A34A' }}>{item.budget_range}</strong>
                              </div>

                              <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Intent: </span>
                                <span
                                  style={{
                                    backgroundColor: '#F4F4F5',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                  }}
                                >
                                  {item.buyer_intent}
                                </span>
                              </div>
                            </div>

                            {/* Notes and Venue Box */}
                            <div
                              style={{
                                marginTop: 6,
                                padding: '10px 14px',
                                backgroundColor: '#F8FAFC',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                fontSize: 12.5,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#D97706', fontSize: 11.5, textTransform: 'uppercase' }}>
                                {item.preferred_meeting_mode === 'IN_PERSON_OFFICE' ? (
                                  <>
                                    <Building size={14} />
                                    <span>Requested: In-Person VIP Lounge (Matbouli Plaza, King Road, Jeddah)</span>
                                  </>
                                ) : (
                                  <>
                                    <Video size={14} />
                                    <span>Requested: Online Video Meeting (Google Meet)</span>
                                  </>
                                )}
                              </div>
                              <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                {item.notes_or_questions ? `"${item.notes_or_questions}"` : 'No specific inquiries entered at checkout.'}
                              </div>
                              <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Ticket size={13} color="#D97706" />
                                <span>Generated Deal Voucher: <strong style={{ fontFamily: 'monospace', color: '#D97706' }}>{item.voucher_code}</strong> (Value: {item.currency} {item.credit_value})</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
                            <a
                              href={`https://wa.me/${item.phone_number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `السلام عليكم ورحمة الله، الأستاذ/ة ${item.full_name} معك خدمة كبار العملاء في أصهيب العقارية بخصوص حجز استشارتك الخاصة مع الأستاذ نبيل (#${item.booking_reference}). نسعد بتنسيق موعد الجلسة في الوقت الأنسب لك.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm"
                              style={{
                                backgroundColor: '#25D366',
                                borderColor: '#25D366',
                                color: '#FFFFFF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                fontWeight: 700,
                              }}
                            >
                              <MessageCircle size={15} />
                              <span>Chat WhatsApp</span>
                            </a>

                            <a
                              href={`tel:${item.phone_number}`}
                              className="btn btn-outline btn-sm"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            >
                              <Phone size={14} />
                              <span>Call Client</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBooking(item)
                                setMeetingMode(item.preferred_meeting_mode || 'ONLINE_VIDEO')
                                setMeetingVenueOrUrl(
                                  item.preferred_meeting_mode === 'IN_PERSON_OFFICE'
                                    ? 'Asaheeb VIP Lounge, Matbouli Plaza, King Road, Jeddah'
                                    : 'https://meet.google.com/asb-vip-consult'
                                )
                                setMeetingTime('16:00')
                                setMeetingDate(new Date().toISOString().split('T')[0])
                                setConciergeNotes('')
                                setIsScheduleModalOpen(true)
                              }}
                              className="btn btn-primary btn-sm"
                              style={{
                                backgroundColor: '#D97706',
                                borderColor: '#D97706',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                fontWeight: 700,
                              }}
                            >
                              <Calendar size={14} />
                              <span>Lock In Schedule</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                )}

                {/* TAB 2: SCHEDULED UPCOMING */}
                {activeTab === 'SCHEDULED' && (
                  scheduledList.length === 0 ? (
                    <div className="card" style={{ padding: '48px 20px', textAlign: 'center', borderStyle: 'dashed' }}>
                      <Calendar size={36} color="var(--text-tertiary)" style={{ margin: '0 auto' }} />
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 12 }}>
                        No upcoming sessions scheduled
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                        Locked calendar appointments with Founder Nabeel will appear here.
                      </p>
                    </div>
                  ) : (
                    scheduledList.map((item) => (
                      <div
                        key={item.id}
                        className="card"
                        style={{
                          padding: '18px 22px',
                          borderLeft: '4px solid #0284C7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 16,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="badge" style={{ backgroundColor: '#E0F2FE', color: '#0369A1', fontWeight: 700, fontSize: 11 }}>
                              CONFIRMED SESSION
                            </span>
                            <span style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text-tertiary)' }}>
                              REF: {item.booking_reference}
                            </span>
                          </div>

                          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {item.full_name} ·{' '}
                            <span style={{ color: '#D97706', fontWeight: 700 }}>
                              {item.scheduled_date
                                ? new Date(item.scheduled_date).toLocaleString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                                : 'Date pending'}
                            </span>
                          </div>

                          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <span>Phone: <strong style={{ color: 'var(--text-primary)' }}>{item.phone_number}</strong></span>
                            <span>Format: <strong style={{ color: 'var(--text-primary)' }}>{item.confirmed_meeting_mode}</strong></span>
                            <span>Budget: <strong style={{ color: '#16A34A' }}>{item.budget_range}</strong></span>
                          </div>

                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>Venue / Link:</span>
                            <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                              {item.meeting_link_or_venue}
                            </strong>
                            {item.meeting_link_or_venue?.startsWith('http') && (
                              <a href={item.meeting_link_or_venue} target="_blank" rel="noopener noreferrer" style={{ color: '#D97706' }}>
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(item)}
                          className="btn btn-outline btn-sm"
                          style={{ color: '#16A34A', borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', fontWeight: 700 }}
                        >
                          <CheckCircle2 size={15} />
                          <span>Mark Completed &amp; Add Notes</span>
                        </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBooking(item)
                              setMeetingMode((item.confirmed_meeting_mode as any) || 'ONLINE_VIDEO')
                              setMeetingVenueOrUrl(item.meeting_link_or_venue || '')
                              if (item.scheduled_date) {
                                const [d, t] = item.scheduled_date.split('T')
                                setMeetingDate(d)
                                setMeetingTime(t ? t.slice(0, 5) : '16:00')
                              }
                              setConciergeNotes(item.concierge_notes || '')
                              setIsScheduleModalOpen(true)
                            }}
                            className="btn btn-outline btn-sm"
                          >
                            Reschedule / Edit Venue
                          </button>
                        </div>
                      </div>
                    ))
                  )
                )}

                {/* TAB 3: ACTIVE VOUCHERS */}
                {/* TAB 3: COMPLETED CONSULTATIONS & NOTES */}
                {activeTab === 'COMPLETED' && (
                  completedList.length === 0 ? (
                    <div className="card" style={{ padding: '48px 20px', textAlign: 'center', borderStyle: 'dashed' }}>
                      <CalendarCheck size={36} color="var(--text-tertiary)" style={{ margin: '0 auto' }} />
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 12 }}>
                        No completed consultations recorded yet
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                        When 1-on-1 sessions with Founder Nabeel conclude, mark them complete to log meeting notes, advisory outcomes, and client vouchers.
                      </p>
                    </div>
                  ) : (
                    completedList.map((item) => {
                      const meetingNotes = getBookingMeetingNotes(item)
                      return (
                        <div
                          key={item.id}
                          className="card"
                          style={{
                            padding: '20px 24px',
                            borderLeft: '4px solid #0284C7',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16,
                          }}
                        >
                          {/* Header Row */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 10,
                                  backgroundColor: '#E0F2FE',
                                  color: '#0284C7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: 18,
                                }}
                              >
                                {item.full_name?.charAt(0) || 'C'}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                    {item.full_name}
                                  </h3>
                                  <span
                                    className="badge"
                                    style={{ backgroundColor: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 700 }}
                                  >
                                    Session Completed ✓
                                  </span>
                                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)' }}>
                                    {item.booking_reference}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, fontSize: 12.5, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Phone size={13} color="#D97706" />
                                    <a href={`tel:${item.phone_number}`} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                      {item.phone_number}
                                    </a>
                                  </span>
                                  {item.email && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Mail size={13} color="var(--text-tertiary)" />
                                      <span>{item.email}</span>
                                    </span>
                                  )}
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MapPin size={13} color="var(--text-tertiary)" />
                                    <span>{item.city_or_country || 'Saudi Arabia'}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Session Info */}
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>
                                Consultation Concluded
                              </div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0284C7', marginTop: 2 }}>
                                {item.scheduled_date
                                  ? new Date(item.scheduled_date).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })
                                  : 'Session Completed'}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                                {item.confirmed_meeting_mode === 'IN_PERSON_OFFICE'
                                  ? '🏢 In-Person VIP Lounge (Matbouli Plaza)'
                                  : item.confirmed_meeting_mode === 'ON_SITE_WALKTHROUGH'
                                    ? '🏗️ On-Site Walkthrough'
                                    : '🖥️ Online Google Meet'}
                              </div>
                            </div>
                          </div>

                          {/* Client Intent & Inquiry */}
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: 'var(--bg-subtle, #F8FAFC)',
                              borderRadius: 8,
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 12,
                              fontSize: 12.5,
                            }}
                          >
                            <div>
                              <span style={{ color: 'var(--text-tertiary)' }}>Buyer Intent: </span>
                              <strong style={{ color: 'var(--text-primary)' }}>{item.buyer_intent?.replace(/_/g, ' ') || 'High Yield'}</strong>
                              <span style={{ margin: '0 8px', color: 'var(--border)' }}>•</span>
                              <span style={{ color: 'var(--text-tertiary)' }}>Budget: </span>
                              <strong style={{ color: '#D97706' }}>{item.budget_range || 'SAR 2M – 4M'}</strong>
                            </div>
                            {item.notes_or_questions && (
                              <div style={{ color: 'var(--text-secondary)', maxWidth: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>Inquiry: </span>"{item.notes_or_questions}"
                              </div>
                            )}
                          </div>

                          {/* MEETING NOTES & ADVISORY SUMMARY */}
                          <div
                            style={{
                              padding: '14px 18px',
                              backgroundColor: '#FFFDF5',
                              border: '1px solid #FDE68A',
                              borderRadius: 8,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#92400E' }}>
                                <FileText size={15} color="#D97706" />
                                <span>Founder Nabeel's Advisory Summary &amp; Meeting Notes</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenEditNotesModal(item)}
                                className="btn btn-outline btn-xs"
                                style={{ fontSize: 11, borderColor: '#FCD34D', color: '#92400E', backgroundColor: '#FFFFFF' }}
                              >
                                <Edit3 size={12} />
                                <span>{meetingNotes ? 'Edit Meeting Notes' : '+ Add Meeting Notes'}</span>
                              </button>
                            </div>

                            {meetingNotes ? (
                              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#451A03', whiteSpace: 'pre-wrap' }}>
                                {meetingNotes}
                              </p>
                            ) : (
                              <p style={{ margin: 0, fontSize: 12.5, fontStyle: 'italic', color: '#B45309' }}>
                                No advisory notes recorded yet for this session. Click "+ Add Meeting Notes" to document client recommendations, preferred units, and next steps.
                              </p>
                            )}
                          </div>

                          {/* Bottom Actions & Voucher Status */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 12,
                              paddingTop: 10,
                              borderTop: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Ticket size={16} color={item.voucher_status === 'REDEEMED' ? '#4F46E5' : '#16A34A'} />
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                  {item.voucher_code}
                                </span>
                              </div>
                              {item.voucher_status === 'REDEEMED' ? (
                                <span
                                  className="badge"
                                  style={{ backgroundColor: '#EEF2FF', color: '#3730A3', fontSize: 11, fontWeight: 700 }}
                                >
                                  ✓ Redeemed on Deal: {item.redeemed_deal_id || getRedeemedDealRef(item)}
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{ backgroundColor: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 700 }}
                                >
                                  Active SAR {item.credit_value} Voucher Credit
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {item.voucher_status === 'ACTIVE' && canManage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBooking(item)
                                    setDealId('')
                                    setIsRedeemModalOpen(true)
                                  }}
                                  className="btn btn-outline btn-sm"
                                  style={{ color: '#16A34A', borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', fontWeight: 700 }}
                                >
                                  Redeem on Deal
                                </button>
                              )}
                              <a
                                href={`https://wa.me/${item.phone_number?.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline btn-sm"
                                style={{ color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}
                              >
                                <MessageCircle size={14} />
                                <span>WhatsApp</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )
                )}

                {/* TAB 4: ACTIVE VOUCHERS */}
                {activeTab === 'ACTIVE_VOUCHERS' && (
                  activeVouchersList.length === 0 ? (
                    <div className="card" style={{ padding: '48px 20px', textAlign: 'center', borderStyle: 'dashed' }}>
                      <Ticket size={36} color="var(--text-tertiary)" style={{ margin: '0 auto' }} />
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 12 }}>
                        No active vouchers awaiting redemption
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                        When consultations are marked completed, the client's SAR 500 voucher becomes active here.
                      </p>
                    </div>
                  ) : (
                    activeVouchersList.map((item) => (
                      <div
                        key={item.id}
                        className="card"
                        style={{
                          padding: '18px 22px',
                          borderLeft: '4px solid #16A34A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 16,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#D97706' }}>
                              {item.voucher_code}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(item.voucher_code, `v-${item.id}`)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}
                            >
                              {copiedId === `v-${item.id}` ? <Check size={14} color="#16A34A" /> : <Copy size={14} />}
                            </button>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            Client Holder: <strong style={{ color: 'var(--text-primary)' }}>{item.full_name}</strong> ·{' '}
                            <a href={`tel:${item.phone_number}`} style={{ color: '#D97706', fontWeight: 600 }}>
                              {item.phone_number}
                            </a>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                            Consultation delivered · Valid towards down payment / booking token
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#16A34A' }}>
                              {item.currency} {item.credit_value} Credit
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                              Applicable to any off-plan or resale deal
                            </div>
                          </div>

                          {canManage && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBooking(item)
                                setDealId('')
                                setIsRedeemModalOpen(true)
                              }}
                              className="btn btn-primary btn-sm"
                              style={{ backgroundColor: '#16A34A', borderColor: '#16A34A' }}
                            >
                              Redeem on Deal
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )
                )}

                {/* TAB 4: DEALS REDEEMED */}
                {activeTab === 'REDEEMED' && (
                  redeemedVouchersList.length === 0 ? (
                    <div className="card" style={{ padding: '48px 20px', textAlign: 'center', borderStyle: 'dashed' }}>
                      <ShieldCheck size={36} color="var(--text-tertiary)" style={{ margin: '0 auto' }} />
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 12 }}>
                        No redeemed vouchers recorded yet
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                        Vouchers applied to property deal closures will appear here for audit logging.
                      </p>
                    </div>
                  ) : (
                    redeemedVouchersList.map((item) => (
                      <div
                        key={item.id}
                        className="card"
                        style={{
                          padding: '18px 22px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 16,
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: 'monospace', textDecoration: 'line-through', color: 'var(--text-tertiary)', fontSize: 14 }}>
                            {item.voucher_code}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                            {item.full_name}{' '}
                            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                              (Redeemed on Deal: {item.redeemed_deal_id || getRedeemedDealRef(item) || 'Recorded Deal'})
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            Redeemed at: {item.redeemed_at ? new Date(item.redeemed_at).toLocaleDateString() : 'Recorded'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>
                            ✓ Deducted {item.currency} {item.credit_value} from Deal Token
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            Acquisition Credit Settled
                          </div>
                        </div>
                      </div>
                    ))
                  )
                )}

                {/* TAB 5: UNBOOKED / ABANDONED CHECKOUTS */}
                {activeTab === 'ABANDONED_CHECKOUT' && (
                  abandonedCheckoutList.length === 0 ? (
                    <div className="card" style={{ padding: '48px 20px', textAlign: 'center', borderStyle: 'dashed' }}>
                      <ShoppingCart size={36} color="var(--text-tertiary)" style={{ margin: '0 auto' }} />
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 12 }}>
                        No abandoned checkouts or unbooked carts
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                        When users initiate consultation booking checkout on the website but drop off before payment completion, their inquiry dossier appears here for sales triage and recovery.
                      </p>
                    </div>
                  ) : (
                    abandonedCheckoutList.map((item) => {
                      const clientPhone = item.phone_number?.replace(/[^0-9]/g, '') || ''
                      const recoveryMessage = encodeURIComponent(
                        `Hello ${item.full_name}, this is the concierge from Asaheeb Real Estate regarding your 1-on-1 strategic consultation session with Founder Nabeel. We noticed your checkout was started but payment was not finalized. Can we assist you with alternative payment methods (Mada, Apple Pay, or direct bank transfer)?`
                      )
                      return (
                        <div
                          key={item.id}
                          className="card"
                          style={{
                            padding: '20px 24px',
                            borderLeft: '4px solid #D97706',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14,
                            backgroundColor: '#FFFDF9',
                          }}
                        >
                          {/* Top Row: Client Info & Status Badge */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 10,
                                  backgroundColor: '#FEF3C7',
                                  color: '#B45309',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: 18,
                                }}
                              >
                                {item.full_name?.charAt(0) || 'C'}
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                    {item.full_name}
                                  </h3>
                                  <span
                                    className="badge"
                                    style={{
                                      backgroundColor: '#FEE2E2',
                                      color: '#991B1B',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      border: '1px solid #FECACA',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <AlertCircle size={11} />
                                    <span>Checkout Left In Cart · Payment Pending</span>
                                  </span>
                                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-tertiary)' }}>
                                    {item.booking_reference}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, fontSize: 12.5, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Phone size={13} color="#D97706" />
                                    <a href={`tel:${item.phone_number}`} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                      {item.phone_number}
                                    </a>
                                  </span>
                                  {item.email && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Mail size={13} color="var(--text-tertiary)" />
                                      <span>{item.email}</span>
                                    </span>
                                  )}
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <MapPin size={13} color="var(--text-tertiary)" />
                                    <span>{item.city_or_country || 'Saudi Arabia'}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Drop-off / Cart Details */}
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: '#991B1B', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                <Clock size={12} />
                                <span>Cart Dropped Off</span>
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                                {item.created_at
                                  ? new Date(item.created_at).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })
                                  : 'Recently'}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                <CreditCard size={12} />
                                <span>Gateway Attempted: <strong>{item.payment_gateway || 'ONLINE'}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Client Buyer Dossier */}
                          <div
                            style={{
                              padding: '10px 14px',
                              backgroundColor: '#FFFFFF',
                              borderRadius: 8,
                              border: '1px solid #FED7AA',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 12,
                              fontSize: 12.5,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span>
                                <span style={{ color: 'var(--text-tertiary)' }}>Buyer Intent: </span>
                                <strong style={{ color: 'var(--text-primary)' }}>{item.buyer_intent?.replace(/_/g, ' ') || 'High Yield'}</strong>
                              </span>
                              <span style={{ color: 'var(--border)' }}>•</span>
                              <span>
                                <span style={{ color: 'var(--text-tertiary)' }}>Budget: </span>
                                <strong style={{ color: '#D97706' }}>{item.budget_range || 'SAR 1M – 3M'}</strong>
                              </span>
                              <span style={{ color: 'var(--border)' }}>•</span>
                              <span>
                                <span style={{ color: 'var(--text-tertiary)' }}>Format Preference: </span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {item.preferred_meeting_mode === 'IN_PERSON_OFFICE'
                                    ? '🏢 In-Person VIP Lounge'
                                    : '🖥️ Online Video (Google Meet)'}
                                </strong>
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#991B1B' }}>
                              <span>Unpaid Fee: {item.currency || 'SAR'} {item.amount_paid || 500}</span>
                            </div>
                          </div>

                          {/* Client Inquiry Notes if provided */}
                          {item.notes_or_questions && (
                            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', padding: '6px 12px', backgroundColor: '#F8FAFC', borderRadius: 6, border: '1px solid var(--border)' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>Client Note at Checkout: </strong>
                              "{item.notes_or_questions}"
                            </div>
                          )}

                          {/* Bottom Action Bar for Recovery */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 12,
                              paddingTop: 10,
                              borderTop: '1px solid #FED7AA',
                            }}
                          >
                            <div style={{ fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <AlertCircle size={14} color="#D97706" />
                              <span>High-intent VIP client dropped off before paying. Contact them to rescue this booking!</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <a
                                href={`https://wa.me/${clientPhone}?text=${recoveryMessage}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline btn-sm"
                                style={{ color: '#16A34A', borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                              >
                                <MessageCircle size={14} />
                                <span>Recover via WhatsApp</span>
                              </a>

                              <a
                                href={`tel:${item.phone_number}`}
                                className="btn btn-outline btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                              >
                                <Phone size={14} />
                                <span>Call Client</span>
                              </a>

                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsPaid(item)}
                                  className="btn btn-primary btn-sm"
                                  style={{ backgroundColor: '#16A34A', borderColor: '#16A34A', fontWeight: 700 }}
                                  title="Mark as paid if client settled offline via cash, POS or wire transfer"
                                >
                                  <CheckCircle2 size={14} />
                                  <span>Mark Paid (Offline/Recovered)</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )
                )}
              </>
            )}
          </div>
        </div>

        {/* ─── MODAL 1: SCHEDULE WITH FOUNDER NABEEL ─── */}
        {isScheduleModalOpen && selectedBooking && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    VIP Coordination Lock
                  </span>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                    Lock In Session with Founder Nabeel
                  </h3>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Client: <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.full_name}</strong> ({selectedBooking.phone_number})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSchedule} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Meeting Date</label>
                    <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>Sat – Thu (Sunday is holiday)</span>
                  </div>
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => {
                      const sel = new Date(e.target.value)
                      if (sel.getUTCDay() === 0) {
                        alert('Note: Sunday is an advisory holiday for Founder Nabeel. Consultations operate Saturday through Thursday.')
                      }
                      setMeetingDate(e.target.value)
                    }}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Meeting Time (Riyadh Time GMT+3)</label>
                  <input
                    type="time"
                    required
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Delivery Format</label>
                  <select
                    value={meetingMode}
                    onChange={(e: any) => {
                      const mode = e.target.value
                      setMeetingMode(mode)
                      if (mode === 'IN_PERSON_OFFICE') {
                        setMeetingVenueOrUrl('Asaheeb VIP Lounge, Matbouli Plaza, King Road, Jeddah')
                      } else if (mode === 'ONLINE_VIDEO') {
                        setMeetingVenueOrUrl('https://meet.google.com/asb-vip-consult')
                      } else {
                        setMeetingVenueOrUrl('On-Site Project Site Walkthrough (Jeddah Prime Development)')
                      }
                    }}
                    className="form-select"
                  >
                    <option value="ONLINE_VIDEO">🖥️ Online Video (Google Meet / Zoom)</option>
                    <option value="IN_PERSON_OFFICE">🏢 In-Person VIP Lounge (Matbouli Plaza, Jeddah)</option>
                    <option value="ON_SITE_WALKTHROUGH">🏗️ On-Site Property Walkthrough</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Google Meet Link or Venue Address</label>
                  <input
                    type="text"
                    required
                    value={meetingVenueOrUrl}
                    onChange={(e) => setMeetingVenueOrUrl(e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Concierge Coordination Notes</label>
                  <textarea
                    rows={2}
                    value={conciergeNotes}
                    onChange={(e) => setConciergeNotes(e.target.value)}
                    placeholder="Notes from customer phone call (e.g. Client confirmed 4:00 PM slot, focus on waterfront apartments)..."
                    className="form-textarea"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(false)}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSchedule}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#D97706', borderColor: '#D97706', fontWeight: 700 }}
                  >
                    {isSavingSchedule ? 'Locking...' : 'Confirm & Lock Schedule'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 2: REDEEM VOUCHER ON DEAL ─── */}
        {isRedeemModalOpen && selectedBooking && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{ padding: 24, maxWidth: 460 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Deal Credit Redemption
                  </span>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                    Apply Voucher to Property Deal
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRedeemModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRedeemVoucher} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                  <div>Client: <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.full_name}</strong></div>
                  <div style={{ marginTop: 4 }}>Voucher: <strong style={{ color: '#D97706', fontFamily: 'monospace' }}>{selectedBooking.voucher_code}</strong></div>
                  <div style={{ marginTop: 4 }}>Credit Value: <strong style={{ color: '#16A34A' }}>{selectedBooking.currency} {selectedBooking.credit_value}</strong></div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Closed Deal / Unit Reference</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DEAL-2026-NBL-04 / Marafy Tower Unit 14B"
                    value={dealId}
                    onChange={(e) => setDealId(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setIsRedeemModalOpen(false)}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRedeeming}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#16A34A', borderColor: '#16A34A', fontWeight: 700 }}
                  >
                    {isRedeeming ? 'Applying...' : 'Confirm Redemption'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 3: GLOBAL SETTINGS ─── */}
        {isSettingsModalOpen && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Engine Controls
                  </span>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                    Global Consultation Settings
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSettings} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Weekly Slot Capacity (Max sessions per week for Founder Nabeel)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(Number(e.target.value))}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="form-label" style={{ margin: 0 }}>Commitment Fee (SAR)</label>
                    <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>Supports decimals (e.g. 0.1 for live test)</span>
                  </div>
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    value={editFee}
                    onChange={(e) => setEditFee(parseFloat(e.target.value) || 0)}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Credit Multiplier (1.0 = 100% Refund Voucher, 2.0 = 2x Promo)</label>
                  <select
                    value={editMultiplier}
                    onChange={(e) => setEditMultiplier(Number(e.target.value))}
                    className="form-select"
                  >
                    <option value={1.0}>1.0x (100% Refund Voucher = SAR {editFee})</option>
                    <option value={2.0}>2.0x (Double Credit Promo = SAR {editFee * 2})</option>
                    <option value={3.0}>3.0x (Triple Credit Promo = SAR {editFee * 3})</option>
                  </select>
                </div>

                {/* Booking Engine Master Toggle & Pause Controls */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 8,
                    border: editIsActive ? '1px solid #BBF7D0' : '1px solid #FECACA',
                    backgroundColor: editIsActive ? '#F0FDF4' : '#FEF2F2',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: editIsActive ? '#166534' : '#991B1B' }}>
                        {editIsActive ? '🟢 Website Booking Engine: ACTIVE' : '⏸️ Website Booking Engine: PAUSED / STOPPED'}
                      </div>
                      <div style={{ fontSize: 11.5, color: editIsActive ? '#15803D' : '#B91C1C', marginTop: 2 }}>
                        {editIsActive
                          ? 'Clients can book and pay for consultations on the website.'
                          : 'Checkout is suspended on the website. Visitors see your pause notice.'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !editIsActive
                        setEditIsActive(next)
                        if (!next && !editBannerEn) {
                          setEditBannerEn('Consultations are temporarily closed for this week. Bookings will resume shortly.')
                        }
                      }}
                      className="btn btn-sm"
                      style={{
                        backgroundColor: editIsActive ? '#DC2626' : '#16A34A',
                        color: '#FFFFFF',
                        borderColor: editIsActive ? '#DC2626' : '#16A34A',
                        fontWeight: 700,
                      }}
                    >
                      {editIsActive ? 'Pause Bookings' : 'Resume Bookings'}
                    </button>
                  </div>

                  {!editIsActive && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px dashed #FECACA' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#991B1B', width: '100%' }}>
                        Quick Pause Presets (fills website banner):
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditBannerEn(`Founder Nabeel is traveling. Advisory bookings are paused for ${settings?.current_week_cycle || 'this week'}. Bookings resume next Sunday.`)
                        }
                        className="btn btn-outline btn-xs"
                        style={{ fontSize: 10.5, borderColor: '#FCA5A5', color: '#991B1B', backgroundColor: '#FFFFFF' }}
                      >
                        Stop for this Week
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditBannerEn('All weekly slots fully booked. VIP consultation booking opens next Sunday at 9:00 AM.')
                        }
                        className="btn btn-outline btn-xs"
                        style={{ fontSize: 10.5, borderColor: '#FCA5A5', color: '#991B1B', backgroundColor: '#FFFFFF' }}
                      >
                        Slots Full (Resume Sunday)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditBannerEn('Private consultations paused for summit negotiations. Inquiries open via WhatsApp.')
                        }
                        className="btn btn-outline btn-xs"
                        style={{ fontSize: 10.5, borderColor: '#FCA5A5', color: '#991B1B', backgroundColor: '#FFFFFF' }}
                      >
                        Summit / Travel Pause
                      </button>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Custom Scarcity / Pause Banner (English)</label>
                  <input
                    type="text"
                    placeholder="e.g. Founder traveling for Riyadh Summit; booking open for next week"
                    value={editBannerEn}
                    onChange={(e) => setEditBannerEn(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setIsSettingsModalOpen(false)}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#D97706', borderColor: '#D97706', fontWeight: 700 }}
                  >
                    {isSavingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 4: SIMULATE WEBSITE BOOKING ─── */}
        {isTestBookingModalOpen && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{ padding: 24, maxWidth: 460 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Website Booking Simulator
                  </span>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                    Simulate New VIP Website Checkout
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTestBookingModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTestBooking} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    value={testFullName}
                    onChange={(e) => setTestFullName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    required
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    required
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Budget</label>
                    <select
                      value={testBudget}
                      onChange={(e) => setTestBudget(e.target.value)}
                      className="form-select"
                    >
                      <option value="SAR 1M – 2M">SAR 1M – 2M</option>
                      <option value="SAR 2M – 4M">SAR 2M – 4M</option>
                      <option value="SAR 5M – 10M">SAR 5M – 10M</option>
                      <option value="SAR 10M+">SAR 10M+ VIP</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Format</label>
                    <select
                      value={testMode}
                      onChange={(e: any) => setTestMode(e.target.value)}
                      className="form-select"
                    >
                      <option value="ONLINE_VIDEO">🖥️ Online Video</option>
                      <option value="IN_PERSON_OFFICE">🏢 In-Person VIP</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setIsTestBookingModalOpen(false)}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTest}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#D97706', borderColor: '#D97706', fontWeight: 700 }}
                  >
                    {isSubmittingTest ? 'Creating...' : 'Create Booking'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 5: COMPLETE CONSULTATION & RECORD NOTES ─── */}
        {isCompleteModalOpen && selectedBooking && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{ padding: 24, maxWidth: 540 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Session Completion &amp; Voucher Unlock
                  </span>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                    Mark Consultation Completed
                  </h3>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Client: <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.full_name}</strong> ·{' '}
                    <span style={{ fontFamily: 'monospace' }}>{selectedBooking.booking_reference}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmCompleteWithNotes} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: '12px 14px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, fontSize: 12.5, color: '#166534' }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={15} color="#16A34A" />
                    <span>Founder Nabeel 1-on-1 Session Delivery Confirmation</span>
                  </div>
                  <div style={{ marginTop: 4, color: '#15803D' }}>
                    Marking this session completed will automatically activate the client's <strong>SAR {selectedBooking.credit_value} property voucher</strong> ({selectedBooking.voucher_code}), making it eligible to deduct towards deal token fees.
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                      Advisory Summary &amp; Meeting Notes
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Saved in consultation records</span>
                  </div>
                  <textarea
                    rows={4}
                    value={meetingNotesInput}
                    onChange={(e) => setMeetingNotesInput(e.target.value)}
                    placeholder="Summarize key discussions, client preferences (e.g. 3-bedroom in Irqah / Marafy Tower), recommended projects, pricing discussed, and next follow-up milestones..."
                    className="form-textarea"
                    style={{ lineHeight: 1.5, fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setIsCompleteModalOpen(false)}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingNotes}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#16A34A', borderColor: '#16A34A', fontWeight: 700 }}
                  >
                    {isSavingNotes ? 'Completing...' : 'Confirm Session Completed & Save Notes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 6: EDIT COMPLETED MEETING NOTES ─── */}
        {isEditNotesModalOpen && selectedBooking && (
          <div className="modal-backdrop">
            <div className="modal-box" style={{ padding: 24, maxWidth: 540 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Advisory Documentation
                  </span>
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                    Consultation Meeting Notes
                  </h3>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Client: <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.full_name}</strong> ({selectedBooking.phone_number})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditNotesModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveOnlyMeetingNotes} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Founder Nabeel's Advisory Summary &amp; Notes
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={meetingNotesInput}
                    onChange={(e) => setMeetingNotesInput(e.target.value)}
                    placeholder="Record client requirements, properties recommended, price expectations, agreed next steps..."
                    className="form-textarea"
                    style={{ lineHeight: 1.5, fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditNotesModalOpen(false)}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingNotes}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#0284C7', borderColor: '#0284C7', fontWeight: 700 }}
                  >
                    {isSavingNotes ? 'Saving...' : 'Save Meeting Notes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }
