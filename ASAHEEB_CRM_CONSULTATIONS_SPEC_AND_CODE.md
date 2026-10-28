# Asaheeb Real Estate CRM — Founder Consultation & VIP Pipeline Specification
**Document Version:** 1.0 (Production Blueprint & Complete Code)  
**Target Systems:** Asaheeb CRM Portal (`Next.js / TypeScript / Tailwind CSS / Supabase`)  
**Database:** Supabase PostgreSQL (`zqmrubwzhxpigncueqig`)  
**Scope:** VIP booking triage, concierge phone scheduling, Google Meet / in-person calendar locks, dynamic capacity controls, and property deal voucher redemption.

---

## 1. CRM Architecture & Complete Separation from Leads

> [!IMPORTANT]
> **Zero Leads Table Pollution:**
> VIP Consultations do **NOT** write to, touch, or alter `public.leads`. 
> Standard sales reps working on normal property inquiries in `/leads` will never have their pipeline cluttered by consultation bookings.
> Consultations are stored in a 100% isolated table (`public.consultation_bookings`) and are displayed in their own dedicated CRM navigation tab: **`/consultations`**.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  CRM Navigation:   [ Leads ]   [ Projects ]   [ ⚡ VIP Consultations (3) ]   [ Settings ]               │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ← VIP Advisory Pipeline                                                   [ ⚙️ Consultation Settings ] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  ⚡ Weekly Capacity: 7 / 10 Booked   |   🔥 3 Allocations Remaining   |   💰 Advance Revenue: SAR 3,500 │
├──────────────────────┬──────────────────────────┬─────────────────────────────┬────────────────────────┤
│ 🚨 Needs Scheduling  │ 📅 Scheduled Upcoming    │ 💎 Active Vouchers (Credit) │ ✅ Deals Redeemed      │
│        (3)           │           (4)            │             (12)            │          (5)           │
├──────────────────────┴──────────────────────────┴─────────────────────────────┴────────────────────────┤
│                                                                                                        │
│  [CARD 1] 🟢 SAR 500 PAID · 42 mins ago                                             [ + Schedule Call ] │
│  👤 Eng. Sultan Al-Ghamdi · +966 50 123 4567 · Jeddah                                                  │
│  🏷️ Budget: SAR 1M – 3M · High Rental Yield (Residential Apartments)                                   │
│  🏛️ Mode: In-Person Office (Matbouli Plaza VIP Lounge)                                                 │
│  📋 Notes: "Interested in North Jeddah off-plan options with 3-year developer installments."           │
│  🎟️ Voucher Issued: VOUCHER-500-NBL-8921 (Value: SAR 500)                                              │
│  [💬 Open WhatsApp]   [📞 Call Client]                                                                 │
│                                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Supabase SQL Migration Instructions

Run the script located in:
📄 **`supabase/founder_consultation_monetization_migration.sql`**

It automatically:
1. Upgrades `public.leads.source` check constraint to support `'VIP_PAID_CONSULTATION'`.
2. Creates `public.consultation_settings` (pricing, capacity, multiplier, banner controls).
3. Creates `public.consultation_bookings` (full client dossier, payment status, voucher codes, scheduling states).
4. Creates automatic database trigger `trigger_sync_consultation_slot_counter` to keep slot counts synchronized.
5. Applies Row Level Security (RLS) policies allowing public checkout inserts and authenticated CRM management.

---

## 3. Complete Drop-In CRM Component Code

Create this file in your CRM project at:
📂 **`src/components/consultations/ConsultationsCRMView.tsx`** (or `src/app/(crm)/consultations/page.tsx`).

