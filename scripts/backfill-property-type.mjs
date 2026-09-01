import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('Connecting to Supabase...')
  
  // 1. Fetch all projects
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, name_en, type_en')
  
  if (projErr) {
    console.error('Error fetching projects:', projErr.message)
    return
  }
  
  console.log(`Fetched ${projects?.length || 0} projects.`)
  const projectMap = new Map((projects || []).map((p) => [p.id, p.type_en]))

  // 2. Fetch all leads
  const { data: leads, error: leadsErr } = await supabase
    .from('leads')
    .select('id, name, property_id, property_type')
  
  if (leadsErr) {
    console.error('Error fetching leads:', leadsErr.message)
    console.log('If column property_type does not exist, we need to alter table.')
    return
  }

  console.log(`Fetched ${leads?.length || 0} leads.`)
  let updatedCount = 0

  for (const lead of leads || []) {
    let targetType = lead.property_type

    if (lead.property_id && projectMap.has(lead.property_id)) {
      const projType = projectMap.get(lead.property_id)
      if (projType) {
        targetType = projType
      }
    }

    if (!targetType) {
      targetType = 'Apartment'
    }

    if (targetType !== lead.property_type) {
      const { error: updateErr } = await supabase
        .from('leads')
        .update({ property_type: targetType })
        .eq('id', lead.id)

      if (updateErr) {
        console.error(`Error updating lead ${lead.id}:`, updateErr.message)
      } else {
        console.log(`Updated lead "${lead.name}" (${lead.id}) -> ${targetType}`)
        updatedCount++
      }
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} leads.`)
}

run().catch(console.error)
