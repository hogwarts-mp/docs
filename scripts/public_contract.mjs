import { cp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".cache", "public-contract");
// The Mod names its QA and diagnostic hooks with a leading underscore. They stay in the contract but not on the site.
const underscoreDeclaration = /[ \t]*(?:(?:export|declare|readonly|static|abstract|const|let|var|function|interface|type|class|enum|namespace)[ \t]+)*_[\w$]*(?=\s*[?!:(<{=;,]|\s+(?:extends|implements)\b)/y;
const continuation = /^\s*(?:[|&{=]|extends\b|implements\b)/;

const skipCommentOrString = (source, index) => {
  if (source.startsWith("//", index)) {
    const end = source.indexOf("\n", index);
    return end === -1 ? source.length : end;
  }
  if (source.startsWith("/*", index)) {
    const end = source.indexOf("*/", index + 2);
    return end === -1 ? source.length : end + 2;
  }
  const quote = source[index];
  if (quote !== '"' && quote !== "'" && quote !== "`") return index;
  let end = index + 1;
  while (end < source.length && source[end] !== quote) end += source[end] === "\\" ? 2 : 1;
  return end + 1;
};

// A declaration ends at its `;` or `,`, at the line break after it unless the type carries on, or just before the
// bracket closing the scope around it. Nested brackets, strings and comments are skipped over.
const declarationEnd = (source, index) => {
  let depth = 0;
  let last = "";
  for (let i = index; i < source.length; i++) {
    const skipped = skipCommentOrString(source, i);
    if (skipped !== i) {
      if (source[i] !== "/") last = source[i];
      i = skipped - 1;
      continue;
    }
    const char = source[i];
    if ("{([<".includes(char)) depth++;
    else if ("})]".includes(char) || (char === ">" && source[i - 1] !== "=")) {
      if (--depth < 0) return i;
    } else if (depth === 0 && (char === ";" || char === ",")) return i + 1;
    else if (depth === 0 && char === "\n" && !["|", "&", ":", "=", "?", "=>"].includes(last) && !continuation.test(source.slice(i + 1, i + 128))) return i;
    if (!/\s/.test(char)) last = char === ">" && source[i - 1] === "=" ? "=>" : char;
  }
  return source.length;
};

// Removes every underscore-prefixed declaration together with the doc comment directly above it.
export const stripUnderscoreDeclarations = (source) => {
  let output = "";
  let copied = 0;
  let comment = null;
  for (let i = 0; i < source.length; i++) {
    if (i === 0 || source[i - 1] === "\n" || i === comment?.end) {
      underscoreDeclaration.lastIndex = i;
      if (underscoreDeclaration.test(source)) {
        const start = comment && /^[ \t]*(?:\r?\n)?$/.test(source.slice(comment.end, i)) ? comment.start : i;
        let end = declarationEnd(source, underscoreDeclaration.lastIndex);
        end += /^[ \t]*(?:\/\/[^\n]*)?/.exec(source.slice(end))[0].length;
        // Blank lines stand in for the declaration so the reference's "Defined in" lines still match the published contract.
        output += source.slice(copied, start) + "\n".repeat(source.slice(start, end).split("\n").length - 1);
        copied = end;
        comment = null;
        i = end - 1;
        continue;
      }
    }
    const skipped = skipCommentOrString(source, i);
    if (skipped !== i) {
      const lineStart = source.lastIndexOf("\n", i - 1) + 1;
      comment = source.startsWith("/*", i) && /^[ \t]*$/.test(source.slice(lineStart, i)) ? { start: lineStart, end: skipped } : null;
      i = skipped - 1;
    } else if (!/\s/.test(source[i])) comment = null;
  }
  return output + source.slice(copied);
};

export const createPublicContract = async (contractRoot) => {
  await rm(publicRoot, { recursive: true, force: true });
  await cp(contractRoot, publicRoot, { recursive: true });
  for (const file of await readdir(publicRoot, { recursive: true })) {
    if (!file.endsWith(".d.ts")) continue;
    const declarations = path.join(publicRoot, file);
    await writeFile(declarations, stripUnderscoreDeclarations(await readFile(declarations, "utf8")));
  }
  return publicRoot;
};
