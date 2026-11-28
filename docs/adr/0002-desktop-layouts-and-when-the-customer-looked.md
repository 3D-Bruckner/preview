---
status: accepted
date: 2026-11-28
decision-makers: Marcel Bruckner
---

# Desktop layouts, several parts at once, and recording when the customer looked

## Context and Problem Statement

v0.2 was one narrow phone column everywhere. Marcel works at a desktop: he adds customers, adds models to send to them and reads their
feedback per model, and the customer's page hid the Rückmeldung card at the bottom right, showed the version twice and gave no sign
that a part was focused. He also wanted to know whether a customer had looked at what he sent. The design is
[`docs/superpowers/specs/2026-11-28-preview-v0.3-design.md`](../superpowers/specs/2026-11-28-preview-v0.3-design.md), agreed over four
rounds on an Open Design mock.

## Decision Outcome

What was built (branch `v0.3`):

- **The web app is wide.** The menu is a row under the header from 768 px and stays the tab bar on a phone. The customers are a list
  (search, "Neuer Kunde" in a dialog, the unseen feedback per customer written out) beside the open customer; on a phone the list and
  the customer are pages of their own. The customer is one card: name and note (a pencil edits them and the language), the link with
  Link kopieren, Öffnen, Neuer Link and Link widerrufen, **WhatsApp and Mail buttons** (`wa.me/?text=` and `mailto:` with a prepared
  text in the customer's language; preview sends nothing), when the customer last looked, the models (newest version, parts, "angesehen
  …", feedback counts) and a new model with its first 3MF in one form. The settings put the filaments and the tokens side by side.
- **The model page** has the title with a pencil (title and description in a dialog, no separate Modell box), "Wie <Name> es sieht" and
  Link kopieren, the versions as cards (picture, note, print time and weight, when the customer viewed that version, its feedback inline
  with colour wishes as chips) and the upload beside them.
- **Recording looks.** A migration adds `customers.seen_at` and `version_views`; only the last time is kept. The customer pages call
  `recordView` (starting from `customerByToken`) unless the request has an operator session, so Marcel's own look never counts; links
  into a model page there don't prefetch. MCP and REST answer `last_seen_at` on a customer and `seen_at` on a version.
- **The preview PNG is optional**: without one, the 3MF's own picture (`Metadata/plate_1.png`, else `Metadata/thumbnail.png`) is used; a
  3MF with neither is refused with that reason. The web app shows the pictures through `app/api/versions/[id]/preview`.
- **The customer's model page**: the view large with Maße and Druck side by side under it; beside it a sticky side panel with Teile &
  Farben (scrolling after about six rows) over Deine Rückmeldung; the drawings under Maße and Druck (after the side panel on a phone).
  One version picker, "Neu in Version n: …" under the title; the Versionen card is gone. **Several parts at once:** the focus button
  adds a part to what is shown, × takes it out, a bar over the view names the selection with "Ganzes Modell ×", and Maße measure the
  selection. The eye (hide a part) was dropped: showing some parts covers it, and two ways to reduce the view confused.
- **The language switch shows flags** (`components/flags.tsx`), each button named by its language in its own words; a language without
  a flag shows its code.
- New lucide icons in `components/icons.tsx` (copy, open link, chat, mail, edit, renew, search, upload, remove, feedback, revoke).

### Consequences

- Good: Marcel's daily path (customer → link → send → see whether they looked → read feedback per version) is one screen each on a desktop,
  and still one column on a phone.
- Good: whether a customer looked is answered without asking them, and Marcel's own checks don't spoil it.
- Bad: only the last look is kept, not a history; a customer who opens the link on two devices looks like one look.
- Neutral: WhatsApp has no lucide icon; the button uses the generic chat bubble (no second icon set).

### Not done here

The multi-plate slicing gap, all-black parts drawn without shading, and the tile previews (the handoff's "Found") are their own change.
