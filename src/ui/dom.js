// Lumen Bandicoot — tiny DOM helpers shared by UI modules.
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}
export function h(tag, cls, parent, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (parent) parent.appendChild(e);
  return e;
}
/** Crash-style bubbly outlined text (stroke layer + gradient ::after layer). */
export function bigHTML(text, cls = '') {
  const t = esc(text);
  return `<span class="lb-big ${cls}" data-t="${t}">${t}</span>`;
}
export function setBig(el, text) {
  const s = String(text);
  if (el.textContent === s) return;
  el.textContent = s; el.dataset.t = s;
}
export function restartAnim(el, cls) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
}
/** Per-letter Crash logo spans with irregular tilt. */
export function logoHTML(word, seed = 1) {
  let s = seed;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return [...word].map((ch, i) => {
    if (ch === ' ') return '<span class="lb-logo-sp"> </span>';
    const rot = ((r() - 0.5) * 16).toFixed(1), dy = ((r() - 0.5) * 0.16).toFixed(3), sc = (0.92 + r() * 0.16).toFixed(2);
    return `<span class="lb-logo-l" style="--r:${rot}deg;--dy:${dy}em;--s:${sc};--i:${i}" data-t="${esc(ch)}">${esc(ch)}</span>`;
  }).join('');
}
