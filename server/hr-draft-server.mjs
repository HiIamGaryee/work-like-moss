import http from 'node:http'
import fs from 'node:fs'

for (const file of ['.env.local', '.env']) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!match || process.env[match[1]] !== undefined) continue
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  } catch {
    /* Environment variables may be supplied by the host instead. */
  }
}

const PORT = Number(process.env.AI_SERVER_PORT || 8787)
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'
const API_KEY = process.env.GEMINI_API_KEY
const MIN_GROUP_DETAIL_RESPONSES = 5
const MAX_BODY_BYTES = 64 * 1024

const GUARDRAILS = [
  'Use only the supplied structured evidence; do not invent facts.',
  'Do not identify employees or infer sensitive personal attributes.',
  'Do not claim causation. Distinguish observations from hypotheses.',
  'Suggest investigation areas for HR to verify, not conclusions.',
  'HR review is mandatory. Never approve, reject, or execute an action.',
]

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    evidenceThemes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          theme: { type: 'string' },
          reason: { type: 'string' },
          sourceCount: { type: 'integer' },
        },
        required: ['theme', 'reason', 'sourceCount'],
      },
    },
    possibleExplanation: { type: 'string' },
    investigationAreas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, reason: { type: 'string' } },
        required: ['title', 'reason'],
      },
    },
    suggestedActions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          measurementSuggestion: { type: 'string' },
        },
        required: ['title', 'description'],
      },
    },
    limitations: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'evidenceThemes', 'possibleExplanation', 'investigationAreas', 'suggestedActions', 'limitations'],
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value) => typeof value === 'string' && value.trim().length > 0

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) reject(new Error('Request too large'))
    })
    request.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid request')) }
    })
    request.on('error', reject)
  })
}

function safeInput(value) {
  if (!isRecord(value) || !isRecord(value.input)) return null
  const input = value.input
  if (!isText(input.signalTitle) || !isText(input.affectedGroup) || !isText(input.metric) ||
      !Number.isInteger(input.sampleSize) || input.sampleSize < MIN_GROUP_DETAIL_RESPONSES ||
      !Array.isArray(input.evidenceSources) || !Array.isArray(input.aggregatedThemes) ||
      !Array.isArray(input.likelyDrivers)) return null
  return {
    signalTitle: input.signalTitle,
    affectedGroup: input.affectedGroup,
    metric: input.metric,
    currentValue: typeof input.currentValue === 'number' ? input.currentValue : null,
    benchmark: typeof input.benchmark === 'number' ? input.benchmark : null,
    variance: typeof input.variance === 'number' ? input.variance : null,
    sampleSize: input.sampleSize,
    signalStrength: isText(input.signalStrength) ? input.signalStrength : 'unknown',
    evidenceSources: input.evidenceSources.filter(isText).slice(0, 8),
    aggregatedThemes: input.aggregatedThemes.filter(isText).slice(0, 12),
    likelyDrivers: input.likelyDrivers.filter(isText).slice(0, 8),
    ...(isText(input.existingRecommendationContext)
      ? { existingRecommendationContext: input.existingRecommendationContext }
      : {}),
  }
}

function promptFor(input) {
  return [
    'You are an HR drafting assistant. Produce a cautious draft for human HR review.',
    ...GUARDRAILS.map((guardrail) => `- ${guardrail}`),
    'Use this exact JSON structure and no markdown:',
    JSON.stringify(OUTPUT_SCHEMA),
    'Structured evidence:',
    JSON.stringify(input),
    'Use wording such as “Evidence suggests”, “may indicate”, and “HR should verify”.',
  ].join('\n')
}

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(body))
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/api/hr-draft') {
    send(response, 404, { error: 'Not found' })
    return
  }
  if (!API_KEY) {
    send(response, 503, { error: 'AI drafting is not configured' })
    return
  }
  try {
    const body = await readJson(request)
    const input = safeInput(body)
    if (!input) {
      send(response, 400, { error: 'Privacy-safe eligible input is required' })
      return
    }
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: 'You must follow the HR drafting guardrails exactly.' }] },
        contents: [{ parts: [{ text: promptFor(input) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: OUTPUT_SCHEMA },
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!upstream.ok) {
      send(response, 502, { error: 'AI provider unavailable' })
      return
    }
    const payload = await upstream.json()
    const text = payload?.candidates?.[0]?.content?.parts?.find((part) => isText(part?.text))?.text
    if (!text) {
      send(response, 502, { error: 'AI provider returned no draft' })
      return
    }
    try {
      send(response, 200, { draft: JSON.parse(text) })
    } catch {
      send(response, 502, { error: 'AI provider returned invalid JSON' })
    }
  } catch {
    send(response, 502, { error: 'AI drafting failed' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`HR draft server listening on http://127.0.0.1:${PORT}`)
})
