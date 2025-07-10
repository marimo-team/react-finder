import type { SeedTree } from "@marimo-team/react-finder";

/** Demo file system used by most examples. */
export const demoSeed: SeedTree = {
  Documents: {
    "Quarterly report.pdf": "%PDF-1.4 ...",
    "Meeting notes.md": "# Meeting notes\n\n- Ship the finder\n- Write docs\n",
    "Budget 2026.xlsx": "",
    Archive: {
      "2024 summary.docx": "",
      "2023 summary.docx": "",
      Older: { "2019.txt": "old", "2018.txt": "older" },
    },
  },
  Pictures: {
    "Beach.jpg": "",
    "Mountains.png": "",
    "Sunset.heic": "",
    Screenshots: { "screen-1.png": "", "screen-2.png": "", "screen-3.png": "" },
  },
  Projects: {
    "react-finder": {
      src: {
        "index.ts": "export * from './finder';\n",
        "finder.tsx": "export const Finder = () => null;\n",
        components: { "List.tsx": "", "Tree.tsx": "", "Table.tsx": "" },
      },
      "package.json": '{ "name": "react-finder" }\n',
      "README.md": "# react-finder\n",
      ".gitignore": "node_modules\ndist\n",
    },
    marimo: {
      "notebook.py": "import marimo as mo\n",
      "requirements.txt": "marimo\n",
    },
  },
  Music: {
    "Track 01.mp3": "",
    "Track 02.mp3": "",
    "Track 03.flac": "",
  },
  "todo.txt": "- try the demos\n- read the README\n",
  ".env": "SECRET=hidden-file\n",
};

/** A flat directory with many files, for virtualization demos. */
export function bigSeed(count: number): SeedTree {
  const tree: SeedTree = {};
  const exts = ["txt", "png", "jpg", "md", "pdf", "mp3", "ts", "json"];
  for (let i = 0; i < count; i++) {
    const ext = exts[i % exts.length];
    tree[`file-${String(i).padStart(5, "0")}.${ext}`] = "x".repeat(i % 977);
  }
  return { ...demoSeed, "Many files": tree };
}
