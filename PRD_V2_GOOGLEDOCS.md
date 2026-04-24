Product Requirements Document — CAAT V2

Product Name: College Admissions Assistance Tool — Version 2
Author: Violet Nwe, Jaden Khuu
Date: 24 April 2026
Version: 2.0

────────────────────────────────────────────────────────────

1. PURPOSE AND BACKGROUND

CAAT V1 established a solid foundation: a centralised web app where students can track college applications, research universities and majors, manage essays, build a resume, and bookmark scholarships.

V2 builds on that foundation by introducing intelligence, community, and monetisation. The three pillars of V2 are:

    AI Layer — a suite of AI-powered tools that analyse a student's profile and actively guide them toward better outcomes (essay feedback, resume review, smart recommendations, a conversational assistant)

    CAAT Communities — a student-first social feed inspired by LinkedIn, where applicants share wins, results, and strategies so the community learns together

    Subscription Tier (CAAT Pro) — a paid tier that gates the AI tools, enabling the product to be self-sustaining while keeping core features free

Everything built in V1 (dashboard, roadmap, schools, majors, essays, resume builder, scholarships, extracurriculars, auth) is carried forward unchanged unless explicitly noted below.

────────────────────────────────────────────────────────────

2. GOALS AND SUCCESS METRICS

Goals:

    - Give every student access to personalised AI guidance that was previously only available through expensive college counsellors
    - Build a peer community that creates network effects and keeps students engaged between application cycles
    - Introduce a sustainable revenue model through CAAT Pro subscriptions
    - Improve recommendation quality by feeding real profile data (test scores, extracurriculars, GPA, interests) into the AI engine

Success Metrics:

    Free-to-Pro conversion rate — Target: 8% or above within 90 days of launch
    AI recommendations accepted by user (bookmarked) — Target: 40% or above of recommendations shown
    Community posts created per active user per month — Target: 2 or more
    AI essay / resume review sessions per Pro user per month — Target: 3 or more
    Retention: users returning within 7 days — Target: 55% or above

────────────────────────────────────────────────────────────

3. TARGET USERS

Primary Users (unchanged from V1)

    - High school students aged 16–18 preparing for college applications
    - Home-schooled students transitioning to higher education

New Secondary Users (V2)

    - Students who have already been admitted and want to share their experience with the community
    - Students researching via community posts before starting their own applications

User Characteristics

    - Moderate-to-high technical literacy
    - Active on social platforms, comfortable with feed and post interactions
    - Motivated but anxious — AI tools must feel reassuring, not overwhelming
    - Budget-conscious — free tier must remain genuinely useful to earn trust before conversion

────────────────────────────────────────────────────────────

4. FEATURE OVERVIEW

V2 Net-New Features:

    1.  AI Essay Review                            Pro (subscription)
    2.  AI Resume Review                           Pro (subscription)
    3.  ChatCAAT (AI chatbot)                      Pro (subscription)
    4.  AI Analyser and Recommender                Pro (subscription)
    5.  CAAT Communities (social feed)             Free
    6.  University and Major Recommendations       Free (basic) / Pro (detailed AI)
    7.  Subscription Management (CAAT Pro)         —

────────────────────────────────────────────────────────────

5. DETAILED USER STORIES

5.1 AI Essay Review — CAAT Pro

The AI reads a student's essay draft and gives structured, actionable feedback — not just grammar, but narrative strength, authenticity, and fit with the target university's known preferences.

    - As a Pro student, I want to submit any saved essay for AI review so I can get feedback without waiting for a human counsellor
    - As a Pro student, I want the AI to score my essay on clarity, structure, and authenticity so I know where to focus revisions
    - As a Pro student, I want the AI to highlight specific sentences and explain why they are weak so I understand the feedback in context
    - As a Pro student, I want to resubmit a revised essay for a follow-up review so I can track improvement
    - As a Pro student, I want AI feedback to appear inline inside the essay editor so I don't have to switch contexts
    - As a Pro student, I want to accept or dismiss individual suggestions so I stay in control of my voice
    - As a free student, I want to see that AI essay review exists and understand what it offers so I can decide whether to upgrade

5.2 AI Resume Review — CAAT Pro

