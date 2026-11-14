// --- PORTAL DIVE (Entering the gate, travelling to a new world) ---
// Builds a self-contained "dimensional dive" page painted into the freshly-opened tab, which
// then redirects to the manhwa. The open + write happen inside the click gesture, so Safari's
// popup blocker (which kills a window.open deferred past the gesture) never trips — and the
// animation is actually seen, since focus follows the new tab. No inline <script> is used:
// the tab inherits the site CSP (script-src 'self'), which blocks inline scripts; the redirect
// is a <meta refresh>, and the ring/streak markup is pre-generated here (parent origin).
export const buildPortalLoader = (href: string, accent: string, accent2: string): string => {
    const rings = Array.from({ length: 12 }, (_, i) => `<div class="ring" style="animation-delay:${(i * 0.11).toFixed(2)}s"><svg viewBox="0 0 120 120" aria-hidden="true"><polygon points="60,6 111,36 111,84 60,114 9,84 9,36" fill="none" stroke="${accent}" stroke-width="1.4"/><polygon points="60,20 98,42 98,78 60,100 22,78 22,42" fill="none" stroke="${accent2}" stroke-width="0.7" opacity="0.5"/></svg></div>`).join('');
    const streaks = Array.from({ length: 26 }, (_, i) => `<div class="streak" style="--r:${Math.round((i * 360) / 26)}deg;animation-delay:${(Math.random() * 0.8).toFixed(2)}s"></div>`).join('');
    const metaUrl = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="2; url=${metaUrl}"><title>Akashic Link</title><style>
:root{--a:${accent};--b:${accent2}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;background:#030205}
.scene{position:fixed;inset:0;overflow:hidden;perspective:520px;perspective-origin:50% 47%;background:radial-gradient(circle at 50% 47%,#100b16 0%,#060409 55%,#030205 100%);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.space{position:absolute;inset:0;transform-style:preserve-3d}
.ring{position:absolute;left:50%;top:47%;width:340px;height:340px;margin:-170px 0 0 -170px;opacity:0;animation:fly 1.3s cubic-bezier(.55,0,.85,1) forwards}
.ring svg{width:100%;height:100%;display:block;filter:drop-shadow(0 0 6px var(--a))}
.streaks{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.streak{position:absolute;left:50%;top:47%;width:2px;height:60vh;transform-origin:top center;background:linear-gradient(to bottom,transparent,var(--b),#fff);opacity:0;animation:warp 1.1s cubic-bezier(.6,0,.9,1) forwards}
.core{position:absolute;left:50%;top:47%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:radial-gradient(circle,#fff 0%,var(--b) 34%,var(--a) 58%,transparent 80%);animation:core 2s cubic-bezier(.6,0,.85,1) forwards}
.cb{position:absolute;width:24px;height:24px;border-color:var(--a);opacity:0;animation:lock 2s ease-out forwards}
.cb.tl{top:22px;left:22px;border-top:2px solid;border-left:2px solid}
.cb.tr{top:22px;right:22px;border-top:2px solid;border-right:2px solid}
.cb.bl{bottom:22px;left:22px;border-bottom:2px solid;border-left:2px solid}
.cb.br{bottom:22px;right:22px;border-bottom:2px solid;border-right:2px solid}
.lock{position:absolute;left:50%;top:47%;transform:translate(-50%,-50%);opacity:0;animation:lockr 2s ease-out forwards;filter:drop-shadow(0 0 8px var(--a))}
.spin{transform-box:fill-box;transform-origin:center;animation:spin 3s linear infinite}
.cap{position:absolute;left:0;right:0;bottom:76px;text-align:center;font-size:11px;letter-spacing:.42em;color:var(--a);font-weight:700;opacity:0;text-shadow:0 0 12px var(--a);animation:cap 2s ease-out forwards}
.flash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 47%,#fff 0%,var(--b) 38%,transparent 74%);opacity:0;animation:flash 2s ease-in forwards}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fly{0%{transform:translateZ(-1600px) rotate(0);opacity:0}12%{opacity:.95}82%{opacity:.95}100%{transform:translateZ(360px) rotate(14deg);opacity:0}}
@keyframes warp{0%{transform:rotate(var(--r)) scaleY(0);opacity:0}25%{opacity:.9}100%{transform:rotate(var(--r)) scaleY(1);opacity:0}}
@keyframes core{0%{transform:scale(.2);opacity:.2}55%{transform:scale(3);opacity:.9}82%{transform:scale(26);opacity:1}95%{transform:scale(46);opacity:1}100%{transform:scale(46);opacity:1}}
@keyframes flash{0%,70%{opacity:0}88%{opacity:1}100%{opacity:1}}
@keyframes lock{0%{opacity:0;transform:scale(.7)}4%{opacity:1;transform:scale(1)}14%{opacity:1}22%{opacity:0;transform:scale(1.15)}100%{opacity:0}}
@keyframes lockr{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}5%{opacity:1;transform:translate(-50%,-50%) scale(1)}16%{opacity:.9}26%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}100%{opacity:0}}
@keyframes cap{0%,4%{opacity:0}10%{opacity:1;letter-spacing:.42em}30%{opacity:1}46%{opacity:0;letter-spacing:1.2em}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.ring,.streak,.core,.cb,.lock,.spin,.cap{animation:none}.flash{animation:none;opacity:1}}
</style></head><body><div class="scene"><div class="space">${rings}</div><div class="streaks">${streaks}</div><div class="core"></div><span class="cb tl"></span><span class="cb tr"></span><span class="cb bl"></span><span class="cb br"></span><div class="lock"><svg viewBox="0 0 120 120" width="150" height="150" aria-hidden="true"><g class="spin"><circle cx="60" cy="60" r="52" fill="none" stroke="${accent}" stroke-width="1" stroke-dasharray="2 6"/></g><polygon points="60,18 96.4,39 96.4,81 60,102 23.6,81 23.6,39" fill="none" stroke="${accent}" stroke-width="1.4"/></svg></div><div class="cap">ENTERING THE GATE</div><div class="flash"></div></div></body></html>`;
};
