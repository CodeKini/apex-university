-- ============================================================
-- APEX UNIVERSITY — SEED DATA
-- Run AFTER schema.sql and rls.sql.
-- Creates 5 sample courses, modules, and lessons.
-- REPLACE thumbnail_url values with your real Supabase Storage URLs.
-- ============================================================

-- ============================================================
-- COURSE 1: Wealth Foundations
-- ============================================================
insert into public.courses (id, slug, title, short_desc, long_desc, price, difficulty, duration_hrs, is_published, outcomes)
values (
  'c1000000-0000-0000-0000-000000000001',
  'wealth-foundations',
  'Wealth Foundations',
  'Build the money mindset and financial systems that create lasting wealth.',
  'Most people never build real wealth because they skip the foundations. This course rewires how you think about money, teaches you how to build a budget that actually sticks, and walks you step-by-step through investing your first dollars — all the way to building multiple streams of income. Whether you are starting from zero or rebuilding after setbacks, this program gives you the blueprint the wealthy use.',
  497.00,
  'Beginner',
  12.5,
  true,
  array[
    'Adopt the mindset patterns used by self-made millionaires',
    'Build a personal budget that creates surplus every month',
    'Open and manage your first investment account',
    'Create your first passive income stream within 90 days'
  ]
);

-- Modules for Wealth Foundations
insert into public.modules (id, course_id, title, description, position) values
  ('aa100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Money Mindset', 'Reprogram your beliefs about money and success.', 1),
  ('aa200000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Budgeting Mastery', 'Build systems that automatically grow your wealth.', 2),
  ('aa300000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Investing Basics', 'Start investing even on a small budget.', 3),
  ('aa400000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Building Income Streams', 'Layer multiple income sources for financial security.', 4);

