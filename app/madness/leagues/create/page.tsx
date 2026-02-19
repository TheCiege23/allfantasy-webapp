'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function CreateMadnessLeague() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [maxManagers, setMaxManagers] = useState(100)
  const [deadline, setDeadline] = useState<Date | undefined>(new Date(Date.now() + 1000 * 60 * 60 * 24 * 7))

  const createLeague = async () => {
    if (!name.trim()) return toast.error('League name is required')

    const res = await fetch('/api/madness/leagues/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        maxManagers,
        deadline: deadline?.toISOString(),
        scoringRules: {
          round1: 10,
          round2: 20,
          sweet16: 40,
          elite8: 80,
          final4: 160,
          championship: 320,
        },
      }),
    })

    const data = await res.json()

    if (res.ok) {
      toast.success(`League "${name}" created!`)
      router.push(`/madness/leagues/${data.leagueId}`)
    } else {
      toast.error(data.error || 'Failed to create league')
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center py-12">
      <div className="glass-card p-10 rounded-3xl w-full max-w-lg">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          Create March Madness League
        </h1>

        <div className="space-y-6">
          <div>
            <Label>League Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Madness Pool"
            />
          </div>

          <div>
            <Label>Max Managers (up to 1000)</Label>
            <Input
              type="number"
              value={maxManagers}
              onChange={e => setMaxManagers(Math.min(1000, Math.max(2, Number(e.target.value))))}
              min={2}
              max={1000}
            />
          </div>

          <div>
            <Label>Pick Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button onClick={createLeague} className="w-full h-12 text-lg bg-gradient-to-r from-cyan-500 to-purple-600">
            Create League
          </Button>
        </div>
      </div>
    </div>
  )
}
