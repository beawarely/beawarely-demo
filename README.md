# BeAwarely Demo

BeAwarely is an experimental social + AI platform built around three pillars:

- **People** – profiles, posts, friendships, activity.
- **AI** – multi-model chat, RAG knowledge tree, local helpers.
- **Reality checks** – WorkVerify, Faith & Reason, and public moderation.

This repository contains the **static frontend** (HTML + vanilla JS + CSS) plus code for the **local AI/RAG backend** and **internet proxy**.

---

## High-level architecture

- **Frontend (this repo)**  
  - Static HTML pages served by any HTTP server (GitHub Pages, Nginx, etc.).
  - Browser-side Supabase client (UMD) for auth + Postgres.
  - Vanilla JS modules per page (feed, chat, profiles, tools, etc.).

- **Supabase backend**
  - Auth (email/password + OAuth).
  - Tables (examples): `profiles`, `user_posts`, `tool_ideas`, `work_experiences`,
    `activity_events`, `moderators`, `friendships`, `faith_items`, `faith_votes`,
    `faith_edits`, `faith_flags`.
  - RLS is expected to protect user data and moderator-only features.

- **AI backend (self-hosted)**
  - `server.js` – Node/Express proxy on `:3001`:
    - `/search` – Wikipedia + Open-Meteo + optional Google CSE with cache + rate-limit.
    - `/api/rag/*` – transparent proxy to local RAG service.
  - `api/rag_api.js` – Node/Express RAG service on `:3010`:
    - SQLite `rag.db` for knowledge entries.
    - Ollama for embeddings (`nomic-embed-text`) and LLM tools (`llama3.x`, etc.).
    - Semantic search + dedup + LLM-based merge + optional enrichment from `/search`.

The frontend talks to:

- Supabase over HTTPS,
- AI backend via `https://ai.beawarely.com/api/generate` and `https://ai.beawarely.com/api/rag`.

---

## Main features

- **Landing page + social feed** with Supabase auth.
- **AI chat** with multi-model switch, RAG enrichment and streaming.
- **Moderator panel** for tool ideas and RAG memory.
- **Profiles, friends, activity stream**.
- **WorkVerify** – anonymous work experiences + local AI precheck.
- **Faith & Reason** – religion-related cases with AI precheck and voting.
- **Suggest a Tool** – ideas board with filters, local votes/follows.
- **Knowledge Tree** – D3 tree hooked to RAG categories/docs.

---

## Frontend pages

### `index.html` – Landing page & app shell

Main public entry point. Provides:

- **Global layout**
  - Full-screen dark/light theme, animated rotating galaxy background.
  - Fixed topbar:
    - sidebar burger,
    - theme switch (`#modeIcon`, persisted in `localStorage`),
    - login/logout and compact profile chip.
  - Loader overlay that fades out after `DOMContentLoaded`.
  - Footer with links + demo disclaimer.

- **Auth (Supabase)**
  - Email/password login + signup with confirmation.
  - Google OAuth login.
  - „Forgot password” + „Set new password” flows (recovery link handling).
  - On login:
    - topbar switches to logged state,
    - ensures `profiles` row exists (auto username from email),
    - loads avatar from Supabase Storage (fallback to `images/avatar-default.png`).
  - On logout:
    - `supabase.auth.signOut()`,
    - UI reset from topbar or sidebar.

- **Social feed**
  - Tabs: **Public** / **Friends**.
  - Post composer and posts list.
  - Login overlay that blocks posting for guests.
  - Separate **global activity feed** (`activity_events`), loaded on `DOMContentLoaded`.

- **Sidebar + access control**
  - Slide-in sidebar with links to:
    - `chat.html`, `workverify.html`, `tree.html`,
      `faith-reason.html`, `suggest.html`.
  - Simple protection:
    - checks `supabase.auth.getUser()` on load,
    - for protected pages, anonymous users get a warning and navigation is blocked.

- **Moderator “black hole”**
  - Hidden wormhole button that appears only for users present in `moderators` table.
  - Redirects to `moderator.html`.

