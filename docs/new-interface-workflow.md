# Studio Flow — New Interface & Workflow Reference

This documents the **redesigned** Studio Flow interface built in this project, button by button, as implemented in [`src/routes/index.tsx`](../src/routes/index.tsx) and the components under [`src/components/studio/`](../src/components/studio/). It is the counterpart to `current-interface-workflow.md`, written in the same format so the two can be compared side by side.

The redesign goal was **fewer clicks and no interruptions**: smart defaults so you can generate almost immediately, progressive disclosure so advanced options stay out of the way, and **one-tap batch generation of the whole pose set** instead of the old pose-by-pose modal loop.

---

## 0. What changed vs. the old tool (at a glance)

| Old workflow | New workflow |
|---|---|
| Pick mode → upload → pick angle → pick brand → tune 6 rows → generate **one** pose → confirm modal → Good → next modal → repeat | Upload → (brand + poses already defaulted) → **Generate the full set in one tap** |
| 11-tile brand grid always on screen | One searchable **Brand** field (type-to-find) |
| 3 interrupting modals (Optional Pose, Back Reference, Feedback) | **Zero modals** — replaced by inline chips, an inline back-photo tray, and an inline Redo popover |
| Aspect / Engine / Preset / Sheet / Mode / Sequence all always visible | Collapsed into one **Refine** popover with sensible defaults |
| One image at a time, 2-image rolling buffer | Whole **contact sheet** rendered at once, all shots kept |
| "Good" advances a hidden sequence pose-by-pose | No sequence machine — every selected pose renders in parallel order |

**Clicks to a first full shoot:** old ≈ 12–18 (per-pose, per-modal); new ≈ **4** (three uploads + Generate), because shoot type, brand, poses, aspect, and engine all ship with working defaults.

---

## 1. Screen layout

One header bar over a two-pane body:

- **Header** — camera logo + "Studio Flow" wordmark, and a "Pro active" status pill. No login/logout gating in this prototype.
- **Left pane — Setup panel** (`.panel`): a single card with three numbered steps stacked vertically (Shoot type → Photos → Brand & look) and the primary Generate button at the bottom.
- **Right pane — Stage**: empty state, or the generated **contact sheet** grid with per-shot actions.

There are **no modal dialogs**. Everything that used to be a modal is now inline.

---

## 2. Step 1 — "What are we shooting?"

A single row of **four pill-cards**: **Panty, Bra + Panty, Pushup, Bra**. Each card shows its required photo count. The active card fills with its shoot-type tint (Panty = orange, Bra+Panty = pink, Pushup = violet, Bra = cyan).

| Button | Sets | Photos required | Brand picker | Notes |
|---|---|---|---|---|
| **Panty** | `shootType = panty` | Model + Panty (2) | Locked | Poses limited to Front/Side/Back/Mood (no Zoom/Mockup). |
| **Bra + Panty** (default on load) | `shootType = bra_panty` | Model + Bra + Panty (3) | Active | All six poses available. |
| **Pushup** | `shootType = pushup` | Model + Pushup Bra + Panty (3) | Active | Reveals the **Pushup bra-only** checkbox below the row. |
| **Bra** | `shootType = bra` | Model + Bra (2) | Active | All six poses available. |

**Pushup bra-only** (checkbox, only visible in Pushup): sets `pushupBraOnly = true`, drops the Panty slot (2 photos: Model + Pushup Bra), and clears any uploaded Panty image.

**Behavior on switching shoot type** (`changeShootType`):
- Resets the pose set to that type's smart default.
- Turns off Pushup bra-only.
- **Prunes** any uploaded photos that the new type no longer uses (e.g. switching to Panty drops the Bra photo). No confirmation prompt — same as the old tool, but the pruning is scoped to only the slots that disappear.

---

## 3. Step 2 — "Drop your photos"

An **adaptive upload tray** ([`UploadTray.tsx`](../src/components/studio/UploadTray.tsx)) with a live counter (`n/total added`) and 2–3 slots shown per the table above:

- **Model** — always required.
- **Bra / Pushup Bra** — required unless Panty-only.
- **Panty** — required unless Bra-only or Pushup bra-only.

