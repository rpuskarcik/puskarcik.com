const path = require("path");

// Only the utilities the tree uses, scoped under .ft-root so host pages are untouched.
module.exports = {
  content: [path.join(__dirname, "../*.{js,jsx}")],
  important: ".ft-root",
  corePlugins: { preflight: false },
  theme: { extend: {} },
};