```tsx
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase"; // Use your CRM Supabase client instance

interface ConsultationBooking {
  id: string;
  booking_reference: string;
  full_name: string;
  phone_number: string;
  email: string;
  city_or_country: string;
  buyer_intent: string;
  budget_range: string;
  preferred_meeting_mode: "ONLINE_VIDEO" | "IN_PERSON_OFFICE" | "ON_SITE_WALKTHROUGH";
  notes_or_questions?: string;
  amount_paid: number;
  currency: string;
  payment_gateway: string;
  payment_status: string;
  paid_at: string;
  voucher_code: string;
  credit_value: number;
  voucher_status: "ACTIVE" | "REDEEMED" | "EXPIRED";
  week_cycle: string;
  status: "PAID_UNSCHEDULED" | "SCHEDULED" | "COMPLETED" | "CANCELLED_REFUNDED";
  scheduled_date?: string;
  confirmed_meeting_mode?: string;
  meeting_link_or_venue?: string;
  concierge_notes?: string;
  created_at: string;
}

interface ConsultationSettings {
  is_active: boolean;
  fee_amount: number;
  currency: string;
  credit_multiplier: number;
  weekly_slot_capacity: number;
  slots_booked_this_week: number;
  current_week_cycle: string;
  custom_urgency_banner_en?: string;
  custom_urgency_banner_ar?: string;
}

export default function ConsultationsCRMView() {
  const [activeTab, setActiveTab] = useState<"NEEDS_SCHEDULING" | "SCHEDULED" | "ACTIVE_VOUCHERS" | "REDEEMED">("NEEDS_SCHEDULING");
  const [bookings, setBookings] = useState<ConsultationBooking[]>([]);
  const [settings, setSettings] = useState<ConsultationSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [selectedBooking, setSelectedBooking] = useState<ConsultationBooking | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Schedule Modal Inputs
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingMode, setMeetingMode] = useState<"ONLINE_VIDEO" | "IN_PERSON_OFFICE">("ONLINE_VIDEO");
  const [meetingVenueOrUrl, setMeetingVenueOrUrl] = useState("https://meet.google.com/");
  const [conciergeNotes, setConciergeNotes] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Settings Modal Inputs
  const [editFee, setEditFee] = useState(500);
  const [editCapacity, setEditCapacity] = useState(10);
  const [editMultiplier, setEditMultiplier] = useState(1.0);
  const [editIsActive, setEditIsActive] = useState(true);
  const [editBannerEn, setEditBannerEn] = useState("");

  // 1. Fetch Bookings and Settings from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Settings
      const { data: settingsData } = await supabase
        .from("consultation_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData);
        setEditFee(settingsData.fee_amount);
        setEditCapacity(settingsData.weekly_slot_capacity);
        setEditMultiplier(settingsData.credit_multiplier);
        setEditIsActive(settingsData.is_active);
        setEditBannerEn(settingsData.custom_urgency_banner_en || "");
      }

      // Fetch Bookings
      const { data: bookingsData } = await supabase
        .from("consultation_bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (bookingsData) {
        setBookings(bookingsData);
      }
    } catch (err) {
      console.error("Failed to fetch CRM consultation data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Bookings by Tab
  const needsSchedulingList = bookings.filter((b) => b.status === "PAID_UNSCHEDULED");
  const scheduledList = bookings.filter((b) => b.status === "SCHEDULED");
  const activeVouchersList = bookings.filter((b) => b.status === "COMPLETED" && b.voucher_status === "ACTIVE");
  const redeemedVouchersList = bookings.filter((b) => b.voucher_status === "REDEEMED");

  // 2. Handle Lock-In Schedule with Nabeel
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setIsSavingSchedule(true);
    const combinedDateTime = `${meetingDate}T${meetingTime}:00Z`;

    try {
      const { error } = await supabase
        .from("consultation_bookings")
        .update({
          status: "SCHEDULED",
          scheduled_date: combinedDateTime,
          confirmed_meeting_mode: meetingMode,
          meeting_link_or_venue: meetingVenueOrUrl,
          concierge_notes: conciergeNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedBooking.id);

      if (!error) {
        setIsScheduleModalOpen(false);
        setSelectedBooking(null);
        fetchData();
      } else {
        alert("Failed to update schedule in Supabase: " + error.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  // 3. Handle Mark Completed (Unlock Voucher)
  const handleMarkCompleted = async (bookingId: string) => {
    if (!confirm("Confirm that Nabeel has completed this consultation session?")) return;

    const { error } = await supabase
      .from("consultation_bookings")
      .update({
        status: "COMPLETED",
        voucher_status: "ACTIVE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (!error) fetchData();
  };

  // 4. Handle Save Global Settings
  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from("consultation_settings")
        .update({
          fee_amount: editFee,
          weekly_slot_capacity: editCapacity,
          credit_multiplier: editMultiplier,
          is_active: editIsActive,
          custom_urgency_banner_en: editBannerEn,
          updated_at: new Date().toISOString(),
        })
        .match({ is_active: true });

      if (!error) {
        setIsSettingsModalOpen(false);
        fetchData();
      } else {
        alert("Error saving settings: " + error.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-amber-500 font-bold">
              Executive VIP Pipeline
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-100 font-serif mt-1">
            Founder Strategic Consultations & Vouchers
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            1-on-1 Sessions with Founder Nabeel · Weekly Capacity Management & Credit Redemption
          </p>
        </div>

        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-mono tracking-wider uppercase border border-gray-700 flex items-center gap-2 cursor-pointer transition-all"
        >
          <span>⚙️</span>
          <span>Consultation Settings</span>
        </button>
      </div>

      {/* Real-Time Metrics Bar */}
      {settings && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Weekly Quota</div>
            <div className="text-2xl font-bold text-amber-500 font-serif mt-1">
              {settings.slots_booked_this_week} / {settings.weekly_slot_capacity}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              {Math.max(0, settings.weekly_slot_capacity - settings.slots_booked_this_week)} allocations remaining
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Commitment Fee</div>
            <div className="text-2xl font-bold text-gray-100 font-serif mt-1">
              {settings.currency} {settings.fee_amount}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1">
              {settings.credit_multiplier}x Acquisition Credit ({settings.currency} {settings.fee_amount * settings.credit_multiplier})
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Awaiting Coordination</div>
            <div className="text-2xl font-bold text-rose-400 font-serif mt-1">
              {needsSchedulingList.length} Clients
            </div>
            <div className="text-[11px] text-rose-300 mt-1">Requires 60-min callback</div>
          </div>

          <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
            <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Advance Retainer Inflow</div>
            <div className="text-2xl font-bold text-gray-100 font-serif mt-1">
              {settings.currency} {(bookings.length * settings.fee_amount).toLocaleString()}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">Total {bookings.length} paid consultations</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800 gap-2">
        <button
          onClick={() => setActiveTab("NEEDS_SCHEDULING")}
          className={`px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 font-bold flex items-center gap-2 cursor-pointer ${
            activeTab === "NEEDS_SCHEDULING"
              ? "border-amber-500 text-amber-400 bg-amber-500/10"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>🚨 Needs Scheduling</span>
          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px]">
            {needsSchedulingList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("SCHEDULED")}
          className={`px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 font-bold flex items-center gap-2 cursor-pointer ${
            activeTab === "SCHEDULED"
              ? "border-amber-500 text-amber-400 bg-amber-500/10"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>📅 Scheduled Upcoming</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-[10px]">
            {scheduledList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ACTIVE_VOUCHERS")}
          className={`px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 font-bold flex items-center gap-2 cursor-pointer ${
            activeTab === "ACTIVE_VOUCHERS"
              ? "border-amber-500 text-amber-400 bg-amber-500/10"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>💎 Active Vouchers</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-[10px]">
            {activeVouchersList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("REDEEMED")}
          className={`px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 font-bold flex items-center gap-2 cursor-pointer ${
            activeTab === "REDEEMED"
              ? "border-amber-500 text-amber-400 bg-amber-500/10"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <span>✅ Deals Redeemed</span>
          <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-[10px]">
            {redeemedVouchersList.length}
          </span>
        </button>
      </div>

      {/* Bookings Card List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm font-mono animate-pulse">
            Loading VIP Consultations...
          </div>
        ) : (
          <>
            {/* Tab 1: Needs Scheduling */}
            {activeTab === "NEEDS_SCHEDULING" && (
              needsSchedulingList.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm font-mono border border-dashed border-gray-800 rounded-xl">
                  ✓ All paid consultations have been scheduled. Great job!
                </div>
              ) : (
                needsSchedulingList.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-gray-900 border border-amber-500/40 hover:border-amber-500 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold uppercase">
                          ✓ PAID {item.currency} {item.amount_paid}
                        </span>
                        <span className="text-xs font-mono text-gray-400 font-semibold">
                          REF: {item.booking_reference}
                        </span>
                        <span className="text-xs text-gray-500">· {new Date(item.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="text-lg font-bold text-gray-100 font-serif">
                        {item.full_name}{" "}
                        <span className="text-xs font-sans text-gray-400 font-normal">({item.city_or_country})</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-300">
                        <span>
                          📞 <a href={`tel:${item.phone_number}`} className="text-amber-400 font-mono hover:underline">{item.phone_number}</a>
                        </span>
                        <span>💰 Budget: <strong className="text-emerald-400">{item.budget_range}</strong></span>
                        <span>🎯 Goal: <strong>{item.buyer_intent}</strong></span>
                      </div>

                      <div className="text-xs text-gray-400 bg-gray-950 p-3 rounded-lg border border-gray-800">
                        <div className="text-[10px] font-mono text-amber-500 uppercase">
                          Requested Mode: {item.preferred_meeting_mode === "IN_PERSON_OFFICE" ? "🏢 In-Person (Asaheeb HQ Lounge)" : "🖥️ Online Video"}
                        </div>
                        {item.notes_or_questions ? (
                          <div className="mt-1 text-gray-300 italic">"{item.notes_or_questions}"</div>
                        ) : (
                          <div className="mt-1 text-gray-500">No specific questions entered by client.</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
                      <a
                        href={`https://wa.me/${item.phone_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                          `Hello ${item.full_name}, this is Asaheeb Real Estate VIP concierge following up on your consultation reservation with Founder Nabeel (#${item.booking_reference}).`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold tracking-wider uppercase transition-all text-center flex items-center justify-center gap-2"
                      >
                        <span>💬 WhatsApp</span>
                      </a>

                      <button
                        onClick={() => {
                          setSelectedBooking(item);
                          setMeetingMode(item.preferred_meeting_mode === "IN_PERSON_OFFICE" ? "IN_PERSON_OFFICE" : "ONLINE_VIDEO");
                          setMeetingVenueOrUrl(item.preferred_meeting_mode === "IN_PERSON_OFFICE" ? "Asaheeb VIP Lounge, Matbouli Plaza, Jeddah" : "https://meet.google.com/asb-vip-meeting");
                          setIsScheduleModalOpen(true);
                        }}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-bold tracking-wider uppercase font-mono shadow-md transition-all cursor-pointer text-center"
                      >
                        + Schedule with Nabeel
                      </button>
                    </div>
                  </div>
                ))
              )
            )}

            {/* Tab 2: Scheduled Upcoming */}
            {activeTab === "SCHEDULED" && (
              scheduledList.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm font-mono border border-dashed border-gray-800 rounded-xl">
                  No upcoming meetings scheduled.
                </div>
              ) : (
                scheduledList.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono font-bold uppercase">
                          CONFIRMED SCHEDULE
                        </span>
                        <span className="text-xs font-mono text-gray-400">{item.booking_reference}</span>
                      </div>

                      <div className="text-lg font-bold text-gray-100 font-serif">
                        {item.full_name} · <span className="text-amber-400 font-mono text-sm">{new Date(item.scheduled_date || "").toLocaleString()}</span>
                      </div>

                      <div className="text-xs text-gray-400">
                        Venue / Link: <strong className="text-gray-200">{item.meeting_link_or_venue}</strong>
                      </div>
                    </div>

                    <button
                      onClick={() => handleMarkCompleted(item.id)}
                      className="px-4 py-2 rounded-lg bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/40 text-xs font-mono tracking-wider uppercase transition-all cursor-pointer"
                    >
                      ✓ Mark Session Completed
                    </button>
                  </div>
                ))
              )
            )}

            {/* Tab 3: Active Vouchers */}
            {activeTab === "ACTIVE_VOUCHERS" && (
              activeVouchersList.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm font-mono border border-dashed border-gray-800 rounded-xl">
                  No active vouchers awaiting deal redemption.
                </div>
              ) : (
                activeVouchersList.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono text-amber-400 font-bold text-base">{item.voucher_code}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Holder: <strong>{item.full_name}</strong> ({item.phone_number})
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-lg font-bold text-emerald-400">
                        {item.currency} {item.credit_value} Credit
                      </div>
                      <div className="text-[10px] font-mono text-gray-500 uppercase mt-0.5">Valid for Property Down Payment</div>
                    </div>
                  </div>
                ))
              )
            )}

            {/* Tab 4: Deals Redeemed */}
            {activeTab === "REDEEMED" && (
              redeemedVouchersList.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm font-mono border border-dashed border-gray-800 rounded-xl">
                  No redeemed vouchers logged yet.
                </div>
              ) : (
                redeemedVouchersList.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono text-gray-400 line-through text-sm">{item.voucher_code}</div>
                      <div className="text-xs text-gray-400 mt-1">Applied to purchase by {item.full_name}</div>
                    </div>
                    <div className="text-xs font-mono text-emerald-400 font-bold uppercase">
                      ✓ Deducted {item.currency} {item.credit_value} from Token Fee
                    </div>
                  </div>
                ))
              )
            )}
          </>
        )}
      </div>

      {/* ─── SCHEDULE MODAL ─── */}
      {isScheduleModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-amber-500/50 rounded-2xl p-6 sm:p-8 max-w-lg w-full space-y-5">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-amber-500 font-bold">Coordination Lock</div>
                <h3 className="text-lg font-bold text-gray-100 font-serif">Lock In Session with Nabeel</h3>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-mono uppercase text-gray-400">Meeting Date</label>
                  <span className="text-[10px] font-mono text-amber-500">Sat – Thu (Sunday Holiday)</span>
                </div>
                <input
                  type="date"
                  required
                  value={meetingDate}
                  onChange={(e) => {
                    const selected = new Date(e.target.value);
                    if (selected.getUTCDay() === 0) {
                      alert("Note: Sunday is an advisory holiday for Nabeel. Consultations operate Saturday through Thursday.");
                    }
                    setMeetingDate(e.target.value);
                  }}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1">Meeting Time (Riyadh Time)</label>
                <input
                  type="time"
                  required
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1">Delivery Format</label>
                <select
                  value={meetingMode}
                  onChange={(e: any) => setMeetingMode(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-100"
                >
                  <option value="ONLINE_VIDEO">🖥️ Online Video (Google Meet / Zoom)</option>
                  <option value="IN_PERSON_OFFICE">🏢 In-Person at Asaheeb VIP Lounge (Matbouli Plaza, Jeddah)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1">Google Meet URL or Office Address</label>
                <input
                  type="text"
                  required
                  value={meetingVenueOrUrl}
                  onChange={(e) => setMeetingVenueOrUrl(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1">Concierge Coordination Notes</label>
                <textarea
                  rows={2}
                  value={conciergeNotes}
                  onChange={(e) => setConciergeNotes(e.target.value)}
                  placeholder="Notes from customer phone call (e.g. Client confirmed 4:00 PM slot)..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-100"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs font-mono uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSchedule}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-mono uppercase font-bold"
                >
                  {isSavingSchedule ? "Locking..." : "Confirm & Lock Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── GLOBAL SETTINGS MODAL ─── */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 sm:p-8 max-w-lg w-full space-y-5">
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-gray-100 font-serif">Global Consultation Settings</h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1">Weekly Slot Capacity (Max sessions for Nabeel)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1">Consultation Fee (SAR)</label>
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={editFee}
                  onChange={(e) => setEditFee(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1">Credit Multiplier (1.0 = 100%, 2.0 = 2x Promo)</label>
                <select
                  value={editMultiplier}
                  onChange={(e) => setEditMultiplier(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-100 font-mono"
                >
                  <option value={1.0}>1.0x (100% Refund Voucher = SAR {editFee})</option>
                  <option value={2.0}>2.0x (Double Credit Promo = SAR {editFee * 2})</option>
                  <option value={3.0}>3.0x (Triple Credit Promo = SAR {editFee * 3})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-gray-400 mb-1">Custom Scarcity Banner Override</label>
                <input
                  type="text"
                  placeholder="e.g. Founder traveling for Riyadh Summit; booking open for next week"
                  value={editBannerEn}
                  onChange={(e) => setEditBannerEn(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeToggle"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <label htmlFor="activeToggle" className="text-xs text-gray-300 font-mono">
                  Consultation Booking Engine Active on Website
                </label>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-xs font-mono uppercase"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 text-xs font-mono uppercase font-bold"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```