The AI analyses the student's built resume and provides specific, prioritised recommendations to make it stronger for college admissions.

    - As a Pro student, I want to trigger an AI review of my current resume so I can improve it before sending applications
    - As a Pro student, I want the AI to flag missing or weak sections so I know what to add
    - As a Pro student, I want the AI to suggest stronger action verbs and phrasing for bullet points so my descriptions are more impactful
    - As a Pro student, I want to see a readability and impact score for my resume so I have a single benchmark to work toward
    - As a Pro student, I want resume feedback to be displayed alongside the resume preview so I can act on suggestions immediately
    - As a free student, I want to see a locked AI review prompt in the resume builder that explains what Pro unlocks

5.3 ChatCAAT — AI Chatbot — CAAT Pro

A conversational AI assistant that knows the student's profile, bookmarks, essays, and application status, and can answer questions, explain concepts, and help strategise.

    - As a Pro student, I want to open a chat panel from anywhere in the app so I can ask questions without leaving my current page
    - As a Pro student, I want to ask ChatCAAT questions about my bookmarked schools and get a contextual answer based on my own data
    - As a Pro student, I want ChatCAAT to suggest next steps when I describe where I'm stuck so I don't lose momentum
    - As a Pro student, I want ChatCAAT to explain college admissions concepts in plain language
    - As a Pro student, I want my chat history to persist between sessions so I can refer back to previous advice
    - As a Pro student, I want ChatCAAT to proactively surface reminders about upcoming deadlines I've added to my roadmap
    - As a free student, I want to see a locked ChatCAAT panel with one example exchange so I understand what I'm missing

5.4 AI Analyser and Recommender — CAAT Pro

The core intelligence engine. It ingests the student's full profile — GPA, test scores, extracurriculars, interests, and bookmarks — and outputs a personalised ranked list of recommended universities and majors with explanations.

    - As a Pro student, I want to run an AI analysis of my full profile so I receive tailored university and major recommendations
    - As a Pro student, I want to input my test scores (SAT / ACT / IB / A-Level) as part of the analysis so recommendations are calibrated to my academic profile
    - As a Pro student, I want the AI to rank recommended universities by fit score and explain why each was recommended
    - As a Pro student, I want the AI to recommend majors that align with my stated interests and extracurricular activities
    - As a Pro student, I want to refresh my recommendations whenever I update my profile so the output stays current
    - As a Pro student, I want to bookmark AI-recommended universities and majors directly from the results page
    - As a Pro student, I want the AI to indicate reach, match, and safety tier for each recommended university so I build a balanced list
    - As a free student, I want to see a teaser of AI recommendations so I understand the feature's value before upgrading

5.5 University and Major Recommendations — Free Tier

A lighter version of recommendations available to all users, driven by their bookmarked majors, countries, and extracurriculars rather than AI scoring.

    - As a free student, I want to see a "Recommended for You" section on the schools page that surfaces universities matching my bookmarked majors and countries
    - As a free student, I want to see recommended majors on the majors page that relate to my existing bookmarks
    - As a free student, I want to understand why a university or major was recommended so the suggestion feels relevant
    - As a student, I want to dismiss recommendations I'm not interested in so the list stays relevant

5.6 CAAT Communities — Free

A student-first social feed where applicants and admitted students share results, strategies, and encouragement. Think LinkedIn but scoped entirely to the college admissions experience.

Feed

    - As a student, I want to see a scrollable feed of posts from other CAAT users so I can learn from peers
    - As a student, I want to filter the feed by topic (Application Results, Essays, Test Scores, Extracurriculars, Advice, Scholarships)
    - As a student, I want to see the most liked and most recent posts so I can find both timely and valuable content
    - As a student, I want the feed to load quickly and paginate smoothly

Creating Posts

    - As a student, I want to create a text post to share advice, ask questions, or celebrate a result
    - As a student, I want to attach my resume (as a PDF or CAAT resume link) to a post
    - As a student, I want to tag my post with a topic so it reaches the right audience
    - As a student, I want to specify which university or major my post is about so it's discoverable
    - As a student, I want to share my application outcomes (Accepted / Waitlisted / Rejected) in a structured result card format
    - As a student, I want to share my test scores (SAT / ACT / IB) in a structured card so others know the academic context
    - As a student, I want to edit or delete my posts after publishing

Engagement

    - As a student, I want to like a post so I can signal its value to others
    - As a student, I want to comment on a post to ask follow-up questions or add context
    - As a student, I want to reply to a specific comment in a thread so conversations stay organised
    - As a student, I want to share a post by copying a link so I can send it to a friend
    - As a student, I want to save / bookmark posts I find helpful so I can return to them later

