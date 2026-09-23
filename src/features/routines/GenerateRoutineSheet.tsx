import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'
import { IconSparkle } from '../../components/ui/icons'
import { generateRoutineFromNotes } from '../../lib/aiRoutineGenerator'

interface GenerateRoutineSheetProps {
  open: boolean
  onClose: () => void
}

const PLACEHOLDER = `Paste your workout notes here, e.g.

Push Day
Warm-up: 5 min bike, arm circles
Bench press 4x8 @ 60kg
Overhead press 3x10
Cable tricep pushdown 3x12
Cool down: chest stretch`

export function GenerateRoutineSheet({ open, onClose }: GenerateRoutineSheetProps) {
  const navigate = useNavigate()
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    if (loading) return
    setError(null)
    onClose()
  }

  async function handleGenerate() {
    if (!notes.trim()) {
      setError('Paste in your workout notes first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await generateRoutineFromNotes(notes)
      setNotes('')
      onClose()
      navigate('/routines/new', { state: { draft: result.draft, aiSummary: result } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong generating this routine.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Generate routine from notes">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-primary-muted">
          Paste a workout you've written down elsewhere — notes app, a text, a spreadsheet — and the assistant will build a
          structured routine you can review and edit before saving.
        </p>
        <textarea
          className="min-h-48 rounded-[var(--radius-control)] border border-primary-border px-3 py-2.5 text-sm focus:border-secondary focus:outline-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={PLACEHOLDER}
          disabled={loading}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button fullWidth icon={<IconSparkle width={18} height={18} />} loading={loading} onClick={handleGenerate}>
            Generate
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
