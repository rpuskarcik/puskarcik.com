import { renderFamilyTree } from "../renderFamilyTree";
import { buildTree } from "../buildTree";

const injectStyles = () => {
  if (document.getElementById("ft-embed-styles")) return;
  const style = document.createElement("style");
  style.id = "ft-embed-styles";
  style.textContent = process.env.FT_EMBED_CSS;
  document.head.appendChild(style);
};

// window.FamilyTree.render(elementOrSelector, peopleArray, options)
export function render(target, people, options) {
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el) throw new Error(`FamilyTree.render: container not found (${target})`);
  if (!Array.isArray(people)) throw new Error("FamilyTree.render: people must be an array");
  injectStyles();
  return renderFamilyTree(el, people, options);
}

export { buildTree };
export const version = "1.0.0";