Community Profiles

    - As a student, I want my community profile to show my graduation year, intended intake, and optionally my bookmarked countries and majors
    - As a student, I want to choose what information from my CAAT profile is visible on my community profile
    - As a student, I want to follow other users so their posts appear at the top of my feed
    - As a student, I want to report posts that violate community guidelines

Moderation

    - As a student, I want posts to be screened against community guidelines so the feed stays safe and constructive
    - Posts flagged by multiple users should be hidden pending review

5.7 CAAT Pro — Subscription Management

    - As a student, I want to see a clear comparison of Free vs Pro features on an upgrade page
    - As a student, I want to subscribe to CAAT Pro using a card or digital wallet
    - As a Pro student, I want to manage my subscription (view billing date, cancel, update payment method) from account settings
    - As a Pro student, I want to receive a receipt after each billing cycle
    - As a student who cancels Pro, I want to retain access until the end of my paid period
    - As a student, I want to see a clear indication of which features require Pro so I'm never surprised by a paywall mid-task

────────────────────────────────────────────────────────────

6. FUNCTIONAL REQUIREMENTS

6.1 AI Essay Review

    - Accepts essay text (minimum 150 words) and triggers an AI evaluation pass
    - Returns feedback in three categories: Structure and Flow, Clarity and Language, Authenticity and Voice
    - Each category produces 2–5 inline annotations with a short explanation
    - Displays an overall score out of 10 per category
    - Re-review is available after edits; prior feedback versions are retained for comparison
    - Feedback is persisted to the user's essay record in the database

6.2 AI Resume Review

    - Analyses all resume sections present in the user's CAAT resume builder
    - Returns a global impact score and per-section scores
    - Produces a prioritised improvement list ranked by estimated impact
    - Flags missing sections that are standard for college applications
    - Feedback is persisted and timestamped; the student can re-trigger after edits

6.3 ChatCAAT

    - Accessible via a floating chat button available on all authenticated pages
    - Has read access to the user's profile, bookmarked schools, majors, scholarships, essay drafts, and roadmap status
    - Maintains conversation history per user, persisted in the database
    - Responds within 5 seconds under normal load
    - Includes a "clear conversation" option that resets context without deleting history

6.4 AI Analyser and Recommender

    - Ingests: GPA (optional), test scores (optional), bookmarked majors, bookmarked countries, extracurricular categories and descriptions, stated interests from profile
    - Produces: a ranked list of up to 20 recommended universities, each with a fit score, tier classification (reach / match / safety), and a 2–3 sentence explanation
    - Produces: a ranked list of up to 10 recommended majors with a relevance explanation
    - Results are refreshable; the most recent result set is persisted per user
    - Bookmarking from results directly adds to the existing bookmarks system

6.5 Interest-Based Recommendations (Free)

    - Runs server-side on data from the user's existing bookmarks — no AI call required
    - Refreshes automatically whenever bookmarks change
    - Shows a maximum of 6 recommended schools and 4 recommended majors on their respective pages

6.6 CAAT Communities

    - Posts support: plain text (max 2000 characters), topic tag (required), optional university or major tag, optional result card, optional test score card, optional attached CAAT resume link
    - Feed supports: chronological and top-liked sort, topic filter, search by keyword or university name
    - Engagement: likes (toggle), comments (threaded one level deep), link-share (generates a public permalink)
    - Saved posts list accessible from the user's community profile
    - Notifications: users are notified when someone likes or comments on their post, or replies to their comment
    - Pagination: feed loads 20 posts at a time with infinite scroll
    - Following: users can follow or unfollow; a "Following" feed tab shows only posts from followed users

6.7 Subscription (CAAT Pro)

    - Payment processed via Stripe
    - Two billing cycles offered: monthly and annual (annual at a discount)
    - Pro status stored in the user's profile record, verified server-side on every AI endpoint call
    - Graceful paywall UI: free users see locked feature previews, not blank states
    - Cancellation sets a pro_expires_at timestamp; access continues until that date

────────────────────────────────────────────────────────────

7. NON-FUNCTIONAL REQUIREMENTS

Performance

    - Dashboard and feed load within 2 seconds on standard broadband
    - AI review responses return within 10 seconds (user sees a loading state with progress indicator)
    - ChatCAAT first token streams within 3 seconds
    - Feed filtering and search respond within 500ms
    - AI recommender results return within 15 seconds; a progress bar communicates this to the user

Usability

    - AI features must explain what they are doing and why — no black-box outputs
    - Communities feed must feel lightweight and fast, not cluttered
    - Paywall prompts must be informative and non-intrusive; never block navigation
    - All AI outputs must include a disclaimer that they are suggestions, not guarantees

