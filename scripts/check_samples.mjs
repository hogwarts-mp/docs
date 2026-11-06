import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createPublicContract } from "./public_contract.mjs";
import { syncContract } from "./sync_contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guidesRoot = path.join(root, "guides");
const extensions = { js: ".js", javascript: ".js", mjs: ".js", cjs: ".js", ts: ".ts", typescript: ".ts" };
const options = {
  allowJs: true,
  checkJs: true,
  noEmit: true,
  strict: true,
  // Plain JavaScript authors do not annotate parameters, so an untyped parameter is not a mistake in a sample.
  noImplicitAny: false,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts"],
  types: [],
};

// Samples elide the helpers, variables and sibling files around them, so a missing lowercase name or a relative
// import is the reader's own code. A missing capitalized name looks like a runtime global and is reported. In
// JavaScript, custom event payloads and exports are simply values, so reading one, even once a truthiness check
// narrows it to `{}`, or passing one on is not reported either; a TypeScript sample has to narrow them as its reader would.
const ignored = (diagnostic, extension) => {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  const name = /'([^']+)'/.exec(message)?.[1] ?? "";
  if (diagnostic.code === 2307) return /^\.\.?\//.test(name);
  if (extension === ".js" && (diagnostic.code === 18046 || diagnostic.code === 2571)) return true;
  if (extension === ".js" && diagnostic.code === 2345) return message.startsWith("Argument of type 'unknown'");
  if (extension === ".js" && diagnostic.code === 2339) return message.endsWith("on type '{}'.");
  if (![2304, 2552, 2584, 18004].includes(diagnostic.code)) return false;
  return /^[a-z_$]/.test(name);
};

// Every JavaScript and TypeScript fence in a guide, with the guide line its first line of code sits on.
const extractSamples = (guide, source) => {
  const lines = source.split(/\r?\n/);
  const samples = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/.exec(lines[i]);
    if (!open) continue;
    let end = i + 1;
    while (end < lines.length) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lines[end]);
      if (close && close[1][0] === open[1][0] && close[1].length >= open[1].length) break;
      end++;
    }
    const extension = extensions[open[2].toLowerCase()];
    if (extension) samples.push({ guide, line: i + 2, extension, code: lines.slice(i + 1, end).join("\n") });
    i = end;
  }
  return samples;
};

// A sample opening with a comment that names one environment (`// server`, `// client/main.js`) is checked
// against that environment alone. Any other sample passes when it type-checks against at least one. Code that
// runs inside a web view (`// ui/shop.js, running in the page`) sees the DOM and the bridge the game adds to the
// page, scripts/page.d.ts, rather than the contract, and is checked there alone.
const pageComment = /\brunning in the page\b/;
const environmentsFor = (sample, environments) => {
  const comment = /^\s*\/\/(.*)/.exec(sample.code)?.[1] ?? "";
  if (pageComment.test(comment)) return ["page"];
  const named = environments.filter((environment) => new RegExp(`\\b${environment}\\b`).test(comment));
  return named.length === 1 ? named : environments;
};

const checkEnvironment = (contractRoot, environment, samples, declarations, compilerOptions = options) => {
  const files = new Map(samples.map((sample, index) => [path.join(contractRoot, "samples", environment, `${index}${sample.extension}`), `${sample.code}\nexport {};\n`]));
  const host = ts.createCompilerHost(compilerOptions);
  const { fileExists, readFile: read, getSourceFile } = host;
  const sample = (name) => files.get(path.resolve(name));
  host.fileExists = (name) => sample(name) !== undefined || fileExists.call(host, name);
  host.readFile = (name) => sample(name) ?? read.call(host, name);
  host.getSourceFile = (name, languageVersion, ...rest) => {
    const code = sample(name);
    return code === undefined ? getSourceFile.call(host, name, languageVersion, ...rest) : ts.createSourceFile(name, code, languageVersion, true);
  };
  const program = ts.createProgram([...declarations, ...files.keys()], compilerOptions, host);
  const global = [...program.getOptionsDiagnostics(), ...program.getGlobalDiagnostics()];
  if (global.length) throw new Error(ts.formatDiagnostics(global, host));
  return [...files.keys()].map((file, index) => {
    const source = program.getSourceFile(file);
    return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)].filter((diagnostic) => !ignored(diagnostic, samples[index].extension));
  });
};

const contractRoot = await createPublicContract(await syncContract());
const [reference, manifest] = await Promise.all(["reference.config.json", "manifest.json"].map((file) => readFile(path.join(contractRoot, file), "utf8").then(JSON.parse).catch(() => null)));
const environments = Object.keys(reference?.targets ?? {});
if (!environments.length) throw new Error("Scripting contract declares no targets");

const guides = (await readdir(guidesRoot, { recursive: true })).filter((file) => file.endsWith(".md")).sort();
const samples = [];
for (const guide of guides) samples.push(...extractSamples(path.posix.join("guides", guide.split(path.sep).join("/")), await readFile(path.join(guidesRoot, guide), "utf8")));

const contractDeclarations = (environment) => [path.join(contractRoot, "targets", "shared.d.ts"), path.join(contractRoot, "targets", environment, "api.d.ts")];
const results = Object.fromEntries(environments.map((environment) => [environment, checkEnvironment(contractRoot, environment, samples, contractDeclarations(environment))]));
// Only the page samples compile there; the rest stand in as empty files so the indexes line up.
const pageSamples = samples.map((sample) => (environmentsFor(sample, environments)[0] === "page" ? sample : { ...sample, code: "" }));
results.page = checkEnvironment(contractRoot, "page", pageSamples, [path.join(root, "scripts", "page.d.ts")], { ...options, lib: [...options.lib, "lib.dom.d.ts"] });
let failures = 0;
samples.forEach((sample, index) => {
  const candidates = environmentsFor(sample, environments).map((environment) => ({ environment, diagnostics: results[environment][index] }));
  if (candidates.some(({ diagnostics }) => !diagnostics.length)) return;
  const { environment, diagnostics } = candidates.reduce((best, candidate) => (candidate.diagnostics.length < best.diagnostics.length ? candidate : best));
  failures++;
  for (const diagnostic of diagnostics) {
    const position = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start) : { line: 0, character: 0 };
    const line = sample.line + position.line;
    const column = position.character + 1;
    const message = `TS${diagnostic.code} (${environment}): ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    console.error(`${sample.guide}:${line}:${column} - ${message}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::error file=${sample.guide},line=${line},col=${column}::${message.replace(/%/g, "%25").replace(/\r?\n/g, "%0A")}`);
  }
});

const summary = `${samples.length} samples in ${guides.length} guides against the ${manifest?.version ?? "local"} contract`;
if (failures) {
  console.error(`\n${failures} of ${summary} failed to type-check.`);
  process.exitCode = 1;
} else console.log(`Type-checked ${summary}.`);
