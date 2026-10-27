'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import DealCelebrationModal, { DealCelebrationData } from '@/components/DealCelebrationModal'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile | null
}

export default function AdminRealtimeCelebration({ profile }: Props) {
  const [celebrationDeal, setCelebrationDeal] = useState<DealCelebrationData | null>(null)
  const recentSalesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Strictly active for administrators: broadcasts real-time sales celebrations
    // to the admin whenever any team member records a closed deal
    if (profile?.role !== 'ADMIN') return

    const supabase = createClient()

    // 1. Instant Realtime Broadcast Channel
    const broadcastChannel = supabase
      .channel('crm-sales-celebration')
      .on('broadcast', { event: 'deal-celebration' }, (payload: any) => {
        try {
          const data = payload?.payload || payload
          const { deal, recorderId, saleId } = data || {}
          if (!deal) return

          // If the admin themselves was the recorder on this client, skip duplicate alert
          if (recorderId === profile.id) return

          const key = String(saleId || `${deal.projectName}-${deal.unitName}-${deal.commissionAmount}`)
          if (recentSalesRef.current.has(key)) return
          recentSalesRef.current.add(key)

          // Keep recent sales set bounded
          setTimeout(() => {
            recentSalesRef.current.delete(key)
          }, 30000)

          setCelebrationDeal(deal)
        } catch (err) {
          console.error('Error handling deal celebration broadcast:', err)
        }
      })
      .subscribe()

    // 2. Realtime Database INSERT fallback on project_commissions
    const dbFallbackChannel = supabase
      .channel('crm-sales-db-fallback')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'project_commissions' },
        async (payload: any) => {
          try {
            const newRow = payload?.new
            if (!newRow) return

            // Skip if recorded by the admin
            if (newRow.created_by === profile.id) return

            const key = String(newRow.id || `${newRow.project_id}-${newRow.unit_name}`)
            if (recentSalesRef.current.has(key)) return
            recentSalesRef.current.add(key)

            setTimeout(() => {
              recentSalesRef.current.delete(key)
            }, 30000)

            // Resolve project name
            let projectName = 'Property Project'
            try {
              const { data: proj } = await supabase
                .from('projects')
                .select('name_en')
                .eq('id', newRow.project_id)
                .single()
              if (proj?.name_en) projectName = proj.name_en
            } catch {}

            const deal: DealCelebrationData = {
              agentName: newRow.agent_name || 'Sales Agent',
              projectName: projectName,
              unitName: newRow.unit_name,
              areaSqm: newRow.area_sqm ? Number(newRow.area_sqm) : null,
              dealValueSar: newRow.deal_value_sar ? Number(newRow.deal_value_sar) : null,
              commissionAmount: Number(newRow.commission_amount) || 0,
              saleDate: newRow.sale_date,
            }

            setCelebrationDeal(deal)
          } catch (err) {
            console.error('Error handling db celebration fallback:', err)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(broadcastChannel)
      supabase.removeChannel(dbFallbackChannel)
    }
  }, [profile?.id, profile?.role])

  if (!celebrationDeal) return null

  return (
    <DealCelebrationModal
      deal={celebrationDeal}
      onClose={() => setCelebrationDeal(null)}
    />
  )
}
