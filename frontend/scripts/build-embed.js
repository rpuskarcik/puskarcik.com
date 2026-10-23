// Builds public/embed/family-tree.js: a single self-contained script (React + styles) exposing window.FamilyTree.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = path.join(__dirname, "..");
const ftDir = path.join(root, "src/familyTree");
const outFile = path.join(root, "public/embed/family-tree.js");

const twIn = path.join(ftDir, "embed/tailwind.css");
const twOut = path.join(root, "node_modules/.cache/ft-embed-tw.css");
fs.mkdirSync(path.dirname(twOut), { recursive: true });
execFileSync(
  path.join(root, "node_modules/.bin/tailwindcss"),
  ["-c", path.join(ftDir, "embed/tailwind.embed.config.js"), "-i", twIn, "-o", twOut, "--minify"],
  { stdio: "inherit", cwd: root }
);

const css = [
  fs.readFileSync(path.join(ftDir, "embed/fonts.css"), "utf8"),
  fs.readFileSync(twOut, "utf8"),
  fs.readFileSync(path.join(ftDir, "familyTree.css"), "utf8"),
].join("\n");

esbuild
  .build({
    entryPoints: [path.join(ftDir, "embed/entry.js")],
    outfile: outFile,
    bundle: true,
    minify: true,
    format: "iife",
    globalName: "FamilyTree",
    jsx: "automatic",
    loader: { ".js": "jsx", ".css": "empty" },
    define: { "process.env.NODE_ENV": '"production"', __FT_CSS__: JSON.stringify(css) },
    target: ["es2018"],
    legalComments: "none",
  })
  .then(() => console.log(`Built ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`))
  .catch(() => process.exit(1));
