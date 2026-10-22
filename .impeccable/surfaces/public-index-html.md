---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/admin.html","public/js/chat.js"]
---

# Surface: Trò chuyện & Phiếu hẹn (chat drawer on her page, chat tab in /admin)

Mode: Operate. Extension of the established "Love-Note Notebook" world (DESIGN.md is authority; unchanged).

- Audience/job: em (studying on laptop, page open all day) chats with anh and proposes dates without leaving the page; anh answers from /admin.
- Action: send a message; propose / accept / reschedule / decline a date ticket.
- Constraints: free Workers + D1, polling (5s drawer open, 15s closed, 60s hidden), text rendered as plain text, anh–em voice, private.
- Study mode: new message = badge bump + small toast, no chime, no popup. Outside study: toast + chime + system notification when tab hidden.
- Unresolved: empty-state line is anh's to author (settings field `chatHello`, neutral default shipped).

## Direction contract

THESIS: The conversation is a page torn from her notebook, pinned to the right edge; dates are physical ticket stubs passed between them, stamped when agreed. Refuses the generic messenger look (grey bubbles, blue accent, avatars).
OWN-WORLD: Ruled-blue notebook page with margin-pink line; anh writes on sticky-cream notes, em on blush paper, both in Patrick Hand; perforated white ticket with lilac washi tape; raspberry ink stamp "Đã chốt"; pill controls with squish; raspberry-tinted shadows.
STORY: She sees a badge, opens the drawer, reads his note, taps the 📅 to propose "trà sữa, thứ Bảy 19:00"; he answers from admin; the ticket gets stamped and pins to "Sắp tới" with a countdown.
FIRST VIEWPORT: Drawer 400px at right, full height: header (his name, close), pinned "Sắp tới" ticket strip, scrolling ruled page of notes, composer at bottom with date-ticket and send buttons. Closed: 60px round launcher bottom-right with unread badge.
FORM: Notebook side-drawer (sole option; local extension). seed: none — roll skipped on purpose: local extension inside an established world (new-work §3 "Extend an existing surface" runs no concept tournament).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