- **Support modal**
  - „Support BeAwarely” with:
    - GitHub Sponsors, Ko-fi, PayPal links,
    - „Donate crypto” (copies configured address to clipboard).

- **UX helpers**
  - Scroll-reveal animations.
  - Global error / unhandled rejection logging to console.
  - Multiple `DOMContentLoaded` blocks wiring theme, loader, auth, sidebar, support modal.

---

### `js/supabase-client.js` – Supabase bootstrap

- Holds **`SUPABASE_URL`** and **`SUPABASE_ANON_KEY`**.
- Exposes them on `window.SUPABASE_URL` / `window.SUPABASE_ANON_KEY`.
- If Supabase UMD SDK is not loaded → logs an error and stops.
- If SDK is present:
  - creates a **Supabase client**,
  - overwrites `window.supabase` with that client,
  - also exposes `window.supabaseClient`,
  - logs init success or error.

All other scripts use this shared client.

---

### `js/feed.js` – Main social feed

- On `DOMContentLoaded`:
  - Grabs feed elements (overlay, postbox, posts list, tabs, buttons).
  - Calls `supabase.auth.getUser()`:
    - if no user → shows overlay, hides postbox.
    - if logged in → hides overlay, shows postbox, calls `loadPosts()`.

- **Tabs: Public / Friends**
  - `currentTab` in JS (`"public"` / `"friends"`).
  - Tab click toggles `.active` and reloads posts.

- **Posting**
  - „Post” button:
    - validates non-empty text,
    - inserts into `user_posts`:
      - `author_id`, `content`, `visibility` (`public`/`friends`),
    - on success clears textarea and reloads feed.

- **Realtime changes**
  - Supabase realtime channel `feed_updates`:
    - listens on `user_posts`, `tool_ideas`, `work_experiences`,
    - any insert/update/delete triggers `loadPosts()`.

- **`loadPosts()` aggregation**
  - Builds a unified `posts` array from:
    - `user_posts` (respecting `visibility` + login state),
    - `tool_ideas` (only `approved` or own),
    - `work_experiences` (only `approved` or own).
  - Sorts by `created_at` descending.
  - If empty → „No posts yet.”.

- **Author profiles**
  - Collects unique `author_id`s and fetches from `profiles`
    (`id, username, first_name, last_name, avatar_url`).
  - For each post:
    - picks display name (username or first+last),
    - resolves avatar:
      - Supabase Storage public URL or `images/avatar-default.png`,
    - links to `user.html?id=<author_id>`,
    - formats `created_at` via `toLocaleString()`,
    - renders card with header + content.

- **`escapeHtml`**
  - Protects against XSS by escaping `&<>"'` in dynamic strings.

---

### `chat.html` – AI chat interface

- **Layout**
  - Left: conversations sidebar (`chat_conversations`).
  - Right: main chat:
    - user/AI message bubbles,
    - autogrow textarea,
    - Send/Stop button,
    - backend status bar.
  - Model selector (`MattFast` / `MattThinker`), chosen model ID stored in `localStorage.ba_model_id`.

- **Auth**
  - On start:
    - `supabaseClient.auth.getSession()`.
    - if no session:
      - sets `localStorage.ba_redirect = 'chat.html'`,
      - redirects to `index.html?login=1`.
  - On `SIGNED_OUT`:
    - clears `ba_current_conv`, `ba_chat_history`, `ba_last_user`,
    - redirects to `index.html`.

- **Conversation storage (Supabase)**
  - Tables:
    - `chat_conversations` – headers,
    - `chat_messages` – messages.
  - Current conversation ID in `sessionStorage.ba_current_conv`.
  - `renderServerHistory()`:
    - loads up to 100 conversations for user, sorted by `updated_at DESC`,
    - renders in sidebar.
  - `selectConversation(id)`:
    - sets current ID,
    - loads messages and replays bubbles.
  - Deleting conversation:
    - DELETE from `chat_conversations` with `user_id` guard.

