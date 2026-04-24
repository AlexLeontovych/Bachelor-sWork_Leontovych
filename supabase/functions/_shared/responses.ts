import { corsHeaders } from './cors.ts'

export const handleOptionsRequest = (request: Request) => {
  if (request.method !== 'OPTIONS') {
    return null
  }

  return new Response('ok', {
    headers: corsHeaders
  })
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