Reliability and Persistence

    - All AI feedback, chat history, and recommendation results are persisted in the database
    - Community posts, likes, comments, and saves persist across sessions and devices
    - Auto-save applies to all essay and resume edits as in V1

Security and Privacy

    - Community profiles are visible only to authenticated CAAT users, not the public internet
    - Users control which profile fields appear on their community profile
    - AI endpoint calls are authenticated server-side; Pro status is re-validated on each call
    - Payment data is never stored by CAAT; Stripe handles all card data
    - Reported posts are not surfaced to other users while under review

Scalability

    - AI calls are queued and rate-limited per user to prevent abuse and control LLM costs
    - Communities feed is paginated and indexed for performant filtering at scale
    - Subscription status is cached with a short TTL to reduce database reads on every page load

Moderation

    - Community posts are filtered for profanity on submission
    - Flagging system: 3 unique flags on a post triggers automatic hiding pending manual review
    - Users who have posts removed receive a notification explaining why

────────────────────────────────────────────────────────────

8. OUT OF SCOPE (V2)

    - Direct application submission to universities
    - Peer-to-peer messaging (DMs between users)
    - Video or image attachments in community posts
    - Employer or recruiter-facing features
    - Mobile native apps (iOS / Android) — web responsive only
    - AI-generated essay drafts (review only, not generation)
    - University partnerships or sponsored content
    - Referral or affiliate programmes

────────────────────────────────────────────────────────────

9. TECHNICAL CONSIDERATIONS

Frontend

    - Next.js (App Router) and TypeScript — same stack as V2 baseline
    - Streaming UI for ChatCAAT responses (Server-Sent Events or WebSocket)
    - Optimistic UI updates for community likes and comments
    - Infinite scroll with React Query or SWR for the communities feed

Backend and API

    - Existing Supabase (PostgreSQL) database extended with new tables
    - AI features powered by the Anthropic Claude API
    - Stripe for subscription billing and webhook handling
    - Row Level Security (RLS) policies extended to cover all new tables

New Database Tables (indicative)

    community_posts       — Post content, author, tags, timestamps
    community_comments    — Threaded comments on posts
    community_likes       — Post like records (user × post)
    community_saves       — Saved post records (user × post)
    community_follows     — Follow relationships (follower × followee)
    community_reports     — Flagged post records
    ai_essay_feedback     — Stored essay review results per essay version
    ai_resume_feedback    — Stored resume review results per review run
    ai_recommendations    — Stored recommender output per user
    chat_messages         — ChatCAAT conversation history per user
    notifications         — In-app notification records
    subscriptions         — Pro status, Stripe customer ID, billing dates

Authentication

    - Supabase Auth unchanged from V1
    - Subscription status check added to middleware for Pro-gated routes

Hosting

    - Vercel (frontend) and Supabase (database and auth) — unchanged
    - Stripe webhooks handled via a Vercel API route

────────────────────────────────────────────────────────────

10. SUBSCRIPTION TIER COMPARISON

                                            Free        CAAT Pro
    ─────────────────────────────────────────────────────────────
    Dashboard, profile, roadmap              ✓             ✓
    Schools, majors, scholarships research   ✓             ✓
    Essay editor (write and save)            ✓             ✓
    Resume builder (create and download)     ✓             ✓
    Bookmarks                                ✓             ✓
    Interest-based recommendations           ✓             ✓
    CAAT Communities (read, post, engage)    ✓             ✓
    AI Essay Review                          —             ✓
    AI Resume Review                         —             ✓
    ChatCAAT                                 —             ✓
    AI Analyser and Recommender              —             ✓

────────────────────────────────────────────────────────────

11. ASSUMPTIONS AND CONSTRAINTS

Assumptions

    - Claude API access is available and costs are manageable at expected usage volumes
    - Stripe integration is feasible within the development timeline
    - Community moderation in V2 is primarily automated; a manual moderation queue is out of scope but the data model supports it
    - Users are willing to enter test scores and GPA to get better AI recommendations; these fields are optional but improve output quality
    - Community content is student-generated; CAAT does not editorially curate or verify claims in posts

Constraints

    - Small development team — AI features must leverage existing APIs rather than training custom models
    - Limited moderation capacity — automated content filtering must handle the majority of cases
    - LLM API cost must be controlled via per-user rate limits and caching of recent results
    - Stripe requires business registration before going live with real payments — test mode should be used during development
