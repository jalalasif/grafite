# Acceptance checklist (Part IV)

Verbatim from the specification. **Claude does not flip these lines** (§I.14). The
architect verifies each against the running app and flips it. Every line stays
`FAIL` in this repo.

```
[FAIL] A user can visit any route unauthenticated and is redirected to /login
[FAIL] A user can enter the wrong password and sees an error, not a stack trace
[FAIL] A user can enter the correct password and lands on the note list
[FAIL] A user can fail login 6 times and the 6th is rate-limited
[FAIL] A user can log out and is returned to /login
[FAIL] A user can create a note and it appears in the list
[FAIL] A user can type in the editor and the text renders live (syntax hides outside the cursor)
[FAIL] A user can type a # heading and it renders at heading size while editing
[FAIL] A user can stop typing for 1s and the note saves without a save button
[FAIL] A user can reload mid-edit and their text is still there
[FAIL] A user can type [[ and see an autocomplete of existing notes
[FAIL] A user can accept a wikilink autocomplete and the link renders as a link
[FAIL] A user can click a wikilink and navigate to the target note
[FAIL] A user can link to a note that does not exist and the link renders as broken
[FAIL] A user can create the missing note and the previously-broken link now resolves
[FAIL] A user can open a note and see which notes link to it, with context
[FAIL] A user can see unlinked mentions of a note's title in other notes
[FAIL] A user can type #books/fiction and see the nested tag appear in the sidebar tree
[FAIL] A user can click a parent tag and see notes tagged with its children
[FAIL] A user can remove the last note from a tag and the tag disappears from the tree
[FAIL] A user can paste a screenshot into the editor and it uploads and embeds
[FAIL] A user can drag an image onto the editor and it uploads and embeds
[FAIL] A user can see an upload fail and retry it without losing their place
[FAIL] A user can press Cmd-K and search notes by content
[FAIL] A user can search with tag:books/fiction and results are scoped to that tag
[FAIL] A user can search with is:daily and results are scoped to journal entries
[FAIL] A user can see search results with the matched term highlighted
[FAIL] A user can press Cmd-K then > and see the command list
[FAIL] A user can press Cmd-D and land on today's daily note, created if absent
[FAIL] A user can open a daily note at 00:30 Dhaka time and it is dated today, not yesterday
[FAIL] A user can pick a past date and open or create that day's note
[FAIL] A user can export one note as Markdown and the file has frontmatter
[FAIL] A user can export one note as PDF and it is readable and paginated
[FAIL] A user can export the whole vault and receive a zip
[FAIL] A user can unzip that export, open it in Obsidian, and the wikilinks work
[FAIL] A user can unzip that export and the folder structure matches their tag tree
[FAIL] A user can import a single .md file and it appears as a note
[FAIL] A user can import a .zip of folders and the folders become nested tags
[FAIL] A user can see an import preview before confirming, showing counts and collisions
[FAIL] A user can import a file whose slug collides and neither note is destroyed
[FAIL] A user can import files that link to each other and the links resolve
[FAIL] A user can delete a note and it leaves the list
[FAIL] A user can open trash, see the deleted note, and restore it
[FAIL] A user can permanently delete a note and its images are gone from Blob storage
[FAIL] A user can toggle dark mode and the accent colour still has contrast
[FAIL] A user can navigate the entire app by keyboard with a visible focus ring
[FAIL] A user can narrow the window to 380px and the app is usable
[FAIL] A user can go offline, keep typing, come back online, and lose nothing
[FAIL] A user can hit a note with a <script> tag in the body and it does not execute
[FAIL] A developer can clone the repo, follow the README, and run it locally
[FAIL] A developer can push a commit and CI runs typecheck, lint, unit, integration, E2E
[FAIL] A developer can push a failing test and CI goes red and Vercel does not deploy
[FAIL] A developer can read git log --oneline and follow the build's logic
```