- **Creating / saving messages**
  - `+ New` resets UI and clears current ID (no DB row until first message).
  - `addMsg(text, who, store)`:
    - draws bubble and scrolls,
    - when `store === true`:
      - ensures `USER_ID` + current conversation,
      - creates conversation if missing,
      - inserts into `chat_messages`,
      - sets conversation title from first user message,
      - updates `updated_at`,
      - refreshes sidebar.

- **Sending + streaming**
  - Enter = send, Shift+Enter = newline.
  - `Send`:
    - sanitizes prompt (`sanitizePrompt`),
    - adds user bubble with `store=true`,
    - clears textarea, sets busy UI.
    - optional RAG context:
      - GET `https://ai.beawarely.com/api/rag/search?q=…`,
      - appends `ragData.context` if available.
    - builds short text history from last bubbles as conversational context.
    - POST to `https://ai.beawarely.com/api/generate`:
      - `model` from `localStorage`,
      - prompt template depends on model,
      - per-model `options` (temperature/top_p/num_predict/repeat_penalty),
      - `stream: true`.
    - uses `AbortController` so button can switch to `Stop`.
  - `Stop` aborts stream.

  - Streaming reader:
    - consumes JSON lines with partial `response`,
    - accumulates `fullText`,
    - updates temporary AI bubble in real time,
    - on end:
      - removes temp bubble,
      - stores `fullText` via `addMsg(fullText, "ai", true)`.

- **Errors + status**
  - `AbortError` → `[stopped]` bubble, „Generation stopped”.
  - Other errors → „⚠️ Backend error, try again later.”, `Backend: error`.
  - Network status via `window.online/offline`:
    - updates `#backendStatus` with icons/text (`🟢 Connected`, `🛑 Offline` etc.).

- **Extra UX**
  - Autogrow textarea (capped at ~6 lines).
  - Simple watcher auto-scrolls to the bottom when bubble count changes.
  - Closes potential `loginModal` inherited from `index.html`.
  - Small script sets friendly model nickname in `#modelChip` from `localStorage.ba_model_name`.

---

### `moderator.html` – Moderator panel

Only for users present in `moderators` table.

- **Auth**
  - Creates a Supabase client locally.
  - `checkModerator()`:
    - if no user → redirect to `index.html`,
    - if user not in `moderators` → redirect to `index.html`.

- **Tab 1 – BeAwarely Management (Tool Ideas)**
  - Lists `tool_ideas` with `status="pending"`.
  - Columns: title, details, tags, author, created_at, source, actions.
  - `loadPendingIdeas()`:
    - fetches pending ideas, renders rows with:
      - **Approve** → `status="approved"`,
      - **Reject** → `status="rejected"`,
    - auto-refresh after action.

- **Tab 2 – RAG Memory**
  - Works against `https://ai.beawarely.com/api/rag`.
  - Toolbar:
    - `Refresh`, `Reindex All`, `+ Add Category`, `+ Add Document`, status text.
  - **Categories**
    - `loadCategories()` → `GET /categories`.
    - Renders cards with name, description, optional docs count.
    - Actions per category:
      - **View** → loads docs for that category.
      - **Edit** → `PUT /categories/:id` or fallback `PUT /categories`.
      - **Delete** → `DELETE /categories/:id` or fallback `DELETE /categories`.
  - **Documents**
    - `loadDocsForCategory(cat)`:
      - tries `GET /categories/:name/docs`, fallback to `GET /search?q=category:<name>`.
      - shows table: Title, URL, Updated, Actions.
    - Actions:
      - **View** – `GET /docs/:id` readonly.
      - **Edit** – `GET` + `PUT /docs/:id`.
      - **Delete** – `DELETE /delete/:id`, then refresh.
    - Basic search box prepared for future extension.

- **Shared modal system**
  - Single modal backdrop/box used for:
    - add/edit category,
    - add/edit/view document.
  - Mode decides whether it’s read-only or has a Save handler.

On init, after passing moderator check, the page loads pending ideas and RAG categories.

---

### `profile.html` – My profile

