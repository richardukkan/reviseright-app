'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { PLANS } from '@/lib/plans'

const SCRIPT_RANGES: { name: string; fontFile: string; fontName: string; test: (code: number) => boolean }[] = [
  { name: 'Devanagari', fontFile: '/NotoSansDevanagari-Regular.ttf', fontName: 'NotoSansDevanagari', test: (c) => c >= 0x0900 && c <= 0x097F },
]

const detectScript = (text: string): string | null => {
  for (const char of text) {
    const code = char.codePointAt(0) || 0
    for (const script of SCRIPT_RANGES) {
      if (script.test(code)) return script.name
    }
  }
  return null
}

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

  const loadFontAsBase64 = async (url: string): Promise<string> => {
    const res = await fetch(url)
    const buffer = await res.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    return btoa(binary)
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const questions = questionSet.questions || []

      const allText = questions.map((q: any) => {
        let parts = [q.question || '', q.answer, q.instruction || '']
        if (Array.isArray(q.answer)) parts = [...parts, ...q.answer]
        if (q.options) parts = [...parts, ...q.options]
        if (q.leftColumn) parts = [...parts, ...q.leftColumn]
        if (q.rightColumn) parts = [...parts, ...q.rightColumn]
        return parts.filter(p => typeof p === 'string').join(' ')
      }).join(' ')

      const scriptsUsed = new Set<string>()
      for (const char of allText) {
        const code = char.codePointAt(0) || 0
        for (const script of SCRIPT_RANGES) {
          if (script.test(code)) scriptsUsed.add(script.name)
        }
      }

      const loadedFonts: Record<string, string> = {}

      for (const scriptName of scriptsUsed) {
        const script = SCRIPT_RANGES.find(s => s.name === scriptName)
        if (!script) continue
        try {
          const fontBase64 = await loadFontAsBase64(script.fontFile)
          const vfsName = `${script.fontName}.ttf`
          doc.addFileToVFS(vfsName, fontBase64)
          doc.addFont(vfsName, script.fontName, 'normal')
          loadedFonts[scriptName] = script.fontName
        } catch (fontErr) {
          console.error(`Failed to load font for ${scriptName}:`, fontErr)
        }
      }

      const setFontForText = (text: string, style: 'normal' | 'bold' = 'normal') => {
        const script = detectScript(text)
        if (script && loadedFonts[script]) {
          doc.setFont(loadedFonts[script], 'normal')
        } else {
          doc.setFont('helvetica', style)
        }
      }

      const pageW = 210
      const pageH = 297
      const mL = 15
      const mR = 15
      const cW = pageW - mL - mR
      const mBot = 18
      const maxY = pageH - mBot
      const lineH = 5.5

      const typeLabels: Record<string, string> = {
        mcq: 'MCQ', fill: 'Fill in the Blank', truefalse: 'True or False',
        oneword: 'One Word Answer', short: 'Short Answer', long: 'Long Answer',
        match: 'Match the Following', define: 'Define', critical: 'Critical Thinking'
      }

      const name = profile.name || ''
      const email = profile.email || ''
      const phone = profile.phone || ''
      const showSpellingWarning = !!questionSet.contains_regional_script

      const barPadX = 2
      const barFontSize = 7
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(barFontSize)
      const line1Text = `WARNING — GENERATED FOR: ${name}  |  ${email}${phone ? '  |  ' + phone : ''}`
      const line2Text = `ReviseRight.in  |  NOT FOR REDISTRIBUTION  |  Sharing this document is a violation of terms.`
      const line1Wrapped = doc.splitTextToSize(line1Text, cW - barPadX * 2)
      const line2Wrapped = doc.splitTextToSize(line2Text, cW - barPadX * 2)
      const barLines = [...line1Wrapped, ...line2Wrapped]
      const barLineH = 3.6
      const barTopY = 4
      const barInnerPad = 3
      const barH = barLines.length * barLineH + barInnerPad * 2 - 1.5

      // --- Spelling verification notice (separate box, only when regional script detected) ---
      const spellingNoticeText = 'NOTE: This content includes Hindi/regional language text generated by AI. Please cross-check all spellings against your original textbook before relying on this for exams.'
      let spellingBarH = 0
      let spellingBarLines: string[] = []
      if (showSpellingWarning) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        spellingBarLines = doc.splitTextToSize(spellingNoticeText, cW - barPadX * 2)
        spellingBarH = spellingBarLines.length * barLineH + barInnerPad * 2 - 1.5
      }

      const gapBetweenBars = showSpellingWarning ? 3 : 0
      const mTop = barTopY + barH + gapBetweenBars + spellingBarH + 8

      const drawTopBar = () => {
        doc.setFillColor(255, 243, 205)
        doc.rect(mL, barTopY, cW, barH, 'F')
        doc.setDrawColor(230, 160, 0)
        doc.setLineWidth(0.4)
        doc.rect(mL, barTopY, cW, barH, 'S')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(barFontSize)
        doc.setTextColor(120, 60, 0)
        let ty = barTopY + barInnerPad + 2.5
        barLines.forEach((line: string) => {
          doc.text(line, mL + barPadX, ty)
          ty += barLineH
        })
        doc.setLineWidth(0.2)

        if (showSpellingWarning) {
          const spellingBarTopY = barTopY + barH + gapBetweenBars
          doc.setFillColor(224, 242, 254)
          doc.rect(mL, spellingBarTopY, cW, spellingBarH, 'F')
          doc.setDrawColor(56, 139, 216)
          doc.setLineWidth(0.4)
          doc.rect(mL, spellingBarTopY, cW, spellingBarH, 'S')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7)
          doc.setTextColor(12, 74, 110)
          let sty = spellingBarTopY + barInnerPad + 2.5
          spellingBarLines.forEach((line: string) => {
            doc.text(line, mL + barPadX, sty)
            sty += barLineH
          })
          doc.setLineWidth(0.2)
        }
      }

      const drawFooter = (pageNum: number) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(160, 160, 160)
        doc.text(`${name} | ${email} | ReviseRight.in`, mL, pageH - 5)
        doc.text(`Page ${pageNum}`, pageW - mR, pageH - 5, { align: 'right' })
        doc.setTextColor(0, 0, 0)
      }

      let y = mTop
      let currentPage = 1
      drawTopBar()
      drawFooter(currentPage)

      const newPage = () => {
        drawFooter(currentPage)
        doc.addPage()
        currentPage++
        y = mTop
        drawTopBar()
      }

      const estimateH = (text: string, fontSize: number, width: number): number => {
        setFontForText(text)
        doc.setFontSize(fontSize)
        const lines = doc.splitTextToSize(text, width)
        return lines.length * lineH
      }

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(37, 99, 235)
      doc.text(questionSet.subject || 'Revision Questions', mL, y)
      y += 7

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Class ${questionSet.class_level}  ·  ${questions.length} Questions  ·  ReviseRight.in`, mL, y)
      y += 4

      doc.setDrawColor(37, 99, 235)
      doc.setLineWidth(0.5)
      doc.line(mL, y, pageW - mR, y)
      y += 6
      doc.setLineWidth(0.2)
      doc.setDrawColor(200, 200, 200)

      const grouped: Record<string, any[]> = {}
      questions.forEach((q: any) => {
        if (!grouped[q.type]) grouped[q.type] = []
        grouped[q.type].push(q)
      })

      let globalNum = 1

      Object.entries(grouped).forEach(([type, qs]) => {
        if (y + 14 > maxY) newPage()

        y += 3
        doc.setFillColor(37, 99, 235)
        doc.rect(mL, y - 4, cW, 8, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        doc.text(`${typeLabels[type] || type}   (${qs.length} question${qs.length > 1 ? 's' : ''})`, mL + 3, y)
        y += 8
        doc.setTextColor(0, 0, 0)

        qs.forEach((q: any) => {

          if (type === 'match') {
            const instructionText = q.instruction || 'Match the following:'
            const instruction = `${globalNum}. ${instructionText}`
            const leftCol: string[] = q.leftColumn || []
            const rightCol: string[] = q.rightColumn || []
            const rowCount = Math.max(leftCol.length, rightCol.length)
            const colW = cW / 2 - 4

            const instrH = estimateH(instruction, 10, cW)
            const rowsH = rowCount * lineH + 6
            const answerText = Array.isArray(q.answer) ? q.answer.join(', ') : String(q.answer || '')
            const ansH = estimateH(`Answer: ${answerText}`, 9.5, cW - 10) + 8
            const totalH = instrH + rowsH + ansH + 12

            if (y + totalH > maxY) newPage()

            y += 3
            setFontForText(instruction, 'bold')
            doc.setFontSize(10)
            doc.setTextColor(17, 24, 39)
            const instrLines = doc.splitTextToSize(instruction, cW)
            doc.text(instrLines, mL, y)
            y += instrLines.length * lineH + 3

            doc.setFont('helvetica', 'bold')
            doc.setFontSize(9)
            doc.setTextColor(37, 99, 235)
            doc.text('Column A', mL + 2, y)
            doc.text('Column B', mL + cW / 2 + 2, y)
            y += lineH

            doc.setDrawColor(220, 220, 220)
            doc.line(mL + cW / 2, y - rowCount * lineH - 2, mL + cW / 2, y + rowCount * lineH)

            doc.setFontSize(9.5)
            doc.setTextColor(55, 65, 81)
            for (let i = 0; i < rowCount; i++) {
              const leftText = leftCol[i] || ''
              const rightText = rightCol[i] || ''
              setFontForText(leftText)
              const leftLines = doc.splitTextToSize(leftText, colW)
              doc.text(leftLines, mL + 2, y)
              setFontForText(rightText)
              const rightLines = doc.splitTextToSize(rightText, colW)
              doc.text(rightLines, mL + cW / 2 + 2, y)
              y += Math.max(leftLines.length, rightLines.length, 1) * lineH
            }
            y += 3

            const pad = 4
            setFontForText(answerText)
            doc.setFontSize(9.5)
            const answerBody = doc.splitTextToSize(answerText, cW - pad * 2 - 18)
            const boxH = answerBody.length * lineH + pad * 2 + 2

            if (y + boxH > maxY) newPage()

            doc.setFillColor(240, 253, 244)
            doc.setDrawColor(134, 239, 172)
            doc.setLineWidth(0.3)
            doc.rect(mL, y, cW, boxH, 'FD')
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(22, 101, 52)
            doc.text('Answer:', mL + pad, y + pad + 3.5)
            setFontForText(answerText)
            doc.text(answerBody, mL + pad + 18, y + pad + 3.5)

            y += boxH + 6
            doc.setTextColor(0, 0, 0)
            doc.setDrawColor(200, 200, 200)
            doc.setLineWidth(0.2)

            globalNum++
            return
          }

          const qText = `${globalNum}. ${q.question}`
          const qH = estimateH(qText, 10, cW)

          let optH = 0
          if (q.options) {
            q.options.forEach((opt: string) => {
              optH += estimateH(opt, 9.5, cW / 2 - 4)
            })
            optH = Math.ceil(q.options.length / 2) * lineH + 4
          }

          const ansText = String(q.answer)
          const ansH = estimateH(`Answer: ${ansText}`, 9.5, cW - 10) + 8
          const totalH = qH + optH + ansH + 10

          if (y + totalH > maxY) newPage()

          y += 3
          setFontForText(qText, 'bold')
          doc.setFontSize(10)
          doc.setTextColor(17, 24, 39)
          const qLines = doc.splitTextToSize(qText, cW)
          doc.text(qLines, mL, y)
          y += qLines.length * lineH + 2

          if (q.options && q.options.length > 0) {
            doc.setFontSize(9.5)
            doc.setTextColor(55, 65, 81)
            for (let i = 0; i < q.options.length; i += 2) {
              const opt1Text = q.options[i] || ''
              const opt2Text = q.options[i+1] || ''
              setFontForText(opt1Text)
              const opt1Lines = doc.splitTextToSize(opt1Text, cW / 2 - 4)
              doc.text(opt1Lines, mL + 4, y)
              if (opt2Text) {
                setFontForText(opt2Text)
                const opt2Lines = doc.splitTextToSize(opt2Text, cW / 2 - 4)
                doc.text(opt2Lines, mL + cW / 2 + 2, y)
                y += Math.max(opt1Lines.length, opt2Lines.length) * lineH
              } else {
                y += opt1Lines.length * lineH
              }
            }
            y += 2
          }

          if (y + ansH > maxY) {
            newPage()
            setFontForText(qText, 'bold')
            doc.setFontSize(10)
            doc.setTextColor(17, 24, 39)
            doc.text(qLines, mL, y)
            y += qLines.length * lineH + 2
            if (q.options && q.options.length > 0) {
              doc.setFontSize(9.5)
              doc.setTextColor(55, 65, 81)
              for (let i = 0; i < q.options.length; i += 2) {
                const opt1Text = q.options[i] || ''
                const opt2Text = q.options[i+1] || ''
                setFontForText(opt1Text)
                const opt1Lines = doc.splitTextToSize(opt1Text, cW / 2 - 4)
                doc.text(opt1Lines, mL + 4, y)
                if (opt2Text) {
                  setFontForText(opt2Text)
                  const opt2Lines = doc.splitTextToSize(opt2Text, cW / 2 - 4)
                  doc.text(opt2Lines, mL + cW / 2 + 2, y)
                  y += Math.max(opt1Lines.length, opt2Lines.length) * lineH
                } else {
                  y += opt1Lines.length * lineH
                }
              }
              y += 2
            }
          }

          const pad = 4
          const answerLabel = 'Answer:'
          setFontForText(ansText)
          doc.setFontSize(9.5)
          const answerBody = doc.splitTextToSize(ansText, cW - pad * 2 - 18)
          const boxH = answerBody.length * lineH + pad * 2 + 2

          doc.setFillColor(240, 253, 244)
          doc.setDrawColor(134, 239, 172)
          doc.setLineWidth(0.3)
          doc.rect(mL, y, cW, boxH, 'FD')

          doc.setFont('helvetica', 'bold')
          doc.setTextColor(22, 101, 52)
          doc.text(answerLabel, mL + pad, y + pad + 3.5)

          setFontForText(ansText)
          doc.setTextColor(30, 30, 30)
          doc.text(answerBody, mL + pad + 18, y + pad + 3.5)

          y += boxH + 6

          doc.setTextColor(0, 0, 0)
          doc.setDrawColor(200, 200, 200)
          doc.setLineWidth(0.2)

          globalNum++
        })

        y += 4
      })

      drawFooter(currentPage)

      doc.save(`ReviseRight-${questionSet.subject}-Class${questionSet.class_level}.pdf`)
    } catch (err: any) {
      console.error('PDF error:', err)
      alert('PDF download failed: ' + err.message)
    }
    setDownloading(false)
  }

  if (loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#6B7280'}}>Loading...</div>
  if (!questionSet) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#6B7280'}}>Question set not found.</div>

  const plan = PLANS[profile?.plan as keyof typeof PLANS] || PLANS.free
  const canDownload = plan.pdf
  const questions = questionSet.questions || []
  const showSpellingWarning = !!questionSet.contains_regional_script

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

        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'1.5rem',gap:'1rem',flexWrap:'wrap'}}>
          <div>
            <h1 style={{fontSize:'22px',fontWeight:'500',color:'#111827'}}>{questionSet.subject}</h1>
            <p style={{color:'#6B7280',fontSize:'14px',marginTop:'4px'}}>Class {questionSet.class_level} · {questions.length} questions · {questionSet.pages_used} pages used</p>
          </div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            {canDownload ? (
              <button onClick={handleDownloadPDF} disabled={downloading}
                style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'14px',fontWeight:'500',cursor:'pointer',opacity:downloading?0.7:1}}>
                {downloading ? 'Preparing PDF...' : '⬇ Download PDF'}
              </button>
            ) : (
              <Link href="/pricing" style={{background:'transparent',color:'#374151',border:'1px solid #D1D5DB',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:'500',textDecoration:'none'}}>Upgrade for PDF</Link>
            )}
            <Link href="/generate" style={{background:'transparent',color:'#374151',border:'1px solid #D1D5DB',borderRadius:'8px',padding:'9px 18px',fontSize:'14px',fontWeight:'500',textDecoration:'none'}}>+ New chapter</Link>
          </div>
        </div>

        {/* Spelling verification notice for regional-language content */}
        {showSpellingWarning && (
          <div style={{background:'#F0F9FF',border:'1px solid #BAE6FD',borderRadius:'12px',padding:'0.85rem 1.25rem',marginBottom:'1.25rem',display:'flex',alignItems:'flex-start',gap:'10px'}}>
            <span style={{fontSize:'16px',flexShrink:0}}>ℹ️</span>
            <p style={{fontSize:'13px',color:'#075985',lineHeight:'1.5'}}>This content includes Hindi/regional language text generated by AI. Please cross-check all spellings and names against your original textbook before relying on this for exams.</p>
          </div>
        )}

        {!canDownload && (
          <div style={{background:'#EFF6FF',border:'1px solid #DBEAFE',borderRadius:'12px',padding:'1rem 1.25rem',marginBottom:'1.5rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}>
            <p style={{fontSize:'14px',fontWeight:'500',color:'#1E3A8A'}}>PDF download available on Topper & Champion plans</p>
            <Link href="/pricing" style={{background:'#2563EB',color:'#fff',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:'500',textDecoration:'none',flexShrink:0}}>Upgrade</Link>
          </div>
        )}

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.25rem',flexWrap:'wrap',gap:'8px'}}>
          <p style={{fontSize:'13px',color:'#6B7280'}}>Click <strong>Show answer</strong> after attempting each question</p>
          <button onClick={toggleAll}
            style={{background:allRevealed?'#F3F4F6':'#2563EB',color:allRevealed?'#374151':'#fff',border:'1px solid',borderColor:allRevealed?'#D1D5DB':'#2563EB',borderRadius:'8px',padding:'7px 16px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>
            {allRevealed ? 'Hide all answers' : 'Reveal all answers'}
          </button>
        </div>

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

                  if (type === 'match') {
                    const leftCol: string[] = q.leftColumn || []
                    const rightCol: string[] = q.rightColumn || []
                    const rowCount = Math.max(leftCol.length, rightCol.length)
                    const answerText = Array.isArray(q.answer) ? q.answer.join(', ') : String(q.answer || '')
                    return (
                      <div key={i} style={{borderBottom:'1px solid #F9FAFB',paddingBottom:'1.25rem'}}>
                        <p style={{fontSize:'15px',fontWeight:'500',color:'#1F2937',marginBottom:'0.75rem'}}>{i + 1}. {q.instruction || 'Match the following:'}</p>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0',border:'1px solid #E5E7EB',borderRadius:'8px',overflow:'hidden',marginBottom:'0.75rem'}}>
                          <div style={{padding:'8px 12px',background:'#EFF6FF',fontWeight:'600',fontSize:'13px',color:'#1D4ED8',borderRight:'1px solid #E5E7EB',borderBottom:'1px solid #E5E7EB'}}>Column A</div>
                          <div style={{padding:'8px 12px',background:'#EFF6FF',fontWeight:'600',fontSize:'13px',color:'#1D4ED8',borderBottom:'1px solid #E5E7EB'}}>Column B</div>
                          {Array.from({ length: rowCount }).map((_, rowI) => (
                            <>
                              <div key={`l-${rowI}`} style={{padding:'8px 12px',fontSize:'14px',color:'#374151',borderRight:'1px solid #F3F4F6',borderBottom: rowI < rowCount - 1 ? '1px solid #F3F4F6' : 'none'}}>{leftCol[rowI] || ''}</div>
                              <div key={`r-${rowI}`} style={{padding:'8px 12px',fontSize:'14px',color:'#374151',borderBottom: rowI < rowCount - 1 ? '1px solid #F3F4F6' : 'none'}}>{rightCol[rowI] || ''}</div>
                            </>
                          ))}
                        </div>
                        {isRevealed ? (
                          <div style={{background:'#F0FDF4',border:'1px solid #DCFCE7',borderRadius:'8px',padding:'10px 14px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'8px'}}>
                            <p style={{fontSize:'13px',color:'#166534'}}><strong>Answer:</strong> {answerText}</p>
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
                  }

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
