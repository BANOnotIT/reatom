import { next, geolocation } from '@vercel/edge'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qratowognuwxoywxegcs.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY as string
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})

export default async function middleware(req: Request): Promise<Response> {
  if (req.headers.get('accept')?.includes('text/html')) {
    try {
      await supabase.from('logs').insert({
        created_at: new Date().toISOString(),
        path: req.url,
        country: geolocation(req).country,
      })
    } catch (error) {
      console.error(error)
    }
  }

  return next()
}