- **Auth**
  - Requires active Supabase session.
  - If no user → sets `ba_redirect = 'profile.html'` and redirects to `index.html?login=1`.

- **Profile data**
  - Reads record from `profiles`:
    - avatar (Supabase Storage or `images/avatar-default.png`),
    - first/last name (fallback „BeAwarely User”),
    - `@username`,
    - badge list (`badges` rendered as pills).
  - If some baseline fields in `user_metadata` are missing (`role`, `points`, `trust_score`, `badges`), fills them once via `auth.updateUser(...)`.

- **Actions**
  - `Edit Profile` → `profile-edit.html`.
  - `Report Issue` → placeholder alert.
  - `Log Out` → `supabaseClient.auth.signOut()` then redirect to homepage.

- **Share something**
  - Textarea + visibility select (`public`/`friends`/`private`) + `Post`.
  - `createPost()` inserts into `user_posts`.
  - After success:
    - clears textarea,
    - shows confirmation,
    - reloads own posts.

- **Activity**
  - `loadMyPosts()`:
    - loads posts where `author_id = user.id`.
  - `loadMyActivity()`:
    - loads `activity_events` where `actor_id = user.id`, limit 30.
  - Both share the same feed container.

- **Friends**
  - `loadFriends()`:
    - queries `friendships` where `status="accepted"` and user is requester or addressee,
    - resolves the other side’s profile data,
    - renders rows with „Unfriend” action.
  - `loadFriendRequests()`:
    - records where `addressee_id = uid` and `status="pending"`,
    - renders requests with `Accept` / `Reject`.
  - Counters show total friends and pending requests.

---

### `profile-edit.html` – Edit profile

- **Auth**
  - Requires session (`auth.getSession()`), otherwise redirect to login.
  - Double-checks session and logs out on errors.

- **Form**
  - First name, Last name, Username, Email (disabled), optional New password,
    profile photo file input and optional social links.

- **Save flow**
  - On submit:
    - validates username (`^[a-zA-Z0-9_]+$`),
    - builds `updates` for `profiles` and compares with current values:
      - if no change → „no changes” alert, aborts.
    - if changed:
      - `update` in `profiles`,
      - collects summary messages.

- **Password change (optional)**
  - If `New password` is set:
    - calls `auth.updateUser({ password })`,
    - appends success/error to summary.

- **Avatar upload (optional)**
  - Validates file type (image) and size (≤ 2 MB).
  - Uploads to bucket `avatars` under `user.id/avatar.ext` (upsert).
  - Obtains public URL and saves to `profiles.avatar_url`.
  - Adds messages to summary depending on success/failure.

- **Finalization**
  - Shows combined summary (profile/password/avatar).
  - Restores button state.
  - Short timeout → redirect back to `profile.html`.

---

### `user.html` – Public view of another user

- **Target user**
  - `viewedId` from `?id=…`.
  - If no id → stops.
  - If id equals current user → redirect to `profile.html`.

- **Profile display**
  - Loads `profiles` row for `viewedId`.
  - If not found → „User not found”.
  - Otherwise:
    - shows full name, `@username`,
    - resolves avatar (Supabase Storage or default PNG).

- **Friendship state**
  - Queries `friendships` for any relation between current user and `viewedId`.
  - Single button with dynamic label:
    - no relation → „Add friend” (creates `pending` request),
    - pending and current user is addressee → „Accept request” (sets `accepted`),
    - pending and current user is requester → „Request sent” (disabled),
    - accepted → „Friends” (disabled).

- **User posts**
  - Loads `user_posts` where `author_id = viewedId`.
  - Visibility rules:
    - `public` – always visible,
    - `friends` – only visible if `status="accepted"`,
    - (self-view fallback could see all).
  - If none visible → „No posts”.

---

### `tree.html` – Knowledge Tree (RAG viewer)

- **Auth**
  - Requires Supabase session; otherwise sets `ba_redirect` and redirects to login.

- **Purpose**
  - Visual map of RAG categories and documents, built with D3.
  - Clicking a leaf opens full RAG entry in a detail panel.

