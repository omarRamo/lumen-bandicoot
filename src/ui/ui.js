// STUB — replaced by the UI team. Contract documented in docs/CONTRACTS.md (section UI).
export function createUI({ root, bus, save, worlds }) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:16px system-ui;color:#fff;';
  root.appendChild(el);
  const hudEl = document.createElement('div');
  hudEl.style.cssText = 'position:absolute;top:10px;left:10px;text-shadow:0 2px 4px #000';
  el.appendChild(hudEl);
  const st = { lights: 0, lives: 0, masks: 0, crates: '0/0' };
  const draw = () => { hudEl.textContent = `✨${st.lights}  ❤${st.lives}  🎭${st.masks}  📦${st.crates}`; };
  bus.on('hud:lights', (p) => { st.lights = p.value; draw(); });
  bus.on('hud:lives', (p) => { st.lives = p.value; draw(); });
  bus.on('hud:masks', (p) => { st.masks = p.value; draw(); });
  bus.on('hud:crates', (p) => { st.crates = `${p.broken}/${p.total}`; draw(); });
  const button = (text) => new Promise((res) => {
    const b = document.createElement('button');
    b.textContent = text; b.style.cssText = 'pointer-events:auto;position:absolute;inset:40% 35%;font-size:24px';
    b.onclick = () => { b.remove(); res(); };
    el.appendChild(b);
  });
  return {
    async title() { await button('LUMEN BANDICOOT — Jouer'); },
    async story() {},
    async map() { return { levelId: '1-1', timeTrial: false }; },
    hud: { show() { hudEl.style.display = ''; }, hide() { hudEl.style.display = 'none'; } },
    async pause() { return 'resume'; },
    async results() { await button('Continuer'); },
    async gameOver() { return 'continue'; },
    async powerUnlocked() {},
    loading() {},
    touch: { setVisible() {} },
  };
}
