/**
 * Blob helpers that work in browsers, node and jsdom (whose Blob lacks
 * `text()` / `arrayBuffer()`).
 */
export async function blobToText(data: Blob | string): Promise<string> {
  if (typeof data === "string") return data;
  if (typeof data.text === "function") return data.text();
  const buffer = await blobToArrayBuffer(data);
  return new TextDecoder().decode(buffer);
}

export async function blobToArrayBuffer(data: Blob): Promise<ArrayBuffer> {
  if (typeof data.arrayBuffer === "function") return data.arrayBuffer();
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        resolve(reader.result as ArrayBuffer);
      });
      reader.addEventListener("error", () => {
        reject(reader.error ?? new Error("Failed to read blob"));
      });
      // oxlint-disable-next-line unicorn/prefer-blob-reading-methods -- this branch only runs when `Blob#arrayBuffer` is missing.
      reader.readAsArrayBuffer(data);
    });
  }
  return new Response(data).arrayBuffer();
}
