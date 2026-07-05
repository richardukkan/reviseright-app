'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { PLANS } from '@/lib/plans'

export default function ResultsContent() {
  const router = useRouter()
  const params = useSearchParams()
  const setId = params.get('id')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [questionSet, setQuestionSet] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
  const [allRevealed, setAllRevealed] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(profile)
      if (setId) {
        const { data: set } = await supabase.from('question_sets').select('*').eq('id', setId).eq('user_id', user.id).single()
        setQuestionSet(set)
      }
      setLoading(false)
    }
    load()
  }, [router, setId])

  const toggleAnswer = (key: string) => {
    setRevealedAnswers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleAll = () => {
    const next = !allRevealed
    setAllRevealed(next)
    if (next) {
      const all: Record<string, boolean> = {}
      const questions = questionSet?.questions || []
      questions.forEach((_: any, i: number) => { all[i] = true })
      setRevealedAnswers(all)
    } else {
      setRevealedAnswers({})
    }
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      const questions = questionSet.questions || []

      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(`${questionSet.subject} — Class ${questionSet.class_level}`, 15, 20)

      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`Generated for: ${profile.name} | ${profile.email} | ${profile.phone || ''}`, 15, 30)
      doc.text('ReviseRight.in | Not for redistribution', 15, 35)

      doc.setTextColor(0, 0, 0)
      let y = 48

      const typeLabels: Record<string, string> = {
        mcq: 'MCQ', fill: 'Fill in the Blank', truefalse: 'True or False',
        oneword: 'One Word Answer', short: 'Short Answer', long: 'Long Answer',
        match: 'Match the Following', define: 'Define', critical: 'Critical Thinking'
      }

      const addWatermark = () => {
        doc.setFontSize(7)
        doc.setTextColor(210, 210, 210)
        doc.text(`${profile.name} | ${profile.email} | ReviseRight.in`, 15, 288)
        doc.setTextColor(0, 0, 0)
      }

      questions.forEach((q: any, i: number) => {
        if (y > 255) { addWatermark(); doc.addPage(); y = 20 }

        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(37, 99, 235)
        doc.text(`[${typeLabels[q.type] || q.type?.toUpperCase()}]`, 15, y)
        doc.setTextColor(0, 0, 0)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        const qLines = doc.splitTextToSize(`${i + 1}. ${q.question}`, 175)
        doc.text(qLines, 30, y)
        y += qLines.length * 5 + 2

        if (q.options) {
          q.options.forEach((opt: string) => {
            if (y > 255) { addWatermark(); doc.addPage(); y = 20 }
            const optLines = doc.splitTextToSize(`   ${opt}`, 170)
            doc.text(optLines, 30, y)
            y += optLines.length * 5
          })
        }

        doc.setFont('helvetica', 'italic')
        doc.setTextColor(22, 101, 52)
        const ansLines = doc.splitTextToSize(`Answer: ${q.answer}`, 175)
        doc.text(ansLines, 30, y + 2)
        doc.setTextColor(0, 0, 0)
        y += ansLines.length * 5 + 10

        addWatermark()
        doc.setFontSize(10)
      })

      doc.save(`ReviseRight-${questionSet.subject}-Class${questionSet.class_level}.pdf`)
    } catch (err) {
      console.error('PDF error:', err)
      alert('PDF download failed. Please try again.')
    }
    setDownloading(false)
  }

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#6B7280'}}>Loading...</div>
  if (!questionSet) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#6B7280'}}>Question set not found.</div>

  const plan = PLANS[profile?.plan as keyof typeof PLANS] || PLANS.free
  const canDownload = plan.pdf
  const questions = questionSet.questions || []

  const typeLabels: Record<string, string> = {
    mcq: 'MCQ', fill: 'Fill in the blank', truefalse: 'True or False',
    oneword: 'One Word Answer', short: 'Short Answer', long: 'Long Answer',
    match: 'Match the Following', define: 'Define', critical: 'Critical Thinking'
  }

  const groupedQuestions: Record<string, any[]> = {}
  const questionIndices: Record<string, number[]> = {}
  let globalIndex = 0
  questions.forEach((q: any) => {
    if (!groupedQuestions[q.type]) { groupedQuestions[q.type] = []; questionIndices[q.type] = [] }
    groupedQuestions[q.type].push(q)
    questionIndices[q.type].push(globalIndex++)
  })

  return (
    <div style={{minHeight:'100vh',background:'#F9FAFB'}}>
      <Navbar user={user} />
      <div style={{maxWidth:'768px',margin:'0 auto',padding:'2.5rem 1.5rem'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem',gap:'1rem',flexWrap:'wrap'}}>
          <div>
            <h1 style={{fontSize:'22px',fontWeight:'500',color:'#111827'}}>{questionSet.subject}</h1>
            <p style={{color:'#6B7280',fontSize:'14px',marginTop:'4px'}}>Class {questionSet.class_level} · {questions.length} questions · {questionSet.pages_used} pages used</p>
          </div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            {canDownload ? (
              <button onClick={handleDownloadPDF} disabled={downloading}
                style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'14px',fontWeight:'500',cursor:'pointer',opacity:downloading?0.7:1}}>
                {downloading ? 'Preparing...' : '⬇ Download PDF'}
              </button>
            ) : (
              <Link href="/pricing" style={{background:'transparent',color:'#374151',border:'1px solid #D1D5DB',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:'500',textDecoration:'none'}}>Upgrade for PDF</Link>
            )}
            <Link href="/generate" style={{background:'transparent',color:'#374151',border:'1px solid #D1D5DB',borderRadius:'8px',padding:'9px 18px',fontSize:'14px',fontWeight:'500',textDecoration:'none'}}>+ New chapter</Link>
          </div>
        </div>

        {/* Upgrade banner */}
        {!canDownload && (
          <div style={{background:'#EFF6FF',border:'1px solid #DBEAFE',borderRadius:'12px',padding:'1rem 1.25rem',marginBottom:'1.5rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
            <p style={{fontSize:'14px',fontWeight:'500',color:'#1E3A8A'}}>PDF download available on Topper & Champion plans</p>
            <Link href="/pricing" style={{background:'#2563EB',color:'#fff',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:'500',textDecoration:'none',flexShrink:0}}>Upgrade</Link>
          </div>
        )}

        {/* Reveal all toggle */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem'}}>
          <p style={{fontSize:'13px',color:'#6B7280'}}>Click <strong>Show answer</strong> after attempting each question</p>
          <button onClick={toggleAll}
            style={{background:allRevealed?'#F3F4F6':'#2563EB',color:allRevealed?'#374151':'#fff',border:'1px solid',borderColor:allRevealed?'#D1D5DB':'#2563EB',borderRadius:'8px',padding:'7px 16px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>
            {allRevealed ? 'Hide all answers' : 'Reveal all answers'}
          </button>
        </div>

        {/* Questions */}
        <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
          {Object.entries(groupedQuestions).map(([type, qs]) => (
            <div key={type} style={{background:'#fff',border:'1px solid #E5E7EB',borderRadius:'12px',padding:'1.5rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'1.25rem',paddingBottom:'0.75rem',borderBottom:'1px solid #F3F4F6'}}>
                <span style={{background:'#DBEAFE',color:'#1D4ED8',fontSize:'12px',fontWeight:'500',padding:'3px 10px',borderRadius:'9999px'}}>{typeLabels[type] || type}</span>
                <span style={{fontSize:'14px',color:'#6B7280'}}>{qs.length} question{qs.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
                {qs.map((q: any, i: number) => {
                  const globalIdx = questionIndices[type][i]
                  const isRevealed = !!revealedAnswers[globalIdx]
                  return (
                    <div key={i} style={{borderBottom:'1px solid #F9FAFB',paddingBottom:'1.25rem'}}>
                      <p style={{fontSize:'15px',fontWeight:'500',color:'#1F2937',marginBottom:'0.5rem'}}>{i + 1}. {q.question}</p>
                      {q.options && (
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'0.75rem'}}>
                          {q.options.map((opt: string, oi: number) => (
                            <p key={oi} style={{fontSize:'13px',color:'#4B5563',background:'#F9FAFB',padding:'6px 10px',borderRadius:'6px'}}>{opt}</p>
                          ))}
                        </div>
                      )}
                      {isRevealed ? (
                        <div style={{background:'#F0FDF4',border:'1px solid #DCFCE7',borderRadius:'8px',padding:'10px 14px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'8px'}}>
                          <p style={{fontSize:'13px',color:'#166534'}}><strong>Answer:</strong> {q.answer}</p>
                          <button onClick={() => toggleAnswer(String(globalIdx))}
                            style={{background:'none',border:'none',color:'#6B7280',fontSize:'12px',cursor:'pointer',flexShrink:0,padding:'0'}}>Hide</button>
                        </div>
                      ) : (
                        <button onClick={() => toggleAnswer(String(globalIdx))}
                          style={{background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',color:'#374151',cursor:'pointer',fontWeight:'500',width:'100%',textAlign:'left'}}>
                          👁 Show answer
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
