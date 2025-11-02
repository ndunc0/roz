-- Seed script for local development
--
-- RECOMMENDED: Use `supabase db reset` which automatically runs supabase/seed/seed.sql
-- This file can be used for manual seeding if needed:
-- Run with: psql -U postgres -d postgres -h localhost -p 54322 -f seed.sql

BEGIN;

-- 1. Create user in auth.users
-- Note: In local dev, we need to insert directly into auth.users
-- The id is a UUID that will be referenced in user_follow_company
INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
) VALUES (
    'f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f', -- Static UUID for dev
    '00000000-0000-0000-0000-000000000000',
    'nduncan@mba2026.hbs.edu',
    crypt('password123', gen_salt('bf')), -- Default password: 'password123'
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    'authenticated',
    'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Optional: Create an identity record for email auth
INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    'f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f',
    'f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f',
    'f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f',
    jsonb_build_object('sub', 'f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f', 'email', 'nduncan@mba2026.hbs.edu'),
    'email',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- 2. Create companies
-- TODO: Fill in with actual company details
INSERT INTO public.company (
    id,
    name,
    website,
    linkedin_url,
    blog_url
) VALUES
    (
        'factory-ai',
        'Factory AI',
        'https://factory.ai',
        'https://linkedin.com/company/factory-hq',
        'https://factory.ai/news' 
    ),
    (
        'juicebox',
        'Juicebox', 
        'https://juicebox.ai',
        'https://linkedin.com/company/juicebox-work',
        'https://juicebox.ai/blog' 
    ),
    (
        'openai',
        'OpenAI',
        'https://openai.com',
        'https://linkedin.com/company/openai',
        'https://openai.com/news'
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Set up user follows for all companies
INSERT INTO public.user_follow_company (
    user_id,
    company_id
) VALUES
    ('f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f', 'factory-ai'),
    ('f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f', 'juicebox'),
    ('f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f', 'openai')
ON CONFLICT (user_id, company_id) DO NOTHING;

COMMIT;

-- Verification queries (optional - comment these out when running the seed)
-- SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'nduncan@mba2026.hbs.edu';
-- SELECT * FROM public.company;
-- SELECT * FROM public.user_follow_company WHERE user_id = 'f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f';