- **Layout**
  - Dark/light mode via class on `<body>` and `#modeIcon`.
  - `#d3tree` (SVG) with controls:
    - `+`, `-`, `Reset`, `Add Branch`.
  - `#ragDetails` shows selected document title, meta, content.
  - „Back to Homepage” button.

- **RAG data**
  - `RAG_BASE = https://ai.beawarely.com/api/rag`.
  - `loadRagTree()`:
    - `GET /categories` → list of category names.
    - For each category:
      - `GET /categories/:cat/docs`.
      - Builds:
        - Category node (`name: cat`),
        - Child nodes for docs with:
          - short label (first ~30 chars of content),
          - `docId` = entry id.

- **D3 rendering**
  - Vertical tree (`d3.tree().nodeSize([260, 90])`).
  - Root node with logo image and „Knowledge Tree” label.
  - Categories and leaves as rounded pills, color-coded by category.
  - Custom positioning (`getNodePosition`) to keep leaves from overlapping.
  - Paths drawn as smooth curves with glowing filter.
  - Animated „pulses” moving along links to simulate data flow.

- **Interaction**
  - Clicking a leaf:
    - `GET /docs/:id`,
    - fills `#ragDetails` (title, category/source, full content) and shows panel.
  - Zoom controls (`zoomIn`, `zoomOut`, `Reset`) tied to D3 zoom behavior.
  - `Add Branch` adds a local branch for experimentation (no write to RAG).

- **Backgrounds**
  - Dark mode:
    - `#matrix-bg` – Matrix-style raining code.
  - Light mode:
    - `#neuronCanvas` – particle / neuron network animation.
  - `toggleBackgrounds()` and `MutationObserver` keep canvases + tree colors in sync with theme.

---

### `suggest.html` – Suggest a Tool

- **Purpose**
  - Logged-in users can submit new tool ideas, see approved ideas, filter/search,
    and locally „vote” / „follow” them via `localStorage`.

- **Theme**
  - Standalone layout:
    - back link to `index.html`,
    - hero header,
    - small stats cards (Ideas / Votes / Followers),
    - tool idea form + idea list.
  - Custom CSS tokens for dark/light themes, toggled by 🌙/🌞 button (`#themeToggle`) and persisted in `localStorage('ba_theme')`.

- **Access control**
  - If Supabase not available:
    - page falls back to demo mode,
    - shows guest card and „backend not connected yet”.
  - If Supabase is available:
    - `auth.getSession()`:
      - guest → sets `ba_redirect = 'suggest.html'` and redirects to `index.html?login=1`,
      - logged in → hides guest card, shows form and loads approved ideas.

- **Idea form**
  - Fields:
    - title (required, max 80),
    - tags (comma/space separated),
    - details (required, max 500).
  - On submit:
    - validates,
    - inserts into `tool_ideas` with `status='pending'`,
    - tries to log an `activity_events` entry,
    - clears form, shows „Idea submitted!”,
    - reloads list (note: visible list shows only `approved`).

- **Idea list + filters**
  - Loads `tool_ideas` with `status='approved'`, sorted by `created_at DESC`.
  - Frontend filters:
    - search box over title/details/tags,
    - sort tabs:
      - Top (by `votes` field),
      - New (by `created_at`),
      - Trending (simple `votes/time` heuristic).
  - State is mirrored in the URL (`?q=…&sort=…`).
  - Deep-link support:
    - `?id=<ideaId>` highlights and scrolls to a specific idea.

- **Per-idea UI**
  - Each idea shows title, optional details, tags, and actions:
    - `Vote`:
      - local pseudo-vote via `localStorage.ba_votes`,
      - updates visible counter but not DB.
    - `Follow`:
      - local follow via `localStorage.ba_follows`,
      - toggles `Following` label.
    - `Share`:
      - copies URL with `?id=<ideaId>` to clipboard, temporary „Copied!” text.
  - If not logged in, action buttons are disabled.

---

### `workverify.html` – WorkVerify module

