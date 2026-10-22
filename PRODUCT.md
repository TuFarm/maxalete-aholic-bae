# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Em (primary):** a university student who studies on her laptop. She keeps the page open in a tab beside her study materials for long sessions, often all day. Mobile use is secondary: on phones, reminders and new letters appear as in-page popups because system notifications only work on desktop browsers.
- **Anh (author/admin):** her boyfriend, who built the site. He uses `/admin` to write letters, see whether they have been read, and edit settings and on-page content for her.

## Product Purpose

A private study companion that one person made for another. Success means all of these, for her:

1. She studies with more focus and more consistency (Pomodoro / Study Mode, instrumental music).
2. She feels cared for (letters, cute reminders, words of encouragement from him).
3. She stays healthy while studying (water and movement reminders, breaks).
4. She has somewhere to relax between sessions (the entertainment corner and mini games).
5. The two of them have a place to talk and plan dates together (chat drawer and date tickets).

## Positioning

This is not a generic study tool. Everything on the page is written and curated by one specific person for one specific person. The letters, reminders, and copy come from him, and the site's value is that personal authorship. No public productivity app can truthfully copy that.

## Operating Context

- She has a laptop browser tab open for hours next to her coursework. The page has to work as ambient company: timers, music, and periodic reminders, not a screen she stares at.
- He writes and schedules from `/admin`. She reads on the main page and polls for new mail every 60 seconds.
- `?fast` speeds time up (1 minute = 1 second) for local testing.

## Capabilities and Constraints

**Built now:**
- Study Mode / Pomodoro timer, instrumental music player, "Hôm nay của em" daily panel, cute reminders (water, movement), a mailbox with per-letter 4-digit PINs and optional hints, an entertainment corner with mini games (extensible through `GAMES` in `public/js/games.js`), and a settings modal.
- Admin: write letters, view sent letters and their read status, edit her settings and the on-page content.
- Auth: two passwords. Viewer sessions last 30 days and admin sessions last 7 days. Every page, asset, and API is blocked before login. Brute-force lockout is 8 failures per 15 minutes per IP. Letter content is rendered as plain text, never HTML, and isn't sent until its PIN is entered.

**Constraints:**
- 100% free on Cloudflare Workers + D1. Don't add paid services or another backend.
- Private, for these two people only. Always behind login, never public.
- Current stack: plain HTML/CSS/JS in `public/` and a Worker in `src/index.js`, with no build step. This is the incumbent setup, not something the user made binding.

- Chat & date tickets: two-way text and emoji chat. Either person can propose a date ticket (where, when, note), and the other can accept, reschedule or decline it. Accepted upcoming dates are pinned with a countdown, and "Đã xem" read receipts show under the last message. Her page shows a right-side drawer; admin has a "Trò chuyện" tab. Polling runs every 5s with the chat open, 15s with it closed and 60s with the tab hidden. During a focus session new messages only bump the badge and show a toast. Letters (PIN mailbox) stay separate and remain the more special channel.

## Brand Commitments

- Name: **Góc Học Của Bé**. Worker name: `goc-cua-be`.
- Voice: Vietnamese, with him speaking to her in a warm, cute register using "anh – em". All future copy must keep this voice.

## Evidence on Hand

- Real copy already in `public/index.html`, `public/admin.html`, and the seed data in `migrations/0001_init.sql`.
- There are no photos, testimonials, or external assets. Don't fabricate personal memories, dates, or messages on their behalf. Those come from him.

## Product Principles

1. **Personal over generic.** Every feature should carry his voice and care. A feature that could live in any productivity app has to earn its place.
2. **Ambient, not demanding.** It runs beside her studies for hours, so it should support focus and never compete with it.
3. **Care is the core feature.** Health reminders and letters aren't extras. They are why the site exists.
4. **Private by default.** Nothing leaks beyond the two of them: no analytics, no public pages, no third-party sharing.
5. **Free and simple to run.** It stays within Cloudflare's free tier and he can deploy it with one command.
