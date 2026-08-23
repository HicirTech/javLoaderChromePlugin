# Fixtures

Whole javdb video pages, saved from a browser on 2026-08-22, used by
`tests/javdb.test.ts` to check the parser against real markup rather than markup
written from the same assumptions the parser makes.

Each file is named for the video code it contains. Between them they cover the
cases the parser has to handle: one magnet and several, rows with a tag and rows
without, and sizes on both sides of a gigabyte.

Re-save a page here when javdb changes its markup. The selectors these files pin
down all live in one block at the top of `src/content/javdb.ts`.
