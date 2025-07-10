# @marimo-team/react-finder

Headless file-explorer components for React. Bring your own data source
(an _adapter_) and your own styles; react-finder provides the state machine,
the accessible collections (built on
[react-aria-components](https://react-spectrum.adobe.com/react-aria/components.html)),
keyboard shortcuts, drag and drop, inline rename, context menus, search and
virtualization.

- **Headless** — no CSS ships. Every state is exposed as a `data-*` attribute
  (`data-selected`, `data-focused`, `data-dragging`, `data-editing`, …) so you
  style with plain CSS or Tailwind's `data-[selected]:` variants.
- **Adapters** — implement `list()` and whatever else your backend supports.
  Features light up based on which methods exist.
- **Composable** — `<Finder>` provides context; drop in `Finder.List`,
  `Finder.Tree`, `Finder.Table`, `Finder.Toolbar`, `Finder.ContextMenu`, … in any
  layout. Each collection renders your own `Finder.Item`.
- **A real core** — a framework-free store (zustand vanilla) with a per-directory
  cache, request cancellation, history that survives back/forward, and one
  operation runner for create/rename/move/copy/delete/upload.

## Install

```bash
pnpm add @marimo-team/react-finder react-aria-components
```

`react` and `react-dom` ≥ 18 are peer dependencies.

## Quick start

```tsx
import { Finder, MemoryAdapter } from "@marimo-team/react-finder";

const adapter = new MemoryAdapter({
  seed: { Documents: { "notes.md": "# hi" }, "todo.txt": "" },
});

const item =
  "flex items-center gap-2 px-3 py-1.5 outline-none " +
  "data-[hovered]:bg-neutral-100 data-[selected]:bg-blue-500 data-[selected]:text-white " +
  "data-[focus-visible]:ring-2 data-[cut]:opacity-50 data-[drop-target]:ring-2";

export function Explorer() {
  return (
    <Finder adapter={adapter} onOpen={(file) => console.log("open", file.path)}>
      <Finder.Toolbar>
        <Finder.Button action="back">Back</Finder.Button>
        <Finder.Button action="up">Up</Finder.Button>
        <Finder.Button action="newFolder">New folder</Finder.Button>
      </Finder.Toolbar>

      <Finder.Breadcrumbs>
        {(crumb) => (
          <Finder.Breadcrumb crumb={crumb}>
            <Link>{crumb.isRoot ? "Home" : crumb.name}</Link>
          </Finder.Breadcrumb>
        )}
      </Finder.Breadcrumbs>

      <Finder.List
        dragAndDrop
        renderEmptyState={({ isLoading }) => (isLoading ? "Loading…" : "Empty")}
      >
        {(file) => (
          <Finder.Item item={file} className={item}>
            {({ isEditing }) =>
              isEditing ? (
                <Finder.RenameInput />
              ) : (
                <>
                  {file.kind === "directory" ? "📁" : "📄"} {file.name}
                </>
              )
            }
          </Finder.Item>
        )}
      </Finder.List>

      <Finder.ContextMenu>
        {({ target }) => (
          <>
            {target && <Finder.MenuItem action="rename">Rename</Finder.MenuItem>}
            <Finder.MenuItem action="paste">Paste</Finder.MenuItem>
            <Finder.MenuItem action="delete">Delete</Finder.MenuItem>
          </>
        )}
      </Finder.ContextMenu>
    </Finder>
  );
}
```

Double-click / Enter opens folders and calls `onOpen` for files. `F2` renames,
`Delete` deletes, `⌘C`/`⌘X`/`⌘V` copy/cut/paste, `Backspace` goes up, `⌘⇧N`
creates a folder. Arrow keys, typeahead, range selection and select-all come
from react-aria.

## Adapters

```ts
interface FileSystemAdapter {
  list(path, { signal?, cursor? }): Promise<{ items: FileItem[]; cursor?: string }>;
  // Everything below is optional. Presence enables the feature.
  stat?(path, opts?): Promise<FileItem>;
  createDirectory?(path, opts?): Promise<FileItem>;
  createFile?(path, { content? }): Promise<FileItem>;
  delete?(path, opts?): Promise<void>;          // recursive
  move?(from, to, opts?): Promise<FileItem>;    // also used for rename
  copy?(from, to, opts?): Promise<FileItem>;
  readFile?(path, opts?): Promise<Blob>;
  writeFile?(path, data, opts?): Promise<FileItem>;
  getDownloadUrl?(path, opts?): Promise<string>;
  search?(query, { path? }): Promise<FileItem[]>;
  watch?(cb: (e: { type: "changed"; path: string }) => void): () => void;
  dispose?(): void;
}

interface FileItem {
  path: string;            // normalized, the item's identity
  name: string;
  kind: "file" | "directory";
  size?: number;
  modifiedAt?: number;     // epoch ms
  createdAt?: number;
  mimeType?: string;
  meta?: Record<string, unknown>;
}
```

Rules: paths in and out are normalized (`/a/b`); throw `FinderError` with a
`code` (`not_found`, `exists`, `permission`, `unsupported`, `aborted`,
`unknown`) or any `DOMException`/`Error` (mapped by `toFinderError`); honor
`signal`; don't sort (the core does).

Built in:

| Adapter                                                                              | Import                                  | Notes                                                                                                                               |
| ------------------------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MemoryAdapter`                                                                      | root                                    | In-memory `VirtualFS`; `seed`, `persist`, `latency`, `pageSize`, shared `fs`. Implements everything — the reference implementation. |
| `createSessionStorageAdapter` / `createLocalStorageAdapter` / `createStorageAdapter` | root                                    | `MemoryAdapter` persisted to any `Storage`.                                                                                         |
| `readOnlyAdapter(adapter)`                                                           | root                                    | Wrap any adapter to hide its mutating methods.                                                                                      |
| `FileSystemAccessAdapter`                                                            | root                                    | Browser File System Access API (`showDirectoryPicker()`).                                                                           |
| `S3Adapter`                                                                          | `@marimo-team/react-finder/adapters/s3` | Needs the optional peer `@aws-sdk/client-s3`. Read-only unless `readOnly: false`.                                                   |

## Components

| Component                                                  | Built on                            | Notes                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Finder`                                                   | —                                   | Root: creates the store, provides context, renders `<div data-finder>`, hosts shortcuts and the context-menu trigger. Props: `adapter` or `locations`, `defaultPath`, `selectionMode`, `selectionBehavior`, `onOpen`, `onNavigate`, `onSelectionChange`, `onError`, `onOperation`, `onUpload`, `shortcuts`, `sort`, `showHidden`, `store`. |
| `Finder.List`                                              | `GridList`                          | `layout="stack" \| "grid"`, `path`, `dragAndDrop`, `virtualized` + `layoutOptions`, `renderEmptyState`.                                                                                                                                                                                                                                    |
| `Finder.Table` + `TableHeader`/`TableBody`/`Column`/`Cell` | `Table`                             | `Column id="name" allowsSorting` drives the store sort.                                                                                                                                                                                                                                                                                    |
| `Finder.Tree`                                              | `Tree`                              | Lazy children from the shared cache, `rootPath`, `navigateOnSelect`.                                                                                                                                                                                                                                                                       |
| `Finder.Item`                                              | `GridListItem` / `Row` / `TreeItem` | One component for all collections. Render props: react-aria's plus `item`, `isEditing`, `isCut`, `isLoading`, `level`, `isExpanded`, `hasChildItems`. With `dragAndDrop`, a visually hidden `<Button slot="drag">` is added for keyboard users (`dragHandle={false}` to render your own; `Finder.DragHandle` is the default).              |
| `Finder.Button`                                            | `Button`                            | `action="back" \| "forward" \| "up" \| "refresh" \| "open" \| "newFile" \| "newFolder" \| "rename" \| "delete" \| "copy" \| "cut" \| "paste" \| "selectAll" \| "clearSelection" \| "loadMore"`; auto-disables. `trigger` for `DialogTrigger` confirm flows.                                                                                |
| `Finder.Toolbar`                                           | `Toolbar`                           |                                                                                                                                                                                                                                                                                                                                            |
| `Finder.Breadcrumbs` / `Breadcrumb`                        | `Breadcrumbs`                       | Render a `<Link>` inside each crumb.                                                                                                                                                                                                                                                                                                       |
| `Finder.SearchInput`                                       | `SearchField`                       | Uses `adapter.search` if present, else filters the directory.                                                                                                                                                                                                                                                                              |
| `Finder.RenameInput`                                       | `TextField`                         | Enter commits, Escape cancels, blur commits. Children must be a react-aria `<Input>` (the default).                                                                                                                                                                                                                                        |
| `Finder.ContextMenu` / `MenuItem` / `MenuSeparator`        | `Menu` + `Popover`                  | Opens on right-click, Shift+F10, Menu key.                                                                                                                                                                                                                                                                                                 |
| `Finder.DropZone`                                          | `DropZone`                          | Accepts Finder items (move/copy) and OS files (upload).                                                                                                                                                                                                                                                                                    |
| `Finder.Locations` / `LocationItem`                        | `ListBox`                           | Switch between adapters.                                                                                                                                                                                                                                                                                                                   |
| `Finder.Preview`                                           | —                                   | Render prop with the selected item and, with `read`, its content.                                                                                                                                                                                                                                                                          |
| `Finder.State`                                             | —                                   | Render prop: items, selection, loading, errors, history, clipboard, `hasMore` (pagination).                                                                                                                                                                                                                                                |

Every component is also exported by name (`FinderList`, …) and accepts the
underlying react-aria props (`className`, `style`, `aria-*`, `data-*`, …).

### Data attributes

From react-aria (free): `data-selected`, `data-focused`, `data-focus-visible`,
`data-hovered`, `data-pressed`, `data-disabled`, `data-dragging`,
`data-drop-target`, `data-expanded`, `data-level`, `data-empty`,
`data-sort-direction`, `data-current`, …

From react-finder: `data-kind="file|directory"`, `data-path`, `data-editing`,
`data-cut`, `data-loading`, `data-error`, `data-action`, `data-root`,
`data-searching`, `data-active`, `data-finder`, `data-selection-mode`.

## Large directories

Collections render every item once into react-aria's collection model even
when virtualized, so cost is linear in directory size (roughly a millisecond
per item in development builds). Items hold no store subscriptions of their
own, so selection, rename and clipboard changes stay cheap. For very large
directories, return a `cursor` from `list()` and expose
`<Finder.Button action="loadMore">` (or call `store.loadMore(path)`), and turn
on `virtualized` for the DOM. A virtualized collection must be its own scroll
container: give it a bounded height and `overflow: auto` (e.g.
`className="block h-full overflow-auto"`), and give rows
`style={{ width: "inherit", height: "inherit" }}` in tables, as in the
react-aria Virtualizer docs.

## Escape hatch

```tsx
import { useFinder, useFinderStore } from "@marimo-team/react-finder";

const { currentPath, navigate, selectedPaths } = useFinder((s) => ({
  currentPath: s.currentPath,
  navigate: s.navigate,
  selectedPaths: s.selectedPaths,
}));
```

`useFinder(selector)` subscribes to the store (shallow-compared).
`useFinderStore()` returns the raw store; `createFinderStore()` builds one
outside React (pass it via `<Finder store={…}>` to share it or to test). A
store you create owns `onError`, `onOperation` and the initial location/path:
pass those to `createFinderStore`, not to `<Finder>`.

## Development

The toolchain is [Vite+](https://viteplus.dev) (`vp`): oxlint for linting, oxfmt for
formatting, vitest for tests, tsdown for the library build and TypeScript 7's native
`tsc` for type-checking.

```bash
pnpm dev            # demo gallery at http://localhost:5173/demo/
pnpm test           # vitest (node + jsdom); pnpm test:watch / pnpm test:coverage
pnpm typecheck      # tsc: library + demo (~1 s)
pnpm lint           # oxlint (pnpm lint:fix to autofix)
pnpm fmt            # oxfmt (pnpm fmt:check in CI)
pnpm check          # vp check (format + lint + type-aware lint) plus typecheck
pnpm build          # vp pack (tsdown) → dist/
pnpm check:package  # publint + arethetypeswrong against the packed tarball
pnpm clean          # remove dist/, demo/dist/ and the task cache
```

`vpr <script>` (Vite+'s task runner) runs any script above with caching keyed on
the files it reads, so an unchanged `vpr check` or `vpr test` replays instantly.

Linting and formatting are configured in `vite.config.ts`, not in separate
config files. The oxlint ruleset is deliberately strict and type-aware —
every category except `nursery` is an error, and `vp check` also type-checks —
so `pnpm lint` catches things like floating promises, deprecated APIs and
nullable numbers used as booleans. Tests import from `vite-plus/test`
rather than from `vitest`.

Commits run `vp staged` (`vp check --fix` on staged files) through the Git hook
dispatcher that `pnpm install` sets up; set `VP_GIT_HOOKS=0` to skip it.

`.vscode/extensions.json` recommends the [oxc](https://oxc.rs) extension
(`oxc.oxc-vscode`) so the editor reports the same diagnostics and formats on
save.
