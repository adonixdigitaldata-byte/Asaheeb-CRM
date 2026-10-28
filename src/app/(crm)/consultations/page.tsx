import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ConsultationsCRMView from '@/components/consultations/ConsultationsCRMView'
import type { Profile } from '@/types/database'

export const metadata: Metadata = {
  title: 'VIP Consultations & Founder Advisory | Asaheeb CRM',
  description: 'Manage paid consultations, calendar schedule lock-ins, and property deal vouchers from the website.',
}

export default async function ConsultationsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'CHANNEL_PARTNER') {
    redirect('/dashboard')
  }

  return <ConsultationsCRMView profile={profile as Profile} />
}