- **Purpose**
  - Users submit neutral, fact-based descriptions of work experience.
  - Stored in `work_experiences` (with moderation via `status`).
  - Activity mirrored in `activity_events`.

- **Access**
  - Requires login; guests are redirected to `index.html`.

- **Theme**
  - Own header („WorkVerify”), links to `satire.html` and profile.
  - Dark/light theme via shared `mode` value in `localStorage`.

- **AI Assist (local, no network)**
  - Textarea `#aiInput` and buttons:
    - „Use my draft” – builds a composite prompt with company, role, current draft, ready for an external AI.
    - „Review draft” – `reviewDraftLocally()`:
      - checks length,
      - scans for possible personal/contact data,
      - detects insults and sensitive patterns,
      - writes notes into `#aiNotes` and suggests how to neutralise wording.
    - „Add note” / „Clear notes” – manage user notes.
  - Notes are stored per user in `localStorage` (`wv_notes_<userId>`).

- **Experience form**
  - Fields: company, from/to, role, factual experience (≤ 8000 chars).
  - Validation:
    - live character counter,
    - enforces minimal length.
  - On publish:
    - auto-saves a draft to `localStorage`,
    - checks session,
    - optionally re-runs local review,
    - inserts into `work_experiences`:
      - `author`, `company`, `role`, `content`, status via DB default,
    - logs `activity_events` entry,
    - clears form, shows „pending moderation” message, reloads recent experiences.

- **Drafts**
  - Draft objects stored as `wv_draft_<userId>_<timestamp>` in `localStorage`.
  - Right-hand panel lists most recent drafts with:
    - Load,
    - Delete.
  - Autosave debounced while typing.

- **Recent experiences**
  - `loadRecent()`:
    - selects `work_experiences` where:
      - `status='approved'` OR `author = current user`,
    - shows cards with company, role, date, short content,
    - badge for non-approved entries („Awaiting approval”),
    - link to `satire.html?exp=<id>` for future satirical re-writes.

---

### `faith-reason.html` – Faith & Reason module

- **Purpose**
  - Logged-in users submit religion-related cases (absurdities, manipulations, positives, history, unverified claims).
  - Entries go through AI precheck; community can vote on truthfulness and propose edits/flags.

- **Access + theme**
  - Requires Supabase session; otherwise redirect to login.
  - Dark/light theme via `ba_theme` in `localStorage`.
  - Sticky topbar with back button and `#userBadge`.

- **New entry form**
  - Fields:
    - Religion/tradition (with chips),
    - Category: `absurdity`, `manipulation`, `positive`, `history`, `claim`,
    - Title,
    - Summary/description,
    - Evidence links (one per line).
  - `submitNewItem()`:
    - validates that fields are non-empty,
    - builds `evidence_links` array,
    - inserts into `faith_items` with `status='pending_ai'`,
    - logs `activity_events` entry,
    - optionally calls RPC `ai_queue_verify_faith_item(...)` if available,
    - clears form and refreshes list.

- **Filters + fetching**
  - Filter by religion, category, status.
  - `fetchItems()` loads up to 100 `faith_items` sorted by `created_at DESC`, then applies filters.

- **Item cards**
  - Show:
    - badges for religion, category, status, AI score,
    - title, summary,
    - evidence links rendered as safe `<a>` tags.
  - Voting:
    - buttons: `True`, `Likely`, `Uncertain`, `Misleading`, `False`.
    - `castVote(itemId, verdict)`:
      - upsert into `faith_votes` for `(item_id, voter)`,
      - then refreshes list.
    - `fetchAggVotes` aggregates vote counts and displays them.

- **Edits / flags**
  - `openEditDialog(item)`:
    - overlay with current title, summary, evidence pre-filled,
    - requires justification,
    - inserts into `faith_edits`,
    - optionally calls RPC `ai_queue_verify_faith_edit(...)`.
  - `openFlagDialog(item)`:
    - reasons like spam/porn/hate/privacy/other,
    - inserts into `faith_flags`.