-- Lessons — Module 1
insert into public.lessons (id, module_id, course_id, title, duration_mins, position, is_free) values
  ('bb100000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Why Most People Stay Broke', 12, 1, true),
  ('bb100000-0000-0000-0000-000000000002', 'aa100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'The Scarcity vs Abundance Framework', 18, 2, false),
  ('bb100000-0000-0000-0000-000000000003', 'aa100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Daily Wealth Rituals', 15, 3, false);

-- Lessons — Module 2
insert into public.lessons (id, module_id, course_id, title, duration_mins, position, is_free) values
  ('bb200000-0000-0000-0000-000000000001', 'aa200000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'The Zero-Based Budget Blueprint', 22, 1, false),
  ('bb200000-0000-0000-0000-000000000002', 'aa200000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Automating Your Savings', 14, 2, false),
  ('bb200000-0000-0000-0000-000000000003', 'aa200000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Eliminating Lifestyle Creep', 11, 3, false);

-- Lessons — Module 3
insert into public.lessons (id, module_id, course_id, title, duration_mins, position, is_free) values
  ('bb300000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Index Funds Explained Simply', 20, 1, false),
  ('bb300000-0000-0000-0000-000000000002', 'aa300000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Dollar-Cost Averaging Strategy', 16, 2, false);

-- Lessons — Module 4
insert into public.lessons (id, module_id, course_id, title, duration_mins, position, is_free) values
  ('bb400000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'The Income Layer System', 25, 1, false),
  ('bb400000-0000-0000-0000-000000000002', 'aa400000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Digital Product Income Basics', 19, 2, false);


-- ============================================================
-- COURSE 2: Social Media Branding
-- ============================================================
insert into public.courses (id, slug, title, short_desc, long_desc, price, difficulty, duration_hrs, is_published, outcomes)
values (
  'c2000000-0000-0000-0000-000000000001',
  'social-media-branding',
  'Social Media Branding',
  'Turn your social presence into a recognized authority brand that attracts clients and income.',
  'In a world where attention is currency, your personal brand is your most valuable asset. This course teaches you how to define a magnetic brand identity, build a content system that runs on autopilot, grow a loyal audience across platforms, and convert that audience into real revenue. You will leave with a complete content calendar, a monetization plan, and the confidence to show up consistently online.',
  397.00,
  'Beginner',
  10.0,
  true,
  array[
    'Define a unique brand identity that stands out in any niche',
    'Build a content system that produces 30 days of content in 4 hours',
    'Grow an engaged audience from zero using proven organic strategies',
    'Monetize your audience with offers, sponsorships, and digital products'
  ]
);

insert into public.modules (id, course_id, title, description, position) values
  ('aa500000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Personal Brand Strategy', 'Define your niche, voice, and positioning.', 1),
  ('aa600000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Content Systems', 'Build a repeatable content machine.', 2),
  ('aa700000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Audience Growth', 'Grow fast and build real community.', 3),
  ('aa800000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Monetization', 'Turn followers into paying customers.', 4);

insert into public.lessons (id, module_id, course_id, title, duration_mins, position, is_free) values
  ('bb500000-0000-0000-0000-000000000001', 'aa500000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Finding Your Niche', 15, 1, true),
  ('bb500000-0000-0000-0000-000000000002', 'aa500000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Crafting Your Brand Voice', 18, 2, false),
  ('bb600000-0000-0000-0000-000000000001', 'aa600000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Content Pillars & Calendar', 22, 1, false),
  ('bb600000-0000-0000-0000-000000000002', 'aa600000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Batch Recording System', 17, 2, false),
  ('bb700000-0000-0000-0000-000000000001', 'aa700000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'The Algorithm Mastery Blueprint', 20, 1, false),
  ('bb800000-0000-0000-0000-000000000001', 'aa800000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Your First $1,000 from Social Media', 25, 1, false);


-- ============================================================
-- COURSE 3: AI Business Launchpad
-- ============================================================
insert into public.courses (id, slug, title, short_desc, long_desc, price, difficulty, duration_hrs, is_published, outcomes)
values (
  'c3000000-0000-0000-0000-000000000001',
  'ai-business-launchpad',
  'AI Business Launchpad',
  'Build and launch a profitable AI-powered business in 30 days.',
  'Artificial intelligence is the greatest business leverage tool in history — and most entrepreneurs are not using it yet. This course shows you exactly which AI tools to use, how to create an irresistible digital offer, how to automate your delivery and marketing, and how to make your first sales. No tech background needed. Just execution.',
  597.00,
  'Intermediate',
  14.0,
  true,
  array[
    'Master the AI tools that save 20+ hours per week in your business',
    'Create a profitable digital product or service offer in 48 hours',
    'Build automated funnels that sell while you sleep',
    'Generate your first revenue from an AI-powered business'
  ]
);

insert into public.modules (id, course_id, title, description, position) values
  ('aa900000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'AI Tools Mastery', 'The AI stack for modern entrepreneurs.', 1),
  ('aaa00000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Offer Creation', 'Design a premium digital offer people want to buy.', 2),
  ('aab00000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Business Automations', 'Automate marketing, delivery, and customer support.', 3),
  ('aac00000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Selling Digital Products', 'Launch and scale your digital product business.', 4);

insert into public.lessons (id, module_id, course_id, title, duration_mins, position, is_free) values
  ('bb900000-0000-0000-0000-000000000001', 'aa900000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'The AI Entrepreneur Stack', 20, 1, true),
  ('bb900000-0000-0000-0000-000000000002', 'aa900000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Prompt Engineering for Business', 25, 2, false),
  ('bba00000-0000-0000-0000-000000000001', 'aaa00000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'The Irresistible Offer Formula', 22, 1, false),
  ('bbb00000-0000-0000-0000-000000000001', 'aab00000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Building Your Automation Stack', 30, 1, false),
  ('bbc00000-0000-0000-0000-000000000001', 'aac00000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Your First Digital Product Launch', 28, 1, false);


-- ============================================================
-- COURSE 4: High-Ticket Sales Basics
-- ============================================================
insert into public.courses (id, slug, title, short_desc, long_desc, price, difficulty, duration_hrs, is_published, outcomes)
values (
  'c4000000-0000-0000-0000-000000000001',
  'high-ticket-sales-basics',
  'High-Ticket Sales Basics',
  'Learn to confidently close $2,000–$10,000 offers on the phone and online.',
  'Selling high-ticket offers is a skill that pays for life. This course walks you through the psychology of premium buyers, how to position any offer so it feels underpriced at $5,000, how to run a discovery call that converts, and how to close without feeling pushy or salesy. Whether you are a coach, consultant, freelancer, or agency owner, mastering high-ticket sales is the fastest path to six figures.',
  697.00,
  'Intermediate',
  11.0,
  true,
  array[
    'Understand the psychology of high-ticket buyers',
    'Position your offer to command premium prices',
    'Run a discovery call that closes 50%+ of prospects',
    'Handle objections without losing your confidence'
  ]
);

insert into public.modules (id, course_id, title, description, position) values
  ('aad00000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'Sales Psychology', 'Understand what drives high-ticket buyers.', 1),
  ('aae00000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'Offer Positioning', 'Make your offer feel like the obvious choice.', 2),
  ('aaf00000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'Discovery Calls', 'Run calls that convert and build trust.', 3),
  ('ab000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'Closing Systems', 'Close consistently with proven frameworks.', 4);

insert into public.lessons (id, module_id, course_id, title, duration_mins, position, is_free) values
  ('bbd00000-0000-0000-0000-000000000001', 'aad00000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'Why People Buy at Premium Prices', 18, 1, true),
  ('bbd00000-0000-0000-0000-000000000002', 'aad00000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'Pain vs. Desire Selling', 22, 2, false),
  ('bbe00000-0000-0000-0000-000000000001', 'aae00000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'The Value Stack Method', 20, 1, false),
  ('bbf00000-0000-0000-0000-000000000001', 'aaf00000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'The 5-Step Discovery Call Framework', 35, 1, false),
  ('bc000000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-000000000001', 'c4000000-0000-0000-0000-000000000001', 'Handling the Top 5 Objections', 28, 1, false);


-- ============================================================
-- COURSE 5: Entrepreneurship 101
-- ============================================================
insert into public.courses (id, slug, title, short_desc, long_desc, price, difficulty, duration_hrs, is_published, outcomes)
values (
  'c5000000-0000-0000-0000-000000000001',
  'entrepreneurship-101',
  'Entrepreneurship 101',
  'Go from idea to launched business with a validated model and paying customers.',
  'Every successful business starts with the same fundamentals — a validated model, a clear market, a lean MVP, and a launch plan. This course gives you the complete entrepreneurship roadmap: how to choose the right business model for your skills and goals, how to validate your idea before spending a dollar, how to build and ship your first version fast, and how to get your first ten paying customers. Beginner-friendly, execution-focused.',
  297.00,
  'Beginner',
  9.5,
  true,
  array[
    'Choose the right business model for your skills and lifestyle',
    'Validate any business idea in under 7 days without spending money',
    'Build and launch an MVP in 30 days',
    'Acquire your first 10 paying customers with zero ad spend'
  ]
);

insert into public.modules (id, course_id, title, description, position) values
  ('bc100000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'Business Models', 'Choose the right model for you.', 1),
  ('bc200000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'Market Research', 'Validate your idea the right way.', 2),
  ('bc300000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'MVP Creation', 'Ship a lean first version fast.', 3),
  ('bc400000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'Launch Plan', 'Go to market and get first customers.', 4);

insert into public.lessons (id, module_id, course_id, title, duration_mins, position, is_free) values
  ('bd100000-0000-0000-0000-000000000001', 'bc100000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', '8 Proven Business Models Explained', 20, 1, true),
  ('bd100000-0000-0000-0000-000000000002', 'bc100000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'Choosing Your Business Model', 15, 2, false),
  ('bd200000-0000-0000-0000-000000000001', 'bc200000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'The 7-Day Validation Sprint', 22, 1, false),
  ('bd300000-0000-0000-0000-000000000001', 'bc300000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'The Lean MVP Framework', 24, 1, false),
  ('bd400000-0000-0000-0000-000000000001', 'bc400000-0000-0000-0000-000000000001', 'c5000000-0000-0000-0000-000000000001', 'The Zero-Budget Launch Strategy', 30, 1, false);
