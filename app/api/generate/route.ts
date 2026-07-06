import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const TYPE_EXAMPLES: Record<string, string> = {
  mcq: `{"type": "mcq", "question": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A) ..."}`,
  fill: `{"type": "fill", "question": "The ___ is ...", "answer": "..."}`,
  truefalse: `{"type": "truefalse", "question": "...", "answer": "True"}`,
  oneword: `{"type": "oneword", "question": "...", "answer": "..."}`,
  short: `{"type": "short", "question": "...", "answer": "2-3 line answer"}`,
  long: `{"type": "long", "question": "...", "answer": "detailed answer"}`,
  match: `{"type": "match", "instruction": "Match the items in Column A with Column B", "leftColumn": ["1. Item one", "2. Item two", "3. Item three", "4. Item four", "5. Item five"], "rightColumn": ["a. Match one", "b. Match two", "c. Match three", "d. Match four", "e. Match five"], "answer": ["1-b", "2-a", "3-c", "4-e", "5-d"]}`,
  define: `{"type": "define", "question": "Define ...", "answer": "..."}`,
  critical: `{"type": "critical", "question": "Why/How/What if ...", "answer": "reasoning answer"}`,
}

const PAIRS_PER_MATCH_SET = 5

export async function POST(req: NextRequest) {
  try {
    const { images, subject, classLevel, questionTypes, userId } = await req.json()

    if (!images || images.length === 0) return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    if (images.length > 15) return NextResponse.json({ error: 'Maximum 15 pages allowed' }, { status: 400 })

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles').select('*').eq('id', userId).single()

    if (profileError || !profile) return NextResponse.json({ error: 'User not found' }, { status: 401 })

    const resetAt = new Date(profile.pages_reset_at)
    const now = new Date()
    const diffDays = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays >= 30) {
      await supabaseAdmin.from('profiles').update({ pages_used: 0, pages_reset_at: now.toISOString() }).eq('id', userId)
      profile.pages_used = 0
    }

    const planLimits: Record<string, number> = { free: 10, scholar: 200, topper: 500, champion: 800 }
    const limit = planLimits[profile.plan] || 10
    if ((profile.pages_used || 0) + images.length > limit) {
      return NextResponse.json({ error: `Page limit exceeded. You have ${limit - profile.pages_used} pages remaining.` }, { status: 400 })
    }

    const requestedTypeKeys = questionTypes.map((qt: any) => qt.type)
    const qtList = questionTypes.map((qt: any) => {
      if (qt.type === 'match') {
        return `- ${qt.count} SEPARATE Match the Following question sets, each with its own ${PAIRS_PER_MATCH_SET} pairs (Column A / Column B). These must be ${qt.count} distinct "match" objects in the questions array, not one object with more pairs.`
      }
      return `- ${qt.count} ${qt.label} questions`
    }).join('\n')

    const isMaths = ['maths', 'math', 'mathematics', 'ganit'].includes((subject || '').toLowerCase().trim())

    const exampleQuestions = requestedTypeKeys.map((key: string) => TYPE_EXAMPLES[key]).filter(Boolean).join(',\n    ')

    const systemPrompt = `You are an expert Indian school teacher creating revision questions. 
Generate questions appropriate for Class ${classLevel} students (aged ${classLevel + 5}-${classLevel + 6} years).
${isMaths ? 'This is a Maths chapter. Focus on numerical problems, calculations, and problem-solving. Use actual numbers and equations from the textbook pages.' : 'For Critical Thinking questions, create open-ended questions requiring reasoning beyond the text.'}
CRITICAL: Only generate the exact question types listed in the request below, in the exact counts specified. Do NOT add any other question type under any circumstances, even if it seems helpful.
CRITICAL SPELLING ACCURACY: If the textbook pages are in Hindi, Marathi, or any regional Indian language, read every character in the image extremely carefully before writing it. Character names, place names, and technical terms must be spelled EXACTLY as they appear in the image. Do not guess, autocomplete, or substitute a similar-looking word if you are not certain of the exact spelling — re-examine the image closely first. Getting a name wrong (e.g. one letter different) is a serious error for a student revision tool.
Return ONLY valid JSON. No markdown, no backticks, no explanation.`

    const userPrompt = `Based on these textbook pages${subject ? ` (${subject})` : ''}, generate for Class ${classLevel} ONLY the following, and nothing else:

${qtList}

For "Match the Following": if multiple sets are requested, create that many SEPARATE match objects in the questions array (each its own complete object with its own leftColumn, rightColumn, and answer) — do not merge them into one object with extra pairs. Each set should have ${PAIRS_PER_MATCH_SET} pairs unless the source material doesn't support that many, in which case use as many sensible pairs as the content allows. leftColumn and rightColumn must be arrays of equal length. The "answer" field must be an array mapping each left item to its right match (e.g. "1-b").

Return ONLY this JSON structure (matching exactly the types and counts requested above, nothing more):
{
  "title": "chapter topic",
  "questions": [
    ${exampleQuestions}
  ]
}`

    const imagesToProcess = images.slice(0, 10)
    const imageBlocks = imagesToProcess.map((base64: string) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: base64 }
    }))

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: userPrompt }]
      }]
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    
    let cleanText = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    
    const jsonStart = cleanText.indexOf('{')
    const jsonEnd = cleanText.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleanText = cleanText.substring(jsonStart, jsonEnd + 1)
    }

    const parsed = JSON.parse(cleanText)

    const requestedSet = new Set(requestedTypeKeys)
    const filteredQuestions = (parsed.questions || []).filter((q: any) => requestedSet.has(q.type))

    // Detect if content contains a regional Indian script (for the "verify spellings" disclaimer)
    const REGIONAL_SCRIPT_RANGES = [
      { start: 0x0900, end: 0x097F }, // Devanagari (Hindi, Marathi, Sanskrit, Nepali)
      { start: 0x0980, end: 0x09FF }, // Bengali
      { start: 0x0A00, end: 0x0A7F }, // Gurmukhi (Punjabi)
      { start: 0x0A80, end: 0x0AFF }, // Gujarati
      { start: 0x0B00, end: 0x0B7F }, // Odia
      { start: 0x0B80, end: 0x0BFF }, // Tamil
      { start: 0x0C00, end: 0x0C7F }, // Telugu
      { start: 0x0C80, end: 0x0CFF }, // Kannada
      { start: 0x0D00, end: 0x0D7F }, // Malayalam
    ]
    const allText = JSON.stringify(filteredQuestions)
    const containsRegionalScript = [...allText].some(char => {
      const code = char.codePointAt(0) || 0
      return REGIONAL_SCRIPT_RANGES.some(r => code >= r.start && code <= r.end)
    })

    const { data: questionSet } = await supabaseAdmin.from('question_sets').insert({
      user_id: userId,
      subject: subject || parsed.title || 'General',
      class_level: classLevel,
      pages_used: images.length,
      question_types: questionTypes,
      questions: filteredQuestions,
      contains_regional_script: containsRegionalScript
    }).select().single()

    await supabaseAdmin.from('profiles').update({
      pages_used: (profile.pages_used || 0) + images.length
    }).eq('id', userId)

    return NextResponse.json({ setId: questionSet.id, success: true })
  } catch (err: any) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: err.message || 'Generation failed. Please try with fewer pages or question types.' }, { status: 500 })
  }
}
