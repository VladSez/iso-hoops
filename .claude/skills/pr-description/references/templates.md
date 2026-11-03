# PR templates

Pick the one template that matches the PR's main change, and read only that one. A PR that mixes kinds uses the template of its headline change, and files the rest under change-class sections (🐛 Fix, 💄 Polish…) near the end.

Every template keeps the sections SKILL.md requires: Summary, Contents, At a glance, Screenshots (or terminal output), a diagram, Risks and the Technical overview. The templates only decide the middle sections, the diagram shape, the media and where risk tends to hide.

## Contents

1. [New mode or feature](#1-new-mode-or-feature)
2. [UI or layout polish](#2-ui-or-layout-polish)
3. [Gameplay bug fix](#3-gameplay-bug-fix)
4. [Physics or feel tuning](#4-physics-or-feel-tuning)
5. [New court or content](#5-new-court-or-content)
6. [Accessibility](#6-accessibility)
7. [Performance or refactor](#7-performance-or-refactor)
8. [Docs, tests or tooling](#8-docs-tests-or-tooling)

---

## 1. New mode or feature

**Title:** "Around the world: score from five spots in a row"

**Middle sections**, grouped by what the player gains:
- `## 🎯 A goal to chase`: the rules in sub-bullets (how a round starts, how it scores, how it ends).
- `## 🕹️ How to play it`: the menu path and the controls, plus what is locked or changed compared with free play.
- `## 💾 What's remembered`: any new saved state, such as a best score, a last-used mode or a setting.
- A bullet on what stayed the same, for example "Free shooting and its stats are untouched".

**Diagram:** `stateDiagram-v2` of the mode's lifecycle, covering entering it, one turn, the end state and restarting.

**Media:**
- A GIF of one complete turn, for example a made shot with the score updating.
- An MP4 of the full loop through to the end state.
- An after PNG of the mode's UI.
- A before/after crop of the menu or footer if it gained an entry.

**Risks to check:**
- Switching modes mid-action: during a charge, mid-flight, or with a round finished.
- Saved state from older versions, such as old or renamed localStorage values.
- Stats bleeding between modes.

## 2. UI or layout polish

**Title:** "Bigger touch controls that stay clear of the court on phones"

**Middle sections**, grouped by what is easier now:
- `## 🧭 Settings you can find`
- `## 📐 Fits every screen`

Name each breakpoint's behaviour in sub-bullets, for example "751–1180px: settings centred, links below".

**Diagram:** a `flowchart` of the layout per width range. When the change is about load order or flicker, use a `sequenceDiagram` of what paints when.

**Media:**
- A before/after table at desktop width, cropped to the changed area.
- A second before/after row at phone width (`[375, 812]`).
- A short MP4/GIF only if the change moves, such as a menu opening or a skeleton clearing.

**Risks to check:** overlap with the shot panel at each breakpoint, popovers clipped at screen edges, horizontal scroll, layout shift while loading, and reduced motion. Give measured gaps when you have them.

## 3. Gameplay bug fix

**Title:** say what the player no longer suffers, for example "Pausing mid-flight no longer drops the ball through the floor".

**Middle sections:**
- `## 🐛 What was wrong`: the symptom as a player saw it, and how to reproduce it.
- `## ✅ What happens now`
- If it was a regression, one bullet naming the PR or commit that introduced it.

**Diagram:** a `stateDiagram-v2` or `flowchart` showing the corrected path, with the old wrong edge drawn dashed and labelled "before".

**Media:**
- An MP4/GIF of the reproduction on `main` (before) and on the branch (after), staged with the same scenario.
- If the bug can't be staged reliably, show test output that fails on `main` and passes on the branch, in a fenced block.

**Risks to check:** what else reads the state you changed, and whether the fix is at the root or only guards the symptom. Say which, and why.

## 4. Physics or feel tuning

**Title:** "Bank shots come off the board softer, so more of them drop"

**Middle sections:**
- `## 🎚️ What feels different`: before → after numbers in sub-bullets (wobble ±0.05 → ±0.035, window 34–44%).
- `## 🧪 How it was tuned`: what was swept or measured.

**Diagram:** a `flowchart` of the inputs to the changed value, showing which constants feed it.

**Media:**
- An MP4 of the same staged shot before and after.
- If the change is numeric, a fenced block of the sweep or measurement output, so a reviewer can rerun it.

**Risks to check:** every mode that uses the constant, and whether tests pin the old value and need a deliberate update rather than a blind one.

## 5. New court or content

**Title:** "Night court: floodlights, long shadows and a buzzing hum"

**Middle sections:**
- `## 🏞️ The new court`: palette, props, ambient motion and sound, one fact per sub-bullet.
- `## 🧭 Where to find it`: the menu path.

**Diagram:** a `flowchart` from the court's data entry to what it drives (colours, props, audio).

**Media:**
- An after PNG of the court at desktop size.
- A GIF of its ambient motion, such as wind, sea or snow.
- A crop of the menu with the new entry.

**Risks to check:** the label width test (a long court name needs a wider `#court-label`), reduced motion, file size, and the `?v=` bump on `courts.js`.

## 6. Accessibility

**Title:** "The shot meter announces its power to screen readers"

**Middle sections:**
- `## ♿ Who this helps`, naming the assistive technology or setting.
- `## 🔍 What changed for them`: what is announced, focused or reachable now.

**Diagram:** a `sequenceDiagram` of the interaction as a screen-reader or keyboard user experiences it.

**Media:**
- Screenshots with the focus ring visible.
- A fenced block of the accessible names or roles before and after.
- An MP4 of the keyboard flow, if it moves.

**Risks to check:** sighted-user regressions, focus traps, and reduced motion.

## 7. Performance or refactor

**Title:** say what the player or the next engineer gets, for example "Switching courts is instant: each court bakes once, not every time".

**Middle sections:**
- `## ⚡ Faster` or `## ♻️ Simpler`, with measured numbers (before → after, how they were measured).
- `## 🟰 What stays the same`, which is the point of a refactor.

**Diagram:** a `flowchart` of module ownership before and after, side by side as two subgraphs.

**Media:** a refactor has nothing new to see, so show the gate and the measurement in fenced blocks instead. Say so in one line under Screenshots.

**Risks to check:** behaviour parity (which tests prove it), and whether a measured number explains what limits it.

## 8. Docs, tests or tooling

**Title:** "Physics tests now sweep shots from every spot on the court"

**Middle sections:**
- `## 📝 What's documented` or `## 🧪 What's covered now`
- `## 🛠️ How to use it`, with the command in a fenced block.

**Diagram:** a `flowchart` of the workflow or the test's reach.

**Media:**
- Terminal output in a fenced block, such as a test run or the tool's output.
- A screenshot only if the tool produces something visual.

**Risks to check:** whether the new tests can fail (show one failing on purpose), and whether anything ships to players (it usually shouldn't).
