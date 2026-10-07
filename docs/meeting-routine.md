# ExplorAI Meeting Routine

Standard slide structure and segment order for every meeting.

---

## Slide order

### 1. Title page
- Meeting number, topic title, date, time, room
- No QR code — just let people settle in
- Background: gradient (`--grad`)

### 2. Title page + sign-in QR
- Same title and meeting info as slide 1
- Add sign-in QR code (Google Form) on the right side
- Leave this slide up through the explorAI Shares segment so late arrivals can sign in
- Use the same sign-in form link each semester; update the QR when the form changes

### 3. explorAI Shares
- 1–3 slides covering recent AI news, tools, or opportunities worth flagging
- Keep it punchy: one item per slide, headline + 2–3 bullets + a QR if there's a link
- Examples: hackathon deadlines, new model releases, interesting demos
- Aim for 3–5 minutes total

### 4. Hook
- One slide that creates a question the content will answer
- No slide title that gives away the answer — open with the tension, not the resolution
- Works best as a story, a demo, or a familiar situation with a surprising twist
- Leads directly into the content without a "today we'll cover" break

### 5. Content (≈35 minutes)
- The main teaching segment
- Break into 2–4 parts with a Part divider slide before each
- Part divider format: eyebrow "Part N", large display title, one-line subtitle
- One activity or demo per part keeps energy up
- Each slide ends with a bridge line in the notes that carries into the next slide without saying its headline

### 6. Closing page
Single slide with three things:

- **Thank you** — "Thank you!" as the main headline
- **Next meeting teaser** — card with the date and topic title ("Next week · [Date]")
- **QR codes** — Instagram and Discord side by side

| Platform | Handle / URL |
|---|---|
| Instagram | @explorai.rcc · https://www.instagram.com/explorai.rcc |
| Discord | https://discord.gg/CskqghTu7 |

---

## Timing reference (60-minute meeting)

| Segment | Length | Running time |
|---|---|---|
| Title + sign-in | 3 min | 0:00–3:00 |
| explorAI Shares | 5 min | 3:00–8:00 |
| Hook | 3–5 min | 8:00–13:00 |
| Content (with activity) | 35 min | 13:00–48:00 |
| Wrap-up + share-out | 7 min | 48:00–55:00 |
| Closing page + open chat | 5 min | 55:00–60:00 |

---

## Notes on each segment

**Sign-in slide** — reuse the QR from the previous meeting unless the form changed. Confirm the QR target before the meeting. The current sign-in form: `https://forms.gle/AAN5yiHXcajJvhAe8`.

**explorAI Shares** — Cole opens with this while people sit down. Keep it conversational, not a news broadcast. One sentence of "why this matters to you" per item.

**Hook** — the goal is to make people curious about the content before they know what the content is. A group chat read out of context, a bad AI answer, a weird prediction — anything that needs an explanation.

**Content parts** — each Part divider slide marks a gear shift, not just a new topic. Use them to reset the room's energy. See `CLAUDE.md` for part divider styling requirements.

**Closing page** — leave this up through open chat. Both QR codes stay visible. The next meeting teaser is always the last thing people read.

---

## QR code notes

QR codes in the deck are inline base64 PNGs. When you add or update a QR code, put its decoded URL in the commit message and in your log entry (`docs/agent-log.md`). Never embed a QR without recording what it points to.

Current QR targets:
- Sign-in: `https://forms.gle/AAN5yiHXcajJvhAe8`
- Instagram: `https://www.instagram.com/explorai.rcc`
- Discord: `https://discord.gg/CskqghTu7`
- Board application: `https://forms.gle/d6vLSxUzxgZUN5Q69`
