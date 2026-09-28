# StoryMap Theme + Layout Planning Bundle

Target repository: `kywk/story-map`  
Captured main commit: `ff5cc5674b955358c7948d26b0e801cec5f1e637`  
Prepared: 2026-09-28

## Purpose

This bundle contains the approved planning artifacts for:

- five coherent built-in StoryMap themes;
- `card` and `full` story/map layout modes;
- advanced layout parameters;
- architecture boundaries for future layout modes;
- multi-agent implementation coordination.

## Directory layout

```text
story-map-theme-layout-bundle/
├── README.md
├── proposed/
│   └── SPEC.md
├── patches/
│   ├── 0001-pre-implementation-contract.patch
│   └── 0002-post-implementation-docs.patch
└── docs/
    └── history/
        └── 2026-09-28-map-theme-layout/
            ├── CONVERSATION_SUMMARY.md
            ├── DESIGN_SPEC.md
            ├── IMPLEMENTATION_PLAN.md
            ├── MULTI_AGENT_TASKS.md
            └── HANDOFF_PROMPT.md
```

## Recommended use

### 1. Copy the history folder first

Copy:

```text
docs/history/2026-09-28-map-theme-layout/
```

into the repository unchanged.

These files are planning/handoff artifacts and should remain archival after implementation.

### 2. Replace the product contract

Review and replace the repository root:

```text
SPEC.md
```

with:

```text
proposed/SPEC.md
```

This proposed specification keeps existing StoryMap behavior while adding the approved
theme/layout contract.

### 3. Apply the pre-implementation patch

```bash
git apply patches/0001-pre-implementation-contract.patch
```

This updates `AGENTS.md` so coding agents follow the new contract.

### 4. Implement

Start the PM/integrator with:

```text
docs/history/2026-09-28-map-theme-layout/HANDOFF_PROMPT.md
```

and use `MULTI_AGENT_TASKS.md` for package ownership.

### 5. Apply the post-implementation documentation patch

Only after the code is implemented:

```bash
git apply patches/0002-post-implementation-docs.patch
```

This updates:

- `README.md`
- `docs/architecture.md`
- `examples/basic.md`
- `packages/story-map-core/README.md`
- `packages/react-story-map/README.md`

`docs/architecture.md` intentionally stays an implementation-state document, so this patch
should not be applied before the implementation exists.

## Patch verification

Both patch files were syntactically generated as unified diffs and checked with:

```bash
git apply --check
```

against the corresponding files captured from main commit:

```text
ff5cc5674b955358c7948d26b0e801cec5f1e637
```

If main changes before implementation, rebase the documentation edits rather than forcing
the patch.

## Approved public configuration

Theme:

```yaml
map:
  theme: light | dark | vintage | cyber | atlas
```

Card layout:

```yaml
layout:
  mode: card
  card:
    align: left
    widthRatio: 0.34
    heightRatio: 0.72
```

Full layout:

```yaml
layout:
  mode: full
  full:
    side: left
    contentRatio: 0.50
```

The theme applies to both cartography and StoryMap-owned chrome. There is no independent
story theme. Markdown semantics and host typography remain host-owned.
