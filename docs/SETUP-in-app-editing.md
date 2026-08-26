# Setup — In-app editing (coaches/admins)

This enables coaches/admins to edit player data **inside the app**. Edits save
instantly to the app's database (Firestore) and are mirrored to your Google
Sheet. You only need to do this setup **once**. ~10 minutes.

There are two systems to touch: **Google Apps Script** (writes to the Sheet) and
**Firebase/Firestore** (the instant layer + who's allowed to edit).

---

## 1) Apps Script — add the write handlers

1. Open your Apps Script project (the one behind your data URL:
   `script.google.com` → your Forge project).
2. Open `docs/apps-script-write-handlers.gs` from this repo and copy its contents.
   - If your project has **no** `doPost(e)` yet: paste the whole file in.
   - If it **already has** a `doPost(e)`: merge the `switch` dispatch from this
     file's `doPost` into yours, and paste all the helper functions
     (`verifyIdToken_`, `isStaffEmail_`, `updateCells_`, `addPlayer_`, etc.).
3. **Deploy the new version:** Deploy ▸ Manage deployments ▸ pencil-edit your
   Web App deployment ▸ Version = **New version** ▸ Deploy.
   Keep **Execute as: Me** and **Who has access: Anyone**.
   - The `/exec` URL stays the same, so nothing in the app changes.

> Authorization is automatic: a write only succeeds if the caller is signed in
> AND their email has a **Role** of `coach` or `admin` in your **Users** sheet.
> Nothing extra to maintain on the Apps Script side.

---

## 2) Firestore — rules + staff allowlist

**a. Rules.** Firebase console → Firestore Database → **Rules**. Add the two
`match` blocks from `docs/firestore.rules.txt` inside your existing
`match /databases/{database}/documents { … }` block (keep your current rules).
Click **Publish**.

**b. Staff allowlist.** Firestore Database → **Data** → **Start collection** →
Collection ID: `staff`. Add one document per coach/admin, using their **email
(lowercase) as the Document ID**. The document can be empty (no fields needed).
- Example doc IDs: `frattajulian@gmail.com`, `coachname@example.com`
- Add a doc for every coach/admin who should be able to edit.

> This list controls who can write the instant layer. It's separate from the
> Users sheet by necessity (rules can't read the Sheet), so keep it in sync when
> staff change.

---

## 3) Done — how to use it

- Sign in as a coach/admin, open a player, go to **Benchmarks**, tap **Edit**
  (top-right), change values, **Save changes**.
- The value updates instantly, appears in your Google Sheet within a second or
  two, and persists on reload.
- Players never see the Edit button.

### If a save fails
- "Could not save" usually means the Firestore rules/staff allowlist aren't set
  yet (step 2), or you're not signed in as a staff account.
- If the app updates but the **Sheet** doesn't: check the Apps Script deploy
  (step 1) and that the signed-in email has a coach/admin Role in Users.

### Editing both places
You can still edit the Sheet by hand. If the app and Sheet ever disagree on a
field, the **most recent edit wins** (the app tracks the prior value to detect a
later hand-edit to the Sheet).

---

## Rollout status
All phases are now built:
- **Benchmarks** — Edit button on the Benchmarks view.
- **Evaluations** (Mindset / Technique / Tactical / Physical), **RISE UP**, and
  **Coach Feedback** — Edit button on the Evaluation view; each metric becomes an
  input and feedback becomes text boxes, across all tabs, with one Save.
- **Player info & roster** — in Edit mode the player's name & team become
  editable, plus a "Hide this player" button (soft-delete: removed from the app,
  kept in the Sheet). The "Add Player" button now persists to the Sheet.

### One more Apps Script update (recommended)
The handler file was improved so writes to the **Pivotal Feedback** sheet land
reliably (it now matches a player by name if that sheet doesn't use real player
numbers, and matches columns case-insensitively so it never creates duplicates).
To get it: re-paste `docs/apps-script-write-handlers.gs` (replacing the previous
block, per the setup steps) and **Deploy → New version** once more.
- Benchmarks, Evaluations, RISE UP, add/hide player already work on your current
  deployment — this update is specifically to make **Feedback** writes robust.
