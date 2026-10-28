# Meeting 6 plan: Under the Hood (how AI agents work)

The content spec the deck is built from. Slide states live in `BUILD.md`; this file says what each slide is for. Edit it if the plan changes, so every agent builds from the same plan.

## Who is in the room

Community college students, mixed majors, many beginners. Regulars saw Meeting 3 (the context window, the group chat hook, the Who/What/Why/How recipe) and Meeting 5 (vibe coding in Google AI Studio). Someone who has never come before must still be able to follow.

## What they leave with

1. An agent is the same AI with a written job, a loop that keeps it going, and a checklist that says when it's done. They write all three.
2. They built one agent, gave it structure, and then built a small team with a lead, helpers, and a checker that sent work back at least once.
3. Agents need limits: rules for what they may never do, a cap on rounds and model calls, and a person checking before anything leaves.

## Words (define once on screen, then use the same word every time)

- **model**: the AI itself (Gemini, Claude, ChatGPT).
- **instructions**: the written job an agent gets before any message. Same slot as "Instructions from the app" in Meeting 3's window.
- **tool**: something an agent can use besides writing, like a web search or a calculator. Our lab's agents only write and talk to each other.
- **loop**: the agent keeps going (do, check, redo) without you typing each step.
- **done when**: the checklist the work has to pass.
- **lead** and **helper**: the lead hands out jobs and makes the final call. A helper does one job and reports only to its lead. (Anthropic calls these the orchestrator and workers; OpenAI says manager and specialists. Say that once, then use lead and helper.)
- **checker**: an agent that grades work against "done when" and sends it back with notes.
- **agentic workflow**: agents passing work along a set path. Define it once, on the team slide.

## Running example

A game night kit for the club. **Event Lead** gets the task and gives jobs to **Flyer Writer**, **Caption Writer** (Instagram caption), and **Snack Planner** (snacks under $30). **Flyer Checker** grades the flyer against: has day, time, and room; under 40 words; ends with one clear thing to do. The lab's default preset is this exact team, so what the room sees on slides is what they build. The hook, the texting slide, and the check loop use text and counts from a real recorded lab run (`lab/examples/game-night-run.json`), never invented numbers.

## Slides

Times are slide start times. The meeting is 2:00 to 3:00 pm.