Each slot:
- Click anywhere on it **or** drag a file onto it → opens the picker / accepts the drop → reads the file as a base64 data URL and stores it. Dragging highlights the slot with a ring.
- Once filled it shows the **thumbnail**, a green ✓ badge, the slot label, and an **✕** button (top-right) that clears just that slot (`stopPropagation`, so it doesn't reopen the picker).
- `accept="image/*"` only — no other validation.

### Inline back-facing photos (replaces the old Back Reference modal)
Whenever the pose set includes **Back**, a collapsible **"Back-facing photos"** row appears directly under the slots. Tapping **Add** expands a compact second grid of the same product slots (Model · back, Bra · back, Panty · back). These are stored under `<slot>Back` keys and are only used for the Back shot. No modal, no sequence interruption — you add them when and if you want them.

---

## 4. Step 3 — "Brand & look"

### Brand picker (replaces the 11-tile grid)
A single field ([`BrandPicker.tsx`](../src/components/studio/BrandPicker.tsx)) showing the current brand's half-and-half color swatch + name. Clicking opens a **searchable command popover**: type to filter the 11 brands (Tweens, Dressberry, Invisi-Soft, Souminie, Komli, Joomie, Invisi-fit, Sztori, Intimist, Sushme, Swanz), arrow/enter or click to select. Defaults to **Tweens** on load so the field is never empty.
- In **Panty-only** mode the field is replaced by a disabled "Brand styling isn't used for Panty-only shoots" strip (brand is locked, mirroring the old behavior).
- Adding a brand to `BRANDS` in [`src/lib/studio.ts`](../src/lib/studio.ts) automatically adds it to the searchable list — no grid to grow.

### Poses in this set (replaces angle pills + the Optional Pose modal + the Sequence machine)
A row of six pose chips: **Front, Side, Back, Mood, Zoom, Mockup**. Chips not allowed for the current shoot type are greyed and disabled (Panty-only disables Zoom + Mockup). Each active chip is included in the generated set.
- Clicking a chip toggles it in/out; the set always renders in canonical order (Front → Side → Back → Mood → Zoom → Mockup).
- **Smart default:** Front + Side + Back + Mood are pre-selected (Zoom + Mockup are the opt-in "extras" — the same three angles the old tool treated as skippable, now just chips you can turn on).
- There is no "Optional Pose" confirmation and no auto-advance sequence — every selected pose is queued at once.

### Refine popover (replaces the Aspect / Engine / Preset / Sheet / Mode / Sequence rows)
A small **"{Aspect} · {Engine}[ · note]"** button (top-right of the poses row) opens one popover ([`RefinePanel.tsx`](../src/components/studio/RefinePanel.tsx)) containing:
- **Aspect** — 6 chips: Square (1:1), Portrait (3:4, default), Story (9:16), Landscape (4:3), Cinema (16:9), Amazon A4+.
- **Engine** — 2 cards: Gemini 3 Pro (best quality), 3.1 Fast (default, ~12s/shot).
- **Creative note** — one optional free-text box for mood/lighting/styling.

Everything here has a working default, so most shoots never need to open it.

---

## 5. Generate button

One primary CTA at the bottom of the setup panel. Its label is live and states exactly what's blocking it:

| Condition | Label |
|---|---|
| Rendering | "Rendering your shoot…" |
| Missing photos | "Add {missing slots} to start" |
| No poses selected | "Pick at least one pose" |
| No brand (non-Panty) | "Choose a brand" |
| Ready | "Generate {n}-shot set" |

Clicking it (`generate`) when ready:
1. Builds one queued `GeneratedShot` per selected pose (in canonical order), stamped with the current brand, aspect, and shoot type.
2. Renders them into the Stage as a batch — each shot flips `queued → rendering → done` in sequence with a short delay, so the contact sheet fills in progressively.
3. Sets `generating` while any shot is still rendering, then clears it.

(The prototype renders stylized brand-tinted frames as stand-ins for the real Gemini composite; wiring a live model swaps the timeout simulation in `generate` for the API call.)

---

## 6. Stage — output & review (replaces the 2-up buffer + Feedback modal)

[`Stage.tsx`](../src/components/studio/Stage.tsx) has two states:

- **Empty** — "Your shoot lands here" with a one-line explanation.
- **Contact sheet** — a header (`{Shoot type} · {done}/{total} shots` + **Download all**) over a responsive grid of every generated shot. Each frame shows its **pose tag**, **brand chip**, and **aspect tag**, and while rendering shows a spinner overlay.

Per-shot actions (under each frame):
- **Save** — draws that shot to a canvas and downloads it as a PNG (disabled until the shot is `done`).
- **Redo** — opens a tiny inline popover with a "what should change?" note field and a **Regenerate this shot** button. This replaces the old **Bad → Feedback modal** entirely: no checkboxes, no duplicated brand/callout editors — you just note the change and re-render that single frame.

Header action:
- **Download all** — saves every finished shot, staggered.

There is no **Stop** button and no **Good/advance** button, because there is no in-flight single-image run or hidden sequence to control — the whole set is generated together and every result is kept on screen.

---

## 7. Removed / merged from the old tool

- **Optional Pose modal** → poses are now inline chips; unselected = not generated.
- **Back Reference modal** → inline collapsible back-photo tray inside Step 2.
- **Feedback modal** → inline per-shot **Redo** popover with a note.
- **Login modal / usage gating** → not part of this workflow prototype (shown as "Pro active").
- **Preset search + Google Sheet Sync/Disconnect** → out of scope for the redesign; can be reintroduced inside the Refine popover if needed.
- **Creative vs Callouts toggle + structured callout fields + Zone dropdowns** → replaced by the single optional **Creative note**; per-zone callouts are a separate feature that would live behind an "Annotate" affordance if reintroduced.
- **Sequence Auto/Custom + Order pills** → replaced by the pose-chip set (selection order is normalized to canonical order).

---

## 8. Quick reference — every interactive control, one line each

| Control | Location | Action |
|---|---|---|
| Panty / Bra+Panty / Pushup / Bra pill-cards | Step 1 | Switch `shootType`; reset poses to default; prune now-unused photos |
| Pushup bra-only checkbox | Step 1 (Pushup only) | Toggle 2-photo Pushup; drop the Panty slot/image |
| Model / Bra / Panty upload slots | Step 2 | Click or drag-drop to upload; ✕ to clear |
| Back-facing photos "Add" + back slots | Step 2 (when Back selected) | Reveal/store separate back-facing uploads |
| Brand field + searchable popover | Step 3 | Type-to-find and set the brand; locked in Panty-only |
| Pose chips (×6) | Step 3 | Toggle a pose in/out of the set (some disabled per shoot type) |
| Refine button + popover | Step 3 | Set Aspect, Engine, and an optional Creative note |
| Generate {n}-shot set | Bottom of setup panel | Validate → queue every selected pose → batch-render into the Stage |
| Save (per shot) | Stage | Download that shot as a PNG |
| Redo (per shot) + note + Regenerate | Stage | Re-render just that shot with an optional change note |
| Download all | Stage header | Download every finished shot |
