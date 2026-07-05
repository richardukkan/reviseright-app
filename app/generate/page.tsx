'use client'
import { useEffect, useState } from 'react'
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

// Question types not suitable for Maths
const MATHS_DISABLED = ['truefalse', 'match', 'define', 'critical']
const MATHS_SUBJECTS = ['maths', 'math', 'mathematics', 'ganit']

const isMaths = (subject: string) => MATHS_SUBJECTS.includes(subject.toLowerCase().trim())

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

  // Auto-adjust question types when subject changes
  const handleSubjectChange = (val: string) => {
    setSubject(val)
    if (isMaths(val)) {
      // For Maths: enable only suitable types, disable unsuitable ones
      setSelected({ mcq: true, fill: true, truefalse: false, oneword: true, short: true, long: true, match: false, define: false, critical: false })
    } else if (val === '' && isMaths(subject)) {
      // Reset to defaults when clearing from maths
      setSelected({ mcq: true, fill: true, short: true, critical: true })
    }
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []).slice(0, 15)
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
  const mathsMode = isMaths(subject)

  const handleGenerate = async () => {
    if (files.length === 0) { setError('Please upload at least one page photo.'); return }
    if (files.length > pagesRemaining) { setError(`You only have ${pagesRemaining} pages remaining this month. Please upgrade your plan.`); return }
    const anySelected = Object.values(selected).some(v => v)
    if (!anySelected) { setError('Please select at least one question type.'); return }

    setGenerating(true)
    setError('')

    try {
      const images = await Promise.all(files.map(f => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
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
    <div style={{minHeight:'100vh',background:'#F9FAFB'}}>
      <Navbar user={user} />
      <div style={{maxWidth:'700px',margin:'0 auto',padding:'2.5rem 1.5rem'}}>
        <div style={{marginBottom:'2rem'}}>
          <h1 style={{fontSize:'24px',fontWeight:'500',color:'#111827'}}>Generate revision questions</h1>
          <p style={{color:'#6B7280',fontSize:'14px',marginTop:'4px'}}>Upload up to 15 textbook page photos at once</p>
        </div>

        {/* Step 1: Upload */}
        <div className="card" style={{marginBottom:'1rem'}}>
          <h2 style={{fontWeight:'500',color:'#111827',marginBottom:'4px'}}>1. Upload page photos</h2>
          <p style={{fontSize:'12px',color:'#9CA3AF',marginBottom:'1rem'}}>{pagesRemaining} pages remaining this month</p>
          <label style={{display:'block',border:'2px dashed #E5E7EB',borderRadius:'12px',padding:'2rem',textAlign:'center',cursor:'pointer'}}>
            <input type="file" accept="image/*" multiple style={{display:'none'}} onChange={handleFiles} />
            <div style={{fontSize:'32px',marginBottom:'8px'}}>📸</div>
            <p style={{fontSize:'14px',fontWeight:'500',color:'#374151'}}>Click to upload photos</p>
            <p style={{fontSize:'12px',color:'#9CA3AF',marginTop:'4px'}}>JPG, PNG · Up to 15 pages</p>
          </label>
          {previews.length > 0 && (
            <div style={{marginTop:'1rem'}}>
              <p style={{fontSize:'12px',color:'#6B7280',marginBottom:'8px'}}>{previews.length} pages uploaded — use arrows to reorder</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px'}}>
                {previews.map((p, i) => (
                  <div key={i} style={{position:'relative'}}>
                    <img src={p} alt={`Page ${i+1}`} style={{width:'100%',height:'80px',objectFit:'cover',borderRadius:'8px',border:'1px solid #E5E7EB'}} />
                    <div style={{position:'absolute',top:'4px',left:'4px',background:'#2563EB',color:'#fff',fontSize:'11px',borderRadius:'50%',width:'20px',height:'20px',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'500'}}>{i+1}</div>
                    <div style={{position:'absolute',top:'4px',right:'4px',display:'flex',gap:'2px'}}>
                      {i > 0 && <button onClick={() => moveImage(i, i-1)} style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:'4px',fontSize:'10px',padding:'1px 4px',cursor:'pointer'}}>←</button>}
                      {i < previews.length-1 && <button onClick={() => moveImage(i, i+1)} style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:'4px',fontSize:'10px',padding:'1px 4px',cursor:'pointer'}}>→</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Details */}
        <div className="card" style={{marginBottom:'1rem'}}>
          <h2 style={{fontWeight:'500',color:'#111827',marginBottom:'1rem'}}>2. Chapter details</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1rem'}}>
            <div>
              <label className="label">Subject <span style={{color:'#9CA3AF',fontWeight:'400'}}>(optional)</span></label>
              <input className="input" type="text" placeholder="e.g. Science, Maths, History"
                value={subject} onChange={e => handleSubjectChange(e.target.value)} />
            </div>
            <div>
              <label className="label">Class</label>
              <select className="input" value={classLevel} onChange={e => setClassLevel(Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8,9,10].map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
          </div>
          {/* Maths hint */}
          {mathsMode && (
            <div style={{marginTop:'1rem',background:'#FFF7ED',border:'1px solid #FED7AA',borderRadius:'8px',padding:'0.75rem 1rem',display:'flex',gap:'8px',alignItems:'flex-start'}}>
              <span style={{fontSize:'16px'}}>📐</span>
              <div>
                <p style={{fontSize:'13px',fontWeight:'500',color:'#92400E'}}>Maths mode</p>
                <p style={{fontSize:'12px',color:'#B45309',marginTop:'2px'}}>For Maths, we've pre-selected the best question types. Match the Following, Define, True/False and Critical Thinking have been disabled as they don't work well for Maths.</p>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Question types */}
        <div className="card" style={{marginBottom:'1.5rem'}}>
          <h2 style={{fontWeight:'500',color:'#111827',marginBottom:'1rem'}}>3. Choose question types</h2>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            {QUESTION_TYPES.map(t => {
              const isDisabledForMaths = mathsMode && MATHS_DISABLED.includes(t.key)
              return (
                <div key={t.key} style={{
                  display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'0.75rem',borderRadius:'8px',border:'1px solid',
                  borderColor: isDisabledForMaths ? '#F3F4F6' : selected[t.key] ? '#BFDBFE' : '#E5E7EB',
                  background: isDisabledForMaths ? '#F9FAFB' : selected[t.key] ? '#EFF6FF' : '#fff',
                  opacity: isDisabledForMaths ? 0.5 : 1
                }}>
                  <label style={{display:'flex',alignItems:'center',gap:'10px',cursor: isDisabledForMaths ? 'not-allowed' : 'pointer',flex:1}}>
                    <input type="checkbox"
                      checked={!!selected[t.key]}
                      disabled={isDisabledForMaths}
                      onChange={e => !isDisabledForMaths && setSelected({...selected, [t.key]: e.target.checked})}
                      style={{accentColor:'#2563EB',width:'16px',height:'16px'}} />
                    <span style={{fontSize:'14px',fontWeight:'500',color: isDisabledForMaths ? '#9CA3AF' : '#374151'}}>
                      {t.label}
                      {isDisabledForMaths && <span style={{fontSize:'11px',marginLeft:'6px',color:'#9CA3AF'}}>not for Maths</span>}
                    </span>
                  </label>
                  {selected[t.key] && !isDisabledForMaths && (
                    <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                      <span style={{fontSize:'12px',color:'#9CA3AF'}}>How many?</span>
                      <select style={{fontSize:'13px',border:'1px solid #E5E7EB',borderRadius:'6px',padding:'3px 6px'}}
                        value={counts[t.key]} onChange={e => setCounts({...counts, [t.key]: Number(e.target.value)})}>
                        {[3,5,8,10,15,20].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {error && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'8px',padding:'0.75rem 1rem',color:'#DC2626',fontSize:'14px',marginBottom:'1rem'}}>{error}</div>}

        <button onClick={handleGenerate} disabled={generating || files.length === 0}
          className="btn-primary"
          style={{width:'100%',justifyContent:'center',padding:'12px',fontSize:'15px',opacity:(generating || files.length === 0) ? 0.6 : 1,cursor:(generating || files.length === 0) ? 'not-allowed' : 'pointer'}}>
          {generating ? (
            <span style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <svg style={{animation:'spin 1s linear infinite',width:'16px',height:'16px'}} viewBox="0 0 24 24" fill="none">
                <circle style={{opacity:0.25}} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path style={{opacity:0.75}} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Generating... this may take 30–60 seconds
            </span>
          ) : `Generate questions (${files.length} page${files.length !== 1 ? 's' : ''})`}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
