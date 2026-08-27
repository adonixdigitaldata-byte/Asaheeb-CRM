'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet, ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import type { LeadStage } from '@/types/database'

interface Props {
  stages: LeadStage[]
  agents: { id: string; name: string; email?: string; role?: string }[]
  batches: any[]
  currentUserId: string
}

interface ParsedRow {
  rowIndex: number
  name?: string
  phone?: string
  email?: string
  city?: string
  interest?: string
  potential_value?: number | null
  stage_id?: string
  assigned_agent_id?: string
  status: 'valid' | 'error' | 'duplicate'
  error?: string
}

export default function ImportClient({ stages, agents, batches: initialBatches, currentUserId }: Props) {
  const [batches, setBatches] = useState(initialBatches)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [stageId, setStageId] = useState(stages[0]?.id ?? '')
  const [agentId, setAgentId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function updateRowStage(rowIndex: number, newStageId: string) {
    setParsedRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, stage_id: newStageId } : r))
    )
  }

  function updateRowAgent(rowIndex: number, newAgentId: string) {
    setParsedRows((prev) =>
      prev.map((r) => (r.rowIndex === rowIndex ? { ...r, assigned_agent_id: newAgentId } : r))
    )
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)

    // Dynamic import to avoid SSR issues
    const XLSX = await import('xlsx')

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    // Check for existing phones/emails in database
    const phones = data.map((r) => String(r.phone || r.Phone || r.PHONE || r.mobile || r['Phone Number'] || '').trim()).filter(Boolean)
    const emails = data.map((r) => String(r.email || r.Email || r.EMAIL || '').trim()).filter(Boolean)

    const { data: existingByPhone } = await supabase
      .from('leads').select('phone').in('phone', phones)
    const { data: existingByEmail } = await supabase
      .from('leads').select('email').in('email', emails)

    const dupPhones = new Set(existingByPhone?.map((l: any) => l.phone) ?? [])
    const dupEmails = new Set(existingByEmail?.map((l: any) => l.email) ?? [])

    const seenPhonesInFile = new Set<string>()
    const seenEmailsInFile = new Set<string>()

    const rows: ParsedRow[] = data.map((row, i) => {
      const name = String(row.name || row.Name || row.NAME || row.full_name || row['Full Name'] || row.client_name || '').trim()
      const phone = String(row.phone || row.Phone || row.PHONE || row.mobile || row['Phone Number'] || '').trim()
      const email = String(row.email || row.Email || row.EMAIL || '').trim()
      const city = String(row.city || row.City || row.CITY || '').trim()
      const interest = String(row.interest || row.Interest || row.property || row.project || row.service || '').trim()
      const potentialRaw = row.potential_value || row['Potential Value'] || row.potentialValue || row.value || row.budget || ''
      const potential_value = potentialRaw ? parseFloat(String(potentialRaw)) : null

      // Match Stage column from XLSX if available
      const stageRaw = String(row.stage || row.Stage || row.STAGE || row.stage_id || row['Lead Stage'] || '').trim().toLowerCase()
      const matchedStage = stageRaw
        ? stages.find((s) => s.label.toLowerCase() === stageRaw || s.label.toLowerCase().includes(stageRaw) || s.id === stageRaw)
        : undefined
      const matchedStageId = matchedStage ? matchedStage.id : undefined

      // Match Agent column from XLSX if available
      const agentRaw = String(row.agent || row.Agent || row.AGENT || row.assigned_agent || row['Assigned Agent'] || row['Agent Name'] || row.agent_name || '').trim().toLowerCase()
      const matchedAgent = agentRaw
        ? agents.find((a) => {
            const agentName = a.name.toLowerCase()
            const agentEmail = (a.email || '').toLowerCase()
            if (agentRaw.includes('@')) return agentEmail === agentRaw
            if (agentName === agentRaw || a.id === agentRaw) return true
            return agentName.includes(agentRaw) || agentRaw.includes(agentName)
          })
        : undefined
      const matchedAgentId = matchedAgent ? matchedAgent.id : undefined

      if (!name && !phone && !email) {
        return { 
          rowIndex: i + 2, name, phone, email, city, interest, potential_value, 
          stage_id: matchedStageId, assigned_agent_id: matchedAgentId,
          status: 'error' as const, error: 'No contact info' 
        }
      }

      const isDbDuplicate = (phone && dupPhones.has(phone)) || (email && dupEmails.has(email))
      const isFileDuplicate = (phone && seenPhonesInFile.has(phone)) || (email && seenEmailsInFile.has(email))

      if (isDbDuplicate || isFileDuplicate) {
        return {
          rowIndex: i + 2,
          name, phone, email, city, interest, potential_value,
          stage_id: matchedStageId, assigned_agent_id: matchedAgentId,
          status: 'duplicate' as const,
          error: isDbDuplicate ? 'Already in CRM' : 'Duplicate row in file',
        }
      }

      if (phone) seenPhonesInFile.add(phone)
      if (email) seenEmailsInFile.add(email)

      return { 
        rowIndex: i + 2, name, phone, email, city, interest, potential_value,
        stage_id: matchedStageId, assigned_agent_id: matchedAgentId,
        status: 'valid' as const 
      }
    })

    setParsedRows(rows)
    setStep('preview')
  }

  async function handleImport() {
    setImporting(true)
    const validRows = parsedRows.filter((r) => r.status === 'valid')

    // Create batch record
    const { data: batch } = await supabase.from('import_batches').insert({
      file_name: fileName,
      uploaded_by: currentUserId,
      total_rows: parsedRows.length,
      success_count: 0,
      error_count: 0,
      duplicate_count: parsedRows.filter((r) => r.status === 'duplicate').length,
    }).select('id').single()

    let successCount = 0
    let errorCount = 0

    // Insert leads with round-robin fallback for unassigned entries
    let rrIndex = 0
    for (const row of validRows) {
      let targetAgentId = row.assigned_agent_id !== undefined ? (row.assigned_agent_id || null) : (agentId || null)
      if (!targetAgentId && agents.length > 0) {
        targetAgentId = agents[rrIndex % agents.length].id
        rrIndex++
      }

      const { error } = await supabase.from('leads').insert({
        source: 'XLSX_IMPORT',
        name: row.name || 'Lead',
        phone: row.phone || null,
        email: row.email || null,
        city: row.city || null,
        interest: row.interest || null,
        potential_value: row.potential_value || null,
        form_data: {},
        stage_id: row.stage_id || stageId,
        assigned_agent_id: targetAgentId,
        import_batch_id: batch?.id,
      })
      if (error) errorCount++
      else successCount++
    }

    // Update batch stats
    if (batch?.id) {
      await supabase.from('import_batches').update({
        success_count: successCount,
        error_count: errorCount,
      }).eq('id', batch.id)
    }

    setImportResult({
      total: validRows.length,
      success: successCount,
      errors: errorCount,
      duplicates: parsedRows.filter((r) => r.status === 'duplicate').length,
    })
    setStep('done')
    setImporting(false)

    const { data: updatedBatches } = await supabase
      .from('import_batches')
      .select('*, uploader:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(15)
    if (updatedBatches) setBatches(updatedBatches)
  }

  const validCount = parsedRows.filter((r) => r.status === 'valid').length
  const duplicateCount = parsedRows.filter((r) => r.status === 'duplicate').length
  const errorCount = parsedRows.filter((r) => r.status === 'error').length

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="text-page-title">Import Leads</h1>
            <span className="badge badge-admin" style={{ fontWeight: 700 }}>XLSX / CSV</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Bulk upload real estate property inquiries, client lists, and campaign leads with automatic duplicate prevention.
          </p>
        </div>

        <Link href="/leads" className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Back to Leads Pipeline
        </Link>
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card" style={{ padding: '36px 32px' }}>
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '48px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--bg)',
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file && fileRef.current) {
                  const dt = new DataTransfer()
                  dt.items.add(file)
                  fileRef.current.files = dt.files
                  fileRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                }
              }}
            >
              <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#EFF6FF',
                color: '#1E3A8A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}>
                <FileSpreadsheet size={28} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Drag and drop your spreadsheet here
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Supports Excel (.xlsx, .xls) and CSV format
              </div>
              <button type="button" className="btn btn-primary" style={{ fontWeight: 700 }}>
                <Upload size={14} /> Browse Files
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <div style={{
              marginTop: 20,
              padding: '14px 18px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12.5,
              color: 'var(--text-secondary)',
            }}>
              <strong style={{ color: '#1E3A8A' }}>Supported Column Headers:</strong>{' '}
              <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>name</code>,{' '}
              <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>phone</code>,{' '}
              <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>email</code>,{' '}
              <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>city</code>,{' '}
              <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>interest / project</code>,{' '}
              <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>potential_value / budget</code>,{' '}
              <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>stage</code>,{' '}
              <code style={{ background: '#E2E8F0', padding: '2px 6px', borderRadius: 4 }}>agent</code>.
            </div>
          </div>

          {/* Past Import Batches History */}
          {batches.length > 0 && (
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 15 }}>
                Recent Import History ({batches.length})
              </div>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Uploaded By</th>
                      <th>Total Rows</th>
                      <th>Successfully Imported</th>
                      <th>Duplicates Ignored</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{b.file_name}</td>
                        <td>{b.uploader?.name || 'Admin'}</td>
                        <td>{b.total_rows}</td>
                        <td style={{ color: '#10B981', fontWeight: 700 }}>{b.success_count}</td>
                        <td style={{ color: '#F59E0B' }}>{b.duplicate_count}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {format(new Date(b.created_at), 'dd MMM yyyy, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: PREVIEW */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary & Defaults Bar */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Preview: {fileName}
                </h3>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13 }}>
                  <span style={{ color: '#10B981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={15} /> {validCount} ready to import
                  </span>
                  {duplicateCount > 0 && (
                    <span style={{ color: '#F59E0B', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={15} /> {duplicateCount} duplicates (will be skipped)
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span style={{ color: '#EF4444', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <XCircle size={15} /> {errorCount} errors
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setStep('upload'); setParsedRows([]); }}
                  className="btn btn-outline btn-sm"
                >
                  Change File
                </button>
                <button
                  type="button"
                  disabled={importing || validCount === 0}
                  onClick={handleImport}
                  className="btn btn-primary"
                  style={{ fontWeight: 700 }}
                >
                  {importing ? 'Importing Leads...' : `Import ${validCount} Leads`}
                </button>
              </div>
            </div>

            {/* Fallback Assignment Controls */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
            }}>
              <div>
                <label className="text-label" style={{ marginBottom: 4, display: 'block' }}>Default Fallback Stage</label>
                <select
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="select"
                  style={{ width: '100%', height: 38 }}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-label" style={{ marginBottom: 4, display: 'block' }}>Default Fallback Agent</label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="select"
                  style={{ width: '100%', height: 38 }}
                >
                  <option value="">Unassigned (Round-robin / General Pool)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Parsed Rows Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="table-responsive" style={{ maxHeight: 520, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Status</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>City / Location</th>
                    <th>Interest / Property</th>
                    <th>Assigned Stage</th>
                    <th>Assigned Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 100).map((row) => (
                    <tr key={row.rowIndex} style={{
                      background: row.status === 'duplicate' ? '#FFFBEB' : row.status === 'error' ? '#FEF2F2' : undefined,
                    }}>
                      <td style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>#{row.rowIndex}</td>
                      <td>
                        {row.status === 'valid' ? (
                          <span className="badge badge-active" style={{ fontSize: 11 }}>Valid</span>
                        ) : row.status === 'duplicate' ? (
                          <span className="badge badge-warning" style={{ fontSize: 11 }}>{row.error}</span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: 11, color: '#EF4444' }}>{row.error}</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{row.name || '—'}</td>
                      <td>{row.phone || '—'}</td>
                      <td>{row.email || '—'}</td>
                      <td>{row.city || '—'}</td>
                      <td>{row.interest || '—'}</td>
                      <td>
                        <select
                          value={row.stage_id || stageId}
                          onChange={(e) => updateRowStage(row.rowIndex, e.target.value)}
                          className="select"
                          style={{ height: 30, fontSize: 12, padding: '2px 8px' }}
                        >
                          {stages.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={row.assigned_agent_id !== undefined ? row.assigned_agent_id : agentId}
                          onChange={(e) => updateRowAgent(row.rowIndex, e.target.value)}
                          className="select"
                          style={{ height: 30, fontSize: 12, padding: '2px 8px' }}
                        >
                          <option value="">Default / Pool</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: DONE */}
      {step === 'done' && importResult && (
        <div className="card" style={{ maxWidth: 580, margin: '40px auto', padding: '40px 32px', textAlign: 'center' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#F0FDF4',
            color: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}>
            <CheckCircle2 size={32} />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Lead Import Completed!
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Your property leads have been uploaded and distributed into the pipeline.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            marginBottom: 28,
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Imported</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#10B981', marginTop: 2 }}>{importResult.success}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Duplicates</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B', marginTop: 2 }}>{importResult.duplicates}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Errors</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#EF4444', marginTop: 2 }}>{importResult.errors}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button
              onClick={() => { setStep('upload'); setParsedRows([]); setFileName(''); }}
              className="btn btn-outline"
            >
              Import Another File
            </button>
            <Link href="/leads" className="btn btn-primary" style={{ fontWeight: 700 }}>
              View in Leads Pipeline <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
