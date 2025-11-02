# Database Seed Data

This directory contains seed data for local development.

## What's Included

The `seed.sql` file creates:

1. **User Account**
   - Email: `nduncan@mba2026.hbs.edu`
   - Password: `password123`
   - User ID: `f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f` (UUID)

2. **Companies**
   - `factory-ai`: Factory AI
   - `juicebox`: Juicebox
   - `openai`: OpenAI

3. **User Follows**
   - The user automatically follows all 3 companies

## How to Use

### Automatic Seeding (Recommended)

Seeds run automatically when you reset the database:

```bash
cd packages/supabase
supabase db reset
```

This will:

1. Drop and recreate the database
2. Run all migrations
3. Automatically run `seed.sql`

### Manual Seeding

If you just want to run the seed file without resetting:

```bash
psql -U postgres -d postgres -h localhost -p 54322 -f supabase/seed/seed.sql
```

## Customizing Companies

```sql
INSERT INTO public.company (
    id,
    name,
    website,
    linkedin_url,
    blog_url
) VALUES
    (
        'anthropic',                              -- Company ID (kebab-case)
        'Anthropic',                              -- Company name
        'https://anthropic.com',                  -- Website
        'https://linkedin.com/company/anthropic', -- LinkedIn
        'https://anthropic.com/news'              -- Blog URL
    );
```

### Suggested Company IDs

Use lowercase, kebab-case identifiers:

- `anthropic`
- `openai`
- `google-deepmind`
- `perplexity-ai`

## Verifying Seeds

After running seeds, verify the data:

```sql
-- Check user was created
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'nduncan@mba2026.hbs.edu';

-- Check companies
SELECT * FROM public.company;

-- Check follows
SELECT * FROM public.user_follow_company
WHERE user_id = 'f7b3c3e0-9f0a-4b5e-8d3c-1a2b3c4d5e6f';
```

Or access Supabase Studio at http://localhost:54323
