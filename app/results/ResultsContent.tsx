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

      questions.forEach((q: any, i: number) => {
        if (y > 255) {
          // Add watermark before new page
          doc.setFontSize(7)
          doc.setTextColor(210, 210, 210)
          doc.text(`${profile.name} | ${profile.email} | ReviseRight.in`, 15, 288)
          doc.addPage()
          doc.setTextColor(0, 0, 0)
          y = 20
        }

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
            if (y > 255) {
              doc.setFontSize(7); doc.setTextColor(210,210,210)
              doc.text(`${profile.name} | ${profile.email} | ReviseRight.in`, 15, 288)
              doc.addPage(); doc.setTextColor(0,0,0); y = 20
            }
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

        // Bottom watermark
        doc.setFontSize(7)
        doc.setTextColor(210, 210, 210)
        doc.text(`${profile.name} | ${profile.email} | ReviseRight.in`, 15, 288)
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(10)
      })

      doc.save(`ReviseRight-${questionSet.subject}-Class${questionSet.class_level}.pdf`)
    } catch (err) {
      console.error(err)
    }
    setDownloading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div style={{color:"#6B7280"}}>Loading...</div></div>
  if (!questionSet) return <div className="min-h-screen flex items-center justify-center"><div style={{color:"#6B7280"}}>Question set not found.</div></div>

  const plan = PLANS[profile?.plan as keyof typeof PLANS] || PLANS.free
  const canDownload = plan.pdf
  const questions = questionSet.questions || []

  const typeLabels: Record<string, string> = {
    mcq: 'MCQ', fill: 'Fill in the blank', truefalse: 'True or False',
    oneword: 'One Word Answer', short: 'Short Answer', long: 'Long Answer',
    match: 'Match the Following', define: 'Define', critical: 'Critical Thinking'
  }

  const groupedQuestions: Record<string, any[]> = {}
  questions.forEach((q: any) => {
    if (!groupedQuestions[q.type]) groupedQuestions[q.type] = []
    groupedQuestions[q.type].push(q)
  })

  return (
    <div style={{minHeight:'100vh',background:'#F9FAFB'}}>
      <Navbar user={user} />
      <div style={{maxWidth:'768px',margin:'0 auto',padding:'2.5rem 1.5rem'}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'2rem',gap:'1rem'}}>
          <div>
            <h1 style={{fontSize:'1.5rem',fontWeight:'500',color:'#111827'}}>{questionSet.subject}</h1>
            <p style={{color:'#6B7280',fontSize:'0.875rem',marginTop:'0.25rem'}}>Class {questionSet.class_level} · {questions.length} questions · {questionSet.pages_used} pages used</p>
          </div>
          <div style={{display:'flex',gap:'0.75rem',flexShrink:0}}>
            {canDownload ? (
              <button onClick={handleDownloadPDF} disabled={downloading} className="btn-primary">
                {downloading ? 'Preparing...' : '⬇ Download PDF'}
              </button>
            ) : (
              <Link href="/pricing" className="btn-outline" style={{fontSize:'0.8125rem'}}>Upgrade for PDF</Link>
            )}
            <Link href="/generate" className="btn-outline">+ New chapter</Link>
          </div>
        </div>

        {!canDownload && (
          <div style={{background:'#EFF6FF',border:'1px solid #DBEAFE',borderRadius:'0.75rem',padding:'1rem 1.25rem',marginBottom:'1.5rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem'}}>
            <div>
              <p style={{fontSize:'0.875rem',fontWeight:'500',color:'#1E3A8A'}}>PDF download on Topper & Champion plans</p>
              <p style={{fontSize:'0.75rem',color:'#2563EB',marginTop:'0.125rem'}}>Watermarked with your name and email</p>
            </div>
            <Link href="/pricing" className="btn-primary" style={{fontSize:'0.8125rem',padding:'0.5rem 1rem',flexShrink:0}}>Upgrade</Link>
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
          {Object.entries(groupedQuestions).map(([type, qs]) => (
            <div key={type} className="card">
              <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'1.25rem',paddingBottom:'0.75rem',borderBottom:'1px solid #F3F4F6'}}>
                <span style={{background:'#DBEAFE',color:'#1D4ED8',fontSize:'0.75rem',fontWeight:'500',padding:'0.25rem 0.75rem',borderRadius:'9999px'}}>
                  {typeLabels[type] || type}
                </span>
                <span style={{fontSize:'0.875rem',color:'#6B7280'}}>{qs.length} question{qs.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'1.25rem'}}>
                {qs.map((q: any, i: number) => (
                  <div key={i} style={{borderBottom:'1px solid #F9FAFB',paddingBottom:'1rem'}} className="last:border-0 last:pb-0">
                    <p style={{fontSize:'0.9375rem',fontWeight:'500',color:'#1F2937',marginBottom:'0.5rem'}}>{i + 1}. {q.question}</p>
                    {q.options && (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.375rem',marginBottom:'0.5rem'}}>
                        {q.options.map((opt: string, oi: number) => (
                          <p key={oi} style={{fontSize:'0.8125rem',color:'#4B5563',background:'#F9FAFB',padding:'0.375rem 0.75rem',borderRadius:'0.375rem'}}>{opt}</p>
                        ))}
                      </div>
                    )}
                    <div style={{background:'#F0FDF4',border:'1px solid #DCFCE7',borderRadius:'0.5rem',padding:'0.625rem 0.875rem',marginTop:'0.5rem'}}>
                      <p style={{fontSize:'0.8125rem',color:'#166534'}}><strong>Answer:</strong> {q.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