1. **cover** (2:00). ExplorAI · Meeting 6 / Under the Hood / How AI agents work / Wed, Oct 28 · 2-3pm · CIS A-204. Below the title, the three parts as small cards, each drawn from its own module: the chat (slide 8), the agent card (slide 10), the team tree (slide 18). The part slides (5, 12, 17) repeat the same three cards with that part lit and the others faded.
2. **signin** (2:01). Same title + sign-in QR (reuse Meeting 5's). Title, date, QR only. Stays up through Shares.
3. **shares** (2:04). One verified, recent news item about AI agents, with a source line. If nothing is verified in time, cut the slide rather than guess.
4. **hook** (2:07). A finished game night flyer. "Guess: how many AIs worked on this?" Next press reveals the team, the number of messages they sent each other, and the check rounds, from the recorded run. The question it opens: how does a pile of AIs make one thing without a person steering each step?
5. **part1** (2:10). Part 1 · From chat to agent · It starts with the window you already know.
6. **recall-chat** (2:10). Meeting 3's group chat, recreated with the same phone. First only the last message (part of the picture, so it guesses), then the whole chat (everything, so it knows).
7. **recall-window** (2:12). Meeting 3's context window card (Meeting 5 recreated it on its callback slide), filled one layer per press, ending on the rule: "It can't read what you didn't put in the window."
8. **session** (2:13). A chat is a window you keep filling. Three turns of a person steering a flyer by hand ("shorter", "add the room"), while a window meter grows because every message is sent again each turn.
9. **pin** (2:15). Write the job once. The top layer of the window, "Instructions from the app", is now written by you. One short message then gets a good flyer in one turn. The company usually writes this part and you never see it; now you write it.
10. **agent** (2:16). So what's an agent? The instruction card gains one labeled piece per press: Instructions (its job, written once), Tools (things it can use), Loop (it keeps going on its own), Done when (the checklist that tells it to stop). It ends as an agent card. Line: the same model, plus a written job, tools, a loop, and a way to know it's done (four pieces, matching the headline "Four more pieces"). Say once in the notes: real agents also use tools, like search or running code; ours only write, so they can't do anything outside the page.
11. **loop** (2:18). The loop: think, do, check, then again or done. One press per step, with the flyer: round 1 fails (too long, no room), notes go back, round 2 passes. A round counter shows "Round 1 of 3": the cap is a safety limit, without it a loop can run forever.
12. **part2** (2:20). Part 2 · Build one agent · One job, written well.
13. **setup** (2:20). Open the lab (QR + short URL). Two paths: get a free Gemini key in Google AI Studio and paste it, or use practice mode (prewritten replies). A key needs someone 18 or older with a personal Google account (not a school account); anyone else uses practice mode. Your key stays in this browser and goes only to Google. On the free tier, Google may use what you type to improve its products, and people may read it, so don't paste anything private.
14. **build1** (2:22). Build 1 · One agent, one job. Name it, give it one line of job, give it a task, run it. What did it get right? What did it guess? Timer 3:00. The pictured card matches the real lab.
15. **structure** (2:26). Give it structure. Six labeled parts, one per press, each with a flyer example taken from the lab's level 2 Flyer Writer: Role, Goal, Steps, Rules, Output, Done when. Beside them, the window shows these fill the instructions slot. Tie back to Meeting 3's recipe (Role is Who, Goal is What and Why, Rules, Output, and Done when are How). Line: same model, clearer job.
16. **build2** (2:28). Build 2 · Add structure, run the same task again, compare. Level 2 loads the six parts filled in: read them, run, then change one part and run again. What did it stop guessing? Timer 5:00. Then 3 presses compare the two real answers from the lab's recordings (`lab/examples/game-night-l1.json`, `game-night-l2.json`; practice mode replays them): press 1 Build 1's flyer as it came back (191 words, an image placeholder, emoji, headings; cut with a fade), press 2 Build 2's flyer in full (46 words), press 3 its own Done when line "Under 40 words" failing: nothing checked it yet, which leads into Part 3. Word counts use the lab's `wordCount` (`lab/engine.js`).
17. **part3** (2:33). Part 3 · Build a team · One lead, clear jobs, and checks that send work back.
18. **team** (2:33). Who's in charge? You, then Event Lead, then three helpers. One press each: your task reaches the lead, the lead splits it into jobs, helpers report back up, the lead combines and answers you. Three rules on screen: helpers only take jobs from their lead; only the lead answers you; the lead makes the final call. Define agentic workflow here.
19. **texting** (2:36). What they say to each other. A Meeting 3 style group chat titled "Game Night Team", one bubble per press, from the recorded run: jobs from the lead, a draft, the checker's notes, the fix, the pass, the lead's final message to you. (The recorded run took 3 rounds, so the slide adds "notes again" and "another fix": 8 presses.)
20. **checkloop** (2:38). Done when. The checklist card, with the recorded run's marks: round 1 fails two lines and sends notes back; the slide follows the run until a round passes all three (in the recorded run: round 1 pass, fail, fail; round 2 pass, fail, pass; round 3 all pass). Chip: max 3 rounds; the line states the rule ("The limit: after 3 failed rounds, the Flyer Checker stops and names the lines that still fail. The lead gets the last draft."), so it reads as the rule beside a round 3 that passed. Line: a checker only works if "done" is written down.
21. **build3** (2:40). Build 3 · Make a team. Start from Game Night (level 4 already has Flyer Checker) or build your own team; to add a checker, select an agent, press + Checker, and give that agent 2 or 3 Done when lines; run it, read the messages. Challenge: make the checker send something back at least once. Timer 10:00.
22. **wrong** (2:50). Headline: "It did something nobody told it not to do." (Meeting 4's question). The tip form card shows first (July 18, the tip, "Police flagged it as spam"); press 1 adds what it was told with the missing line "Nothing said not to send forms."; press 2 adds "Anthropic found the tip about two months later, and police called the delay “unacceptable.”" Presses 3 to 6: four limits, each with what the lab does: write the rules (each agent has a Rules part), limit what it can use (agents can only write: no forms, no web), cap the rounds and model calls (at most 3 check rounds and 24 model calls a run; teams up to 8 agents, 4 levels: `lab/engine.js` DEFAULT_LIMITS), a person checks before anything leaves (the lead's final answer comes back to you). Earlier plan text, kept for the wording: Meeting 4's police tip, as Meeting 4 told it: during a test, Claude filled out a Philadelphia police tip form about an unsolved murder with a made-up tip. It was told not to log in, make accounts, or do anything destructive; nothing said not to send forms (ABC News, Oct 12, 2026 · Al Jazeera, Oct 10, 2026). Then three limits: write the rules, cap the rounds and model calls, a person checks before anything leaves. Our lab caps rounds and model calls, and its agents can only write.
23. **takeaway** (2:54). One thing to remember, in one sentence: "An agent is the same AI plus three things you write: a job, a loop, and a checklist for done." Under it, slide 10's finished Flyer Writer card (Tools faded, since the lab's agents only write); one press brings in slide 18's team tree, joined to its Flyer Writer node.
24. **thanks** (2:56). Thank you! Next week · Nov 4 · topic (Cole sets it; "Topic coming soon" until then). Instagram + Discord QRs (reuse Meeting 5's).

## Design bar

- Same look as Meetings 4 and 5: cream and wash backgrounds, Fraunces display, DM Sans body, soft entrances that replay each time a slide shows, `data-build-in` reveals, off under prefers-reduced-motion. Light theme only.
- Bespoke modules, built in HTML and CSS like Meeting 3's group chat: the recalled phone, the filling window, the session-to-agent card, the loop, the team tree with jobs moving down and reports moving up, the agents' group chat, and the checklist. Each press is one step, and pressing back returns to the step before.
- Readable from the back of the room: body text 28px or more on the 1920x1080 stage, labels 22px or more.
- Pictures of the lab match the real lab. Phones look like the real phone (Meeting 3's markup).
- Copy is plain and specific: name the thing, no idioms, no jargon without a definition, no lines that describe the slide's own layout.
