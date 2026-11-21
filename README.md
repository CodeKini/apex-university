# Apex University

Apex University is an online course platform where students can browse and enroll in courses, and admins can manage course content. It includes user authentication, role-based admin and student access, and Stripe payments for course enrollment.

## Tech stack

Next.js, TypeScript, Supabase, Stripe, and Tailwind CSS.

## Database

The app's data layer is Supabase (Postgres), with a relational schema designed for the app. The SQL lives in the `supabase` folder, including `schema.sql`, `rls.sql`, and the migration and seed files.

## Deployment

The app is deployed on Vercel. See `SETUP.md` for setup, environment variables, and deployment instructions.
