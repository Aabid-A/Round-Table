# Design references

Sites and prompts whose look you want to match. Agents read this folder when
building UI (see `skills/ui-design`).

## Rules

- **Free prompts only** (e.g. the free ones on motionsites.ai). Do not add paid
  or premium prompts, and check a source's terms before saving it.
- **Keep this repo private** while it holds other people's prompts. If you make
  the factory public, move this folder to its own private repo or gitignore it.
- Credit the source in each file.

## Layout

```
design-references/
├── README.md
├── INDEX.md          one row per reference: read this first
├── STYLE.md          your distilled taste: the traits you like, shared by all
├── _template.md      copy this for each new reference
└── sites/
    └── <site-name>.md   one file per reference
```

## How to add one

1. Copy `_template.md` to `sites/<site-name>.md`.
2. Paste the free prompt, add a screenshot in `sites/img/`, and fill in what
   you like and the tokens.
3. Update `STYLE.md` if it shows a trait you want everywhere.

## How agents use it

For UI work: read `INDEX.md` and `STYLE.md` first. If the task names a kind of page (landing,
dashboard, portfolio), read the matching `sites/*.md` and adapt it. Take the
structure and feel, not a copy of the whole page, and keep to the project's own
tokens.
