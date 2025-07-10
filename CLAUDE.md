# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

`@marimo-team/react-finder` is a headless React file-explorer library
(TanStack-Table-style): pluggable `FileSystemAdapter`s, a framework-free store,
and unstyled components built on `react-aria-components` (RAC). See `README.md`
for the public API.

## Commands

The toolchain is Vite+ (`vp`); `vite.config.ts` is the single config file for
the demo build, the library build, tests, oxlint, oxfmt, the task cache and the
pre-commit `staged` rules.

- `pnpm dev` — demo gallery (Vite, http://localhost:5173/demo/)
- `pnpm test` — vitest via `vp test` (`src/**/*.test.ts` run in node; `*.test.tsx`
  opt into jsdom). Tests import from `vite-plus/test`, not from `vitest`
  (enforced by `no-restricted-imports`).
- `pnpm typecheck` — TypeScript 7 `tsc` for `src/` (tests included) and `demo/`
- `pnpm lint` — oxlint (`pnpm lint:fix` to autofix — review the diff, fixers can
  change semantics)
- `pnpm fmt` — oxfmt (`pnpm fmt:check` in CI)
- `pnpm check` — `vp check` (format + lint + type-check) plus `pnpm typecheck`
- `pnpm build` — `vp pack` (tsdown) → `dist/` (tests excluded);
  `pnpm check:package` validates the result with publint + arethetypeswrong
- `vpr <script>` — cached run of any script (`run.cache.scripts` is on)

The oxlint config in `vite.config.ts` is strict and type-aware: every category
except `nursery` is an error, with a documented list of rules turned off. Do not
add `biome-ignore` comments; use `// oxlint-disable-next-line <rule> -- reason`
only for genuine false positives. Use top-level `import type` (never inline
`type` specifiers): `verbatimModuleSyntax` is on. `src/index.ts` must never
import `adapters/s3` (`no-restricted-imports` enforces the subpath boundary).
`.vscode/extensions.json` recommends `oxc.oxc-vscode` so the editor reports the
same diagnostics.

## Layout

- `src/core/` — framework-free: `types.ts` (adapter contract, `FileItem`),
  `errors.ts`, `path.ts`, `naming.ts`, `selectors.ts`, and `store/` (zustand
  vanilla store: `cache.ts` directory cache with abort/sequencing, `navigation.ts`
  history, `operations.ts` the single `runOperation` funnel, `misc.ts` the rest).
- `src/adapters/` — `memory/` (`VirtualFS` + `MemoryAdapter`, the conformance
  reference), `fileSystemAccess/`, `s3/` (subpath export only; never import it from
  `src/index.ts`), `testing/` (adapter contract suite, controlled adapter).
- `src/components/` — thin RAC wrappers. `FinderRoot` owns the store, contexts,
  shortcuts and context-menu delegation; `collections/FinderItem` renders
  `GridListItem`/`Row`/`TreeItem` depending on the enclosing collection.
- `src/hooks/` — `useFinder`/`useFinderStore` are public; `internal/` is not.
- `src/actions/`, `src/keyboard/`, `src/dnd/` — pure, unit-tested logic.
- `demo/` — Vite gallery, styled with Tailwind (CDN) via `data-*` variants.

## Principles

1. **Headless.** No styles in `src/`. Expose state as `data-*` attributes
   (RAC already emits `data-selected`, `data-focused`, `data-dragging`, …; we add
   `data-kind`, `data-path`, `data-editing`, `data-cut`, `data-loading`, …).
   Consumers style with `data-[selected]:…` (attribute presence).
2. **Use RAC components, not hand-rolled ARIA.** Selection, keyboard navigation,
   typeahead, drag and drop, menus, popovers and virtualization come from RAC.
3. **Logic outside React.** Anything testable without a DOM lives in `src/core`,
   `src/actions`, `src/keyboard`, `src/dnd`. Components are glue.
4. **Paths are identity.** `FileItem.path` is the key everywhere (RAC keys are
   the path too — see `keyItems`). Adapters return normalized paths.
5. **Capabilities are structural.** An adapter enables a feature by implementing
   the method; the store checks `capabilities` before running an operation.
6. **The store is the only writer of the cache.** Mutations go through
   `runOperation`; listings go through `loadDirectory`. Never call the adapter
   from a component.
7. **Selectors returning arrays must be referentially stable** (see the caches in
   `selectors.ts`), or `useFinder` will re-render forever.
8. **Consumers own the item element.** Collections render
   `children(item) => <Finder.Item item={item}>…</Finder.Item>`.
9. **Items must stay cheap.** react-aria renders every item (virtualized or not)
   to build its collection, so `Finder.Item` reads `ItemStateContext` published
   once per collection instead of subscribing to the store. Options handed to
   `useDragAndDrop` are memoized: react-aria keys its hooks on object identity.

## Testing notes

- Store tests use `createControlledAdapter()` to resolve adapter calls by hand
  (races, aborts, partial failures).
- Every adapter should pass `describeAdapterContract()`.
- Component tests use Testing Library + user-event under jsdom
  (`// @vitest-environment jsdom`). `src/test/setup.ts` polyfills
  `ResizeObserver`, `scrollIntoView`, `matchMedia`.
