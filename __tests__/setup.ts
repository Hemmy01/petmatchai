// Stub environment variables so modules that reference them don't throw
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.GROQ_API_KEY = 'test-groq-key'
process.env.BREVO_SMTP_LOGIN = 'test-smtp-login'
process.env.BREVO_SMTP_KEY = 'test-smtp-key'
process.env.BREVO_SENDER_EMAIL = 'test@example.com'