- **AI dock**
  - `#aiDockFR` at bottom right:
    - „Use my draft” – composes context from the current form,
    - „Review draft” – `reviewDraftLocallyFR()`:
      - checks length, evidence presence, detects generalisations and hot words,
      - writes notes and a ready prompt for neutralisation,
    - „Ask AI” – calls Supabase Edge Function `faith-chat` with prompt/context,
    - „Add note” / „Clear notes”.
  - Notes stored per-user as `fr_notes_<userId>` in `localStorage`.

---

## Backend services in this repo

### `server.js` – BeAwarely Proxy (Wikipedia / Open-Meteo / Google CSE / RAG)

Runs on **port 3001**.

- Express app with JSON body limit (`1mb`), in-memory rate-limit and cache.
- **`/api/rag/*`**:
  - http-proxy to `http://127.0.0.1:3010`,
  - logs calls, returns 502 JSON on proxy errors.
- **Rate limiting**:
  - sliding window 60s, max 30 req/IP → `429` on exceed.
- **Cache**:
  - simple `Map` with 10-minute TTL keyed by `q`, used in `/search`.

- **Helpers**:
  - `fetchWithTimeout` + `withTimeoutRetry` for resilient HTTP calls.
  - `stripHTML` to reduce HTML pages to plain text.

- **Wikipedia integration** (`tryWikipedia`)
  - Uses official API to search and fetch the top article.
  - Strips HTML to text.
  - Validates relevance using a local LLM (Ollama, `llama3.1` with temperature 0). Accepts only if model answers `YES` to „does this answer the question?”.

- **Weather (Open-Meteo)** (`tryOpenMeteo`)
  - Detects weather queries heuristically.
  - Uses Open-Meteo geocoding + forecast APIs.
  - Returns structured text (current temperature, precipitation, wind, source).

- **Google Custom Search (optional)**
  - Uses env: `GOOGLE_CSE_KEY`, `GOOGLE_CSE_CX`.
  - Scores results by keyword overlap and domain quality.
  - On good match, returns short text + link.
  - Contains commented-out integration with RAG Manager.

- **`/health`**
  - Simple healthcheck.

- **`/search?q=…`**
  - Normalises query and rejects too short/long ones.
  - Ignores typical ping/test queries.
  - Flow:
    1. return cached result if available,
    2. Wikipedia,
    3. Open-Meteo,
    4. optional Google CSE,
    5. fallback `{ source: "none", text: "no results" }`.
  - Includes hooks (commented / optional) to feed good web summaries into RAG.

---

### `api/rag_api.js` – Local RAG backend

Runs on **port 3010**.

- **Database**
  - SQLite `rag.db`, table `entries`:
    - `id`, `category`, `content`, `source`, `embedding` (JSON), `updated_at`.
  - `loadAllEntries()` loads and deserialises embeddings.

- **Ollama helpers**
  - `embed(text)`:
    - `POST /api/embeddings` with `RAG_EMBED_MODEL` (default `nomic-embed-text`).
  - `generate(prompt)`:
    - `POST /api/generate` with `MANAGER_MODEL` (default `llama3.1:8b-instruct-q6_K`),
    - used for summaries, classification, merges.
  - `cosine()` for cos-sim.

- **Quality filters**
  - `isTrustedWebSourceForRag(web)`:
    - allows only selected domains (Wikipedia, official orgs, docs, space/org sites, etc.).
  - `shouldInsertWebSummary(question, summary, category)`:
    - ensures length, basic quality and topic match,
    - filters out boilerplate, ads, cookie banners etc.

- **DB helpers**
  - `insertEntry`, `updateEntry`, `deleteEntry`, `getEntry`.

- **Queue + dedup**
  - In-memory queue and `queueBusy` flag.
  - `canProcessNow()` checks CPU load and memory to avoid overload.
  - `processQueue()`:
    - for each job, runs `reallyInsertWithDedup`.
  - `reallyInsertWithDedup(job)`:
    - loads all entries, computes cos-sim,
    - no match or low score → insert new entry,
    - high score → LLM-based merge:
      - prompts model to merge old and new text into one neutral encyclopedic description,
      - truncates, normalises,
      - optionally re-classifies category,
      - updates existing row.
    - on merge failure:
      - either update or insert, depending on similarity/name.

