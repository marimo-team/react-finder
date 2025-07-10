/** Split "archive.tar.gz" into { stem: "archive.tar", ext: ".gz" }. Dotfiles have no extension. */
export function splitExtension(name: string): { stem: string; ext: string } {
  const index = name.lastIndexOf(".");
  if (index <= 0) return { stem: name, ext: "" };
  return { stem: name.slice(0, index), ext: name.slice(index) };
}

/**
 * Return `name` if it is not taken, otherwise "name (1).ext", "name (2).ext", ...
 * `taken` may contain full paths or bare names; only the last segment is compared.
 */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const names = new Set<string>();
  for (const entry of taken) {
    names.add(entry.slice(entry.lastIndexOf("/") + 1));
  }
  if (!names.has(name)) return name;
  const { stem, ext } = splitExtension(name);
  const base = stem.replace(/ \(\d+\)$/u, "");
  for (let n = 1; ; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!names.has(candidate)) return candidate;
  }
}

export function isHiddenName(name: string): boolean {
  return name.startsWith(".");
}

const INVALID_NAME = /[/\\]/u;

/** Returns an error message, or null when the name is acceptable. */
export function validateName(name: string): string | null {
  if (name.length === 0) return "Name cannot be empty";
  if (name === "." || name === "..") return "Name is reserved";
  if (INVALID_NAME.test(name)) return "Name cannot contain slashes";
  if (name.trim() !== name) return "Name cannot start or end with whitespace";
  return null;
}
