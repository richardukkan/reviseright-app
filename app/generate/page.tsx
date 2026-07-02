'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { PLANS } from '@/lib/plans'

const QUESTION_TYPES = [
  { key: 'mcq', label: 'MCQ' },
  { key: 'fill', label: 'Fill in the blanks' },
  { key: 'truefalse', label: 'True or False' },
  { key: 'oneword', label: 'One Word Answer' },
  { key: 'short', label: 'Short Answer' },
  { key: 'long', label: 'Long Answer' },
  { key: 'match', label: 'Match the Following' },
  { key: 'define', label: 'Define' },
  { key: 'critical', label: 'Critical Thinking' },
]

export default function GeneratePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [classLevel, setClassLevel] = useState(8)
  const [selected, setSelected] = useState<Record<string, boolean>>({ mcq: true, fill: true, short: true, critical: true })
  const [counts, setCounts] = useState<Record<string, number>>({ mcq: 10, fill: 5, truefalse: 5, oneword: 5, short: 5, long: 3, match: 5, define: 5, critical: 3 })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      if (profile?.class_level) setClassLevel(profile.class_level)
    }
    load()
  }, [router])

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []).slice(0, 15)
    // Sort by filename
    newFiles.sort((a, b) => a.name.localeCompare(b.name))
    setFiles(newFiles)
    const newPreviews = newFiles.map(f => URL.createObjectURL(f))
    setPreviews(newPreviews)
  }

  const moveImage = (from: number, to: number) => {
    const newFiles = [...files]
    const newPreviews = [...previews]
    const [f] = newFiles.splice(from, 1)
    const [p] = newPreviews.splice(from, 1)
    newFiles.splice(to, 0, f)
    newPreviews.splice(to, 0, p)
    setFiles(newFiles)
    setPreviews(newPreviews)
  }

  const plan = PLANS[profile?.plan as keyof typeof PLANS] || PLANS.free
  const pagesRemaining = plan.pages - (profile?.pages_used || 0)

  const handleGenerate = async () => {
    if (files.length === 0) { setError('Please upload at least one page photo.'); return }
    if (files.length > pagesRemaining) { setError(`You only have ${pagesRemaining} pages remaining this month. Please upgrade your plan.`); return }
    const anySelected = Object.values(selected).some(v => v)
    if (!anySelected) { setError('Please select at least one question type.'); return }

    setGenerating(true)
    setError('')

    try {
      // Convert files to base64
      const images = await Promise.all(files.map(f => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(f)
      })))

      const questionTypes = QUESTION_TYPES
        .filter(t => selected[t.key])
        .map(t => ({ type: t.key, label: t.label, count: counts[t.key] || 5 }))

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, subject, classLevel, questionTypes, userId: user.id })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      router.push(`/results?id=${data.setId}`)
    } catch (err: any) {
      setError(err.message)
      setGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-gray-900">Generate revision questions</h1>
          <p className="text-gray-500 text-sm mt-1">Upload up to 15 textbook page photos at once</p>
        </div>

        {/* Step 1: Upload */}
        <div className="card mb-4">
          <h2 className="font-medium text-gray-900 mb-1">1. Upload page photos</h2>
          <p className="text-xs text-gray-400 mb-4">Max 15 pages · {pagesRemaining} pages remaining this month</p>
          <label className="block border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors">
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            <div className="text-3xl mb-2">📸</div>
            <p className="text-sm font-medium text-gray-700">Click to upload photos</p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG · Up to 15 pages</p>
          </label>
          {previews.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">{previews.length} pages uploaded — drag numbers to reorder</p>
              <div className="grid grid-cols-5 gap-2">
                {previews.map((p, i) => (
                  <div key={i} className="relative group">
                    <img src={p} alt={`Page ${i+1}`} className="w-full h-20 object-cover rounded-lg border border-gray-200" />
                    <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">{i+1}</div>
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {i > 0 && <button onClick={() => moveImage(i, i-1)} className="bg-white rounded text-xs px-1 border border-gray-200 shadow">←</button>}
                      {i < previews.length-1 && <button onClick={() => moveImage(i, i+1)} className="bg-white rounded text-xs px-1 border border-gray-200 shadow">→</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Details */}
        <div className="card mb-4">
          <h2 className="font-medium text-gray-900 mb-4">2. Chapter details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
              <input className="input" type="text" placeholder="e.g. Science, History"
                value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="label">Class</label>
              <select className="input" value={classLevel} onChange={e => setClassLevel(Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8,9,10].map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Question types */}
        <div className="card mb-6">
          <h2 className="font-medium text-gray-900 mb-4">3. Choose question types</h2>
          <div className="space-y-2">
            {QUESTION_TYPES.map(t => (
              <div key={t.key} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${selected[t.key] ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input type="checkbox" checked={!!selected[t.key]}
                    onChange={e => setSelected({...selected, [t.key]: e.target.checked})}
                    className="accent-blue-600 w-4 h-4" />
                  <span className="text-sm font-medium text-gray-700">{t.label}</span>
                </label>
                {selected[t.key] && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">How many?</span>
                    <select className="text-sm border border-gray-200 rounded px-2 py-1"
                      value={counts[t.key]} onChange={e => setCounts({...counts, [t.key]: Number(e.target.value)})}>
                      {[3,5,8,10,15,20].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

        <button onClick={handleGenerate} disabled={generating || files.length === 0}
          className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
          {generating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Generating questions... this may take 30–60 seconds
            </span>
          ) : `Generate questions (${files.length} page${files.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  )
}
