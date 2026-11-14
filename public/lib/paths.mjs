// Resolve from the application directory, including GitHub Pages repository prefixes.
const base = new URL('../', import.meta.url);
export const appURL = resource => new URL(String(resource).replace(/^\/+/, ''), base).href;
