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
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const questions = questionSet.questions || []
      const pageW = 210
      const marginL = 15
      const marginR = 15
      const contentW = pageW - marginL - marginR  // 180mm
      const pageH = 297
      const marginTop = 28
      const marginBottom = 22
      const maxY = pageH - marginBottom

      const typeLabels: Record<string, string> = {
        mcq: 'MCQ', fill: 'Fill in the Blank', truefalse: 'True or False',
        oneword: 'One Word Answer', short: 'Short Answer', long: 'Long Answer',
        match: 'Match the Following', define: 'Define', critical: 'Critical Thinking'
      }

      const watermarkText = `⚠ Generated for: ${profile.name} | ${profile.email}${profile.phone ? ' | ' + profile.phone : ''} — ReviseRight.in | NOT FOR REDISTRIBUTION`

      const addPageDecorations = () => {
        // Top watermark - prominent warning
        doc.setFillColor(255, 243, 205)
        doc.rect(marginL, 5, contentW, 10, 'F')
        doc.setDrawColor(255, 193, 7)
        doc.rect(marginL, 5, contentW, 10, 'S')
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(133, 77, 14)
        const wmLines = doc.splitTextToSize(watermarkText, contentW - 4)
        doc.text(wmLines, marginL + 2, 11)

        // Bottom watermark - subtle
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(180, 180, 180)
        doc.text(`${profile.name} | ${profile.email} | ReviseRight.in`, marginL, pageH - 5)
        doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, pageW - marginR, pageH - 5, { align: 'right' })

        // Reset
        doc.setTextColor(0, 0, 0)
        doc.setDrawColor(0, 0, 0)
      }

      // Check if we need a new page
      const checkPage = (neededHeight: number) => {
        if (y + neededHeight > maxY) {
          addPageDecorations()
          doc.addPage()
          y = marginTop
        }
      }

      let y = marginTop

      // Title page header
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(37, 99, 235)
      doc.text(`${questionSet.subject}`, marginL, y)
      y += 8

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(`Class ${questionSet.class_level}  ·  ${questions.length} Questions  ·  ReviseRight.in`, marginL, y)
      y += 6

      // Divider line
      doc.setDrawColor(37, 99, 235)
      doc.setLineWidth(0.5)
      doc.line(marginL, y, pageW - marginR, y)
      y += 8
      doc.setLineWidth(0.2)
      doc.setDrawColor(0, 0, 0)

      // Group questions by type
      const grouped: Record<string, any[]> = {}
      questions.forEach((q: any) => {
        if (!grouped[q.type]) grouped[q.type] = []
        grouped[q.type].push(q)
      })

      let globalNum = 1

      Object.entries(grouped).forEach(([type, qs]) => {
        // Section header
        checkPage(16)
        y += 4
        doc.setFillColor(37, 99, 235)
        doc.rect(marginL, y - 5, contentW, 8, 'F')
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        doc.text(`${typeLabels[type] || type}  (${qs.length} questions)`, marginL + 3, y)
        y += 7
        doc.setTextColor(0, 0, 0)

        qs.forEach((q: any) => {
          // Question number + text
          checkPage(12)
          y += 3

          // Question label box
          doc.setFillColor(240, 245, 255)
          doc.setDrawColor(200, 215, 255)
          const qLines = doc.splitTextToSize(`${globalNum}. ${q.question}`, contentW - 4)
          const qBoxH = qLines.length * 5 + 6
          checkPage(qBoxH)
          doc.rect(marginL, y - 4, contentW, qBoxH, 'FD')
          doc.setFontSize(10)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(17, 24, 39)
          doc.text(qLines, marginL + 2, y)
          y += qBoxH - 2

          // Options for MCQ
          if (q.options && q.options.length > 0) {
            y += 2
            // 2 options per row
            const optPairs = []
            for (let i = 0; i < q.options.length; i += 2) {
              optPairs.push([q.options[i], q.options[i+1]])
            }
            optPairs.forEach(pair => {
              checkPage(7)
              doc.setFontSize(9.5)
              doc.setFont('helvetica', 'normal')
              doc.setTextColor(55, 65, 81)
              const opt1 = doc.splitTextToSize(pair[0] || '', contentW / 2 - 5)
              doc.text(opt1, marginL + 4, y)
              if (pair[1]) {
                const opt2 = doc.splitTextToSize(pair[1], contentW / 2 - 5)
                doc.text(opt2, marginL + contentW / 2 + 2, y)
              }
              y += Math.max(opt1.length, 1) * 5
            })
          }

          // Answer box
          y += 2
          const answerText = `Answer: ${q.answer}`
          const ansLines = doc.splitTextToSize(answerText, contentW - 8)
          const ansBoxH = ansLines.length * 5 + 6
          checkPage(ansBoxH)
          doc.setFillColor(240, 253, 244)
          doc.setDrawColor(134, 239, 172)
          doc.rect(marginL, y - 4, contentW, ansBoxH, 'FD')
          doc.setFontSize(9.5)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(22, 101, 52)
          // Write "Answer:" label
          doc.text('Answer:', marginL + 2, y)
          // Write answer text indented
          doc.setFont('helvetica', 'normal')
          const answerOnly = doc.splitTextToSize(q.answer, contentW - 22)
          doc.text(answerOnly, marginL + 18, y)
          y += Math.max(ansLines.length, answerOnly.length) * 5 + 2

          doc.setTextColor(0, 0, 0)
          doc.setDrawColor(0, 0, 0)

          globalNum++
        })

        y += 4
      })

      // Add decorations to last page
      addPageDecorations()

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
