declare module 'npm:zod@4.3.6' {
  export * from 'zod'
}

declare module 'npm:@supabase/supabase-js@2.86.2' {
  export * from '@supabase/supabase-js'
}

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}
