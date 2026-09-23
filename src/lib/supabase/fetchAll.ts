/**
 * Helper to fetch all rows across PostgREST's default 1,000-row limit in Supabase.
 * By default, Supabase server-side max_rows truncates query results at 1,000 records.
 * This helper queries in batches of 1,000 using .range(from, to) to fetch the entire dataset.
 */
export async function fetchAllInBatches<T = any>(
  fetchBatch: (from: number, to: number) => PromiseLike<{ data: any; error: any }>,
  batchSize: number = 1000
): Promise<T[]> {
  let allRecords: T[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const to = from + batchSize - 1
    const { data, error } = await fetchBatch(from, to)

    if (error) {
      console.error('Error in fetchAllInBatches:', error)
      break
    }

    if (!data || data.length === 0) {
      break
    }

    allRecords = allRecords.concat(data)

    if (data.length < batchSize) {
      hasMore = false
    } else {
      from += batchSize
    }
  }

  return allRecords
}
