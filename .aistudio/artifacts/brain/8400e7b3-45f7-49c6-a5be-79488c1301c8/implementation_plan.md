# Live Results Hero & Class Pulse Redesign

Remove the subtitle under `"How the class thinks."` and upgrade the top section of the Live Results view into a striking, card-free editorial scoreboard with a live proportional completion ribbon, a real-time class consensus ticker, and reactive update animations whenever classmates finish.

## User Review & Critical Decisions

> [!IMPORTANT] Clarifying questions were skipped, so the plan proposes our strongest card-free editorial direction below. Review the visual layout and let me know if you want to adjust any element before building.

- **Hero Subtitle Removal**: The sentence `"Votes land the moment classmates finish. Individual choices stay private."` will be removed completely, keeping the header clean and punchy.
- **Card-Free Scoreboard Direction (Recommended Default)**: Instead of boxed cards, the three live metrics (`Joined`, `Completed`, `Still answering`) will sit inside an architectural hairline-divided ticker strip paired with an animated proportional progress ribbon and a live scrolling consensus marquee derived from real votes.

---

## 1. Overview & Core Concept

- **What It Does**: Replaces the sparse stat numbers beneath `"How the class thinks."` with an energetic, live-updating classroom scoreboard that immediately communicates how much of the class has finished and which coding habits are currently winning—all without wrapping anything in boxy cards.
- **Target Audience / Persona**: Students watching live results unfold together on laptops/phones or projected on a classroom screen after submitting their 10 answers.
- **Key Value**: Turns the top fold from static floating numbers into a living, room-scale visual centerpiece that reacts visibly every time a classmate locks in their answers.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. A student finishes the poll and opens Live Results.
  2. Above the fold, they see the oversized display headline **`How the class thinks.`**, an asymmetric hairline-divided metric strip (`Joined`, `Completed`, `Still answering`), a live proportional completion bar showing completed vs. active classmates, and a smooth kinetic marquee highlighting the current leading class preferences.
  3. As new students join or finish in real time over the SSE stream, the counters spring upward, a subtle pulse highlight flashes on the changing metric, the proportional bar glides smoothly, and the leading-vibe marquee updates automatically.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-contrast brutalist editorial scoreboard on the existing dark stage—pure typography, hairline rules, and kinetic motion with zero cards and zero pill badges.
  - *Color Palette & Mood*: Preserves the established dark-stage tokens (`#0B0B0F` background canvas, `#323244` hairline rules, `#F7F5EF` off-white display numerals, `#C6F432` Volt Lime for Completed/Progress, `#FF4D2E` Vermilion for Still Answering/Energy).
  - *Typography & Hierarchy*: Keeps `Bricolage Grotesque` for the hero headline and massive tabular numerals, `Geist` for clean labels, and `Geist Mono` (`tabular-nums`) for percentages and proportional readouts.
  - *Card-Free Layout & Spatial Composition*: Uses full-width horizontal hairline dividers (`border-y`) and clean vertical rules (`divide-x`) instead of rounded card boxes, plus a full-width two-tone completion ribbon and subtle scrolling consensus strip.
- **Interactive Feedback & Motion**:
  - Compositor-only `transform` and `opacity` animations: spring count-up numerals, a brief Volt Lime / Vermilion delta flash when a classmate finishes, smooth completion bar progression, and an endlessly looping consensus marquee (respecting `prefers-reduced-motion`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hairline Editorial Strip + Completion Ribbon instead of Cards or Gauge Modals**
  - *Chosen Approach*: An open, full-width architectural strip framed only by thin horizontal and vertical lines (`1px solid #323244`) with an integrated two-tone completion bar underneath.
  - *Why*: Matches your requirement for "no cards" while anchoring the huge numbers visually so they feel cohesive and intentional rather than floating in empty space.
  - *Alternatives Considered*: Circular radial gauges or floating badges, which feel heavier and closer to dashboard widgets than the bold editorial tone of the rest of the app.
- **Decision 2: Live Consensus Marquee in Place of Static Subtitle**
  - *Chosen Approach*: Replace the removed privacy/explainer sentence with a sleek unboxed ticker summarizing real-time leading splits across answered questions (only shown once at least 1 vote is in, otherwise showing a subtle waiting state).
  - *Why*: Eliminates filler prose while surfacing exciting class personality highlights right at the top of the page.
  - *Alternatives Considered*: Leaving blank space under the headline, which felt visually sparse above the numbers.

---

## 4. Technical Architecture & Data Strategy

- **Component & Data Flow Diagram**:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Live Results SSE Stream (/api/stream/results)        │
│   totalJoined · completedCount · stillAnsweringCount · question splits  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ real-time updates
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Live Results Hero Stage                         │
│                                                                         │
│  [1] Hero Display Headline: "How the class thinks." (no subtitle)       │
│                                                                         │
│  [2] Hairline Metric Strip (card-free, 3 equal columns + dividers)      │
│      ├── Joined          (spring counter + join flash)                  │
│      ├── Completed       (spring counter + Volt Lime finish flash)      │
│      └── Still answering (spring counter + Vermilion active indicator)  │
│                                                                         │
│  [3] Proportional Class Progress Ribbon                                 │
│      └── Volt Lime (Completed %) ── vs ── Vermilion (Still answering %) │
│                                                                         │
│  [4] Kinetic Class Consensus Ticker (derived from live question splits) │
│      └── Smooth looping strip of top leading class splits & percentages │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ scrolls below
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   10 Question Split Blocks (existing)                   │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**: Reuses the existing public aggregated payload (`totalJoined`, `completedCount`, `stillAnsweringCount`, and `questions[]` vote counts/percentages) with zero changes to server privacy guarantees—individual student names and individual answers remain strictly excluded.
- **Interactive & Reactive State Mapping**:
  - Track previous `totalJoined` and `completedCount` values in component refs/state to trigger a brief highlight pulse animation whenever incoming SSE events increment counts.
  - Compute leading option labels and percentages directly from `results.questions` to populate the live consensus marquee smoothly, falling back gracefully when `completedCount === 0` and respecting `prefers-reduced-motion`.
