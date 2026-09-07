import { createClient } from '@/lib/supabase/client'
import { Expense, ExpenseFilters } from '@/types/expense'

const LOCAL_STORAGE_EXPENSES_KEY = 'asaheeb_crm_expenses_v1'

function getLocalExpenses(): Expense[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EXPENSES_KEY)
    if (!raw) {
      return []
    }
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse local expenses:', err)
    return []
  }
}

function saveLocalExpenses(expenses: Expense[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOCAL_STORAGE_EXPENSES_KEY, JSON.stringify(expenses))
  } catch (err) {
    console.error('Failed to save local expenses:', err)
  }
}

export async function fetchExpenses(filters?: ExpenseFilters): Promise<Expense[]> {
  try {
    const supabase = createClient()
    let query = supabase.from('expenses').select('*').order('expense_date', { ascending: false })

    if (filters?.category && filters.category !== 'ALL') {
      query = query.eq('category', filters.category)
    }
    if (filters?.cost_center && filters.cost_center !== 'ALL') {
      query = query.eq('cost_center', filters.cost_center)
    }
    if (filters?.payment_method && filters.payment_method !== 'ALL') {
      query = query.eq('payment_method', filters.payment_method)
    }
    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (!error && data) {
      return data as Expense[]
    }
  } catch (err) {
    console.warn('Supabase fetch failed, checking local store:', err)
  }

  // Fallback to local store with filters applied
  let items = getLocalExpenses()
  if (filters?.category && filters.category !== 'ALL') {
    items = items.filter((i) => i.category === filters.category)
  }
  if (filters?.cost_center && filters.cost_center !== 'ALL') {
    items = items.filter((i) => i.cost_center === filters.cost_center)
  }
  if (filters?.payment_method && filters.payment_method !== 'ALL') {
    items = items.filter((i) => i.payment_method === filters.payment_method)
  }
  if (filters?.status && filters.status !== 'ALL') {
    items = items.filter((i) => i.status === filters.status)
  }
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.toLowerCase()
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.reference_number.toLowerCase().includes(q) ||
        i.vendor_payee.toLowerCase().includes(q) ||
        (i.notes && i.notes.toLowerCase().includes(q))
    )
  }
  return items
}

export async function saveExpense(expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<Expense> {
  const isUpdate = Boolean(expense.id)
  const id = expense.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `exp-${Date.now()}`)
  const now = new Date().toISOString()

  const fullRecord: Expense = {
    ...expense,
    id,
    currency: 'SAR',
    created_at: now,
    updated_at: now,
  } as Expense

  try {
    const supabase = createClient()
    if (isUpdate) {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          title: fullRecord.title,
          category: fullRecord.category,
          amount: fullRecord.amount,
          currency: 'SAR',
          vat_amount: fullRecord.vat_amount,
          vat_rate: fullRecord.vat_rate || 15,
          expense_date: fullRecord.expense_date,
          vendor_payee: fullRecord.vendor_payee,
          cost_center: fullRecord.cost_center,
          payment_method: fullRecord.payment_method,
          status: fullRecord.status,
          notes: fullRecord.notes,
          receipt_url: fullRecord.receipt_url,
          receipt_file_name: fullRecord.receipt_file_name,
          is_recurring: fullRecord.is_recurring,
          approved_by: fullRecord.approved_by,
          updated_at: now,
        })
        .eq('id', fullRecord.id)
        .select()
        .single()

      if (!error && data) {
        const local = getLocalExpenses()
        saveLocalExpenses(local.map((item) => (item.id === fullRecord.id ? (data as Expense) : item)))
        return data as Expense
      }
    } else {
      const { data, error } = await supabase
        .from('expenses')
        .insert([fullRecord])
        .select()
        .single()

      if (!error && data) {
        const local = getLocalExpenses()
        saveLocalExpenses([data as Expense, ...local])
        return data as Expense
      }
    }
  } catch (err) {
    console.warn('Supabase save error, storing in local storage:', err)
  }

  // Fallback to local
  const current = getLocalExpenses()
  if (isUpdate) {
    const updatedList = current.map((item) => (item.id === fullRecord.id ? { ...item, ...fullRecord, updated_at: now } : item))
    saveLocalExpenses(updatedList)
    return fullRecord
  } else {
    const newList = [fullRecord, ...current]
    saveLocalExpenses(newList)
    return fullRecord
  }
}

export async function deleteExpense(id: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (!error) {
      const local = getLocalExpenses().filter((x) => x.id !== id)
      saveLocalExpenses(local)
      return true
    }
  } catch (err) {
    console.warn('Supabase delete error, deleting from local storage:', err)
  }

  const local = getLocalExpenses().filter((x) => x.id !== id)
  saveLocalExpenses(local)
  return true
}

export function clearLocalExpenses() {
  saveLocalExpenses([])
}