- **HTTP endpoints**

  - `GET /api/rag/docs/:id`  
    Returns a single entry.

  - `POST /api/rag/add`  
    Direct insert (used from moderator panel). Computes embedding synchronously.

  - `PUT /api/rag/update/:id`  
    Updates entry; can recompute embedding if `reembed=true`.

  - `DELETE /api/rag/delete/:id`  
    Deletes entry.

  - `GET /api/rag/categories/:cat/docs`  
    Returns all entries within one category.

  - `POST /api/rag/insert`  
    Special endpoint for the proxy:
    - rejects very short or clearly „prompt-like” content,
    - auto-classifies category when missing (via LLM),
    - sets default `title`/`source` if missing,
    - embeds content and enqueues via dedup queue,
    - returns `{ ok: true, queued: true, ... }`.

  - `POST /api/rag/reindex`  
    Re-embeds all records (e.g. after changing embedding model).

  - `GET /api/rag/search?q=…&k=…&cat=…`  
    Main RAG search endpoint:
    - blocks obviously creative or pure weather queries (those go elsewhere).
    - **Stable facts with years**:
      - special path for queries involving years and „who is / president / Ballon d'Or / awards / elections” etc.,
      - prefers RAG entries with matching year and passes them through a YES/NO semantic check,
      - if nothing in RAG, can query `INTERNET_SEARCH_URL` and return a short fact (with optional insert).
    - **Normal queries**:
      - embeds question, scores against entries (optionally filtered by category),
      - if good matches:
        - builds context from top entries under char limit, marks as `rag_match`,
      - if RAG is weak:
        - calls proxy `/search`,
        - summarises web text via LLM,
        - optionally classifies category and inserts into RAG when:
          - source is trusted,
          - `shouldInsertWebSummary` passes,
          - inserts via dedup queue,
        - returns concise context with note about origin (`generic_fact_*`).

  - `GET /api/rag/categories`  
    Returns list of category names (`['general']` fallback when empty).

---

## Running locally (overview)

> This is a **demo** / dev project, not a production-ready deployment recipe.

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-user/beawarely-demo.git
   cd beawarely-demo


2.    Supabase

        Create a Supabase project.

        Configure tables used by the frontend (profiles, user_posts, tool_ideas, work_experiences, activity_events, moderators, friendships, faith_*, etc.).

        Set redirect URLs for auth (e.g. http://localhost:8080 or your domain).

 3.   Configure js/supabase-client.js

        Set SUPABASE_URL and SUPABASE_ANON_KEY for your project.

4.    Run static frontend

        Serve the repo root with any static web server, e.g.:

    npx serve .
    # or
    python -m http.server 8080

5.Run AI services (optional but needed for chat/RAG)

    Install Node.js and dependencies.

    Start the proxy:

node server.js

Start the RAG backend:

        node api/rag_api.js

        Make sure Ollama is running locally with:

            an embedding model (e.g. nomic-embed-text),

            at least one reasoning/chat model (e.g. llama3.1, mixtral, qwen),

            model names matching your MANAGER_MODEL / frontend configuration.

6.    Point frontend to backend

        Configure your reverse proxy / DNS so that the frontend sees:

            https://ai.beawarely.com/api/generate → your chat model endpoint,

            https://ai.beawarely.com/api/rag → your RAG backend (possibly via server.js).

Status

This repository represents a work-in-progress demo of the BeAwarely platform:

    Frontend is fully functional for the described flows (auth, feed, chat, tools), assuming proper Supabase + AI backend configuration.

    RAG backend and proxy are designed for a single self-hosted machine with Ollama and SQLite.

    Moderation and AI-precheck features assume the presence of appropriate SQL policies, RPCs and Edge Functions in Supabase.

The code and README are meant to document what already exists – not to promise future features.
