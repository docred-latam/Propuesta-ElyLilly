/*
 * sileo.js — port a JS/CSS puro de Sileo (https://sileo.aaryan.design), el toast
 * «gooey» de Aaryan (MIT). Sin dependencias. Reproduce el original v0.1.5:
 * misma geometría (350×40, radio 16), mismo filtro SVG que funde la cápsula con
 * el cuerpo, mismos springs (bounce .25 · 600 ms, resueltos como en motion),
 * mismos tiempos (6 s, autopilot 150 ms → 4 s, salida 600 ms), mismo swipe.
 *
 * Diferencias a propósito (ver sileo-referencia.md):
 *  - `sileo.mount(el, opts)` monta el contenedor DENTRO de un elemento (absolute),
 *    no en el viewport (fixed): el teléfono del prototipo está escalado con transform.
 *  - Los springs de los rectángulos SVG se integran en JS (motion no está).
 *  - Extras: `loading()`, `update()`, `id` para apilar, `action` como alias de
 *    `button`, primer argumento string, paleta `lilly`.
 */
(function () {
  'use strict';
  if (window.sileo && window.sileo.__vanilla) return;

  /* ------------------------------ Constantes ------------------------------ */
  // Idénticas a src/constants.ts de Sileo.
  var HEIGHT = 40, WIDTH = 350, DEFAULT_ROUNDNESS = 16;
  var DURATION_MS = 600;
  var DEFAULT_TOAST_DURATION = 6000;
  var EXIT_DURATION = DEFAULT_TOAST_DURATION * 0.1;          // 600
  var AUTO_EXPAND_DELAY = DEFAULT_TOAST_DURATION * 0.025;    // 150
  var AUTO_COLLAPSE_DELAY = DEFAULT_TOAST_DURATION - 2000;   // 4000
  var BLUR_RATIO = 0.5, PILL_PADDING = 10, MIN_EXPAND_RATIO = 2.25;
  var SWAP_COLLAPSE_MS = 200, HEADER_EXIT_MS = DURATION_MS * 0.7;
  var SWIPE_DISMISS = 30, SWIPE_MAX = 20;
  var THEME_FILLS = { light: '#1a1a1a', dark: '#f2f2f2' };
  var POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  /* ------------------------------ Springs ------------------------------ */
  // Port de motion: `findSpring` convierte { duration, bounce } en stiffness/damping
  // buscando la frecuencia con Newton; luego la posición se resuelve en forma cerrada.
  function findSpring(durationMs, bounce) {
    var safeMin = 0.001, velocity = 0, mass = 1;
    var z = Math.min(1, Math.max(0.05, 1 - bounce));
    var d = Math.min(10, Math.max(0.01, durationMs / 1000));
    var envelope, derivative;
    if (z < 1) {
      envelope = function (f) { var ed = f * z, delta = ed * d; return safeMin - ((ed - velocity) / (f * Math.sqrt(1 - z * z))) * Math.exp(-delta); };
      derivative = function (f) {
        var ed = f * z, delta = ed * d, dd = delta * velocity + velocity, e = z * z * f * f * d, ex = Math.exp(-delta);
        var g = (f * f) * Math.sqrt(1 - z * z);
        var factor = -envelope(f) + safeMin > 0 ? -1 : 1;
        return (factor * ((dd - e) * ex)) / g;
      };
    } else {
      envelope = function (f) { return -safeMin + Math.exp(-f * d) * ((f - velocity) * d + 1); };
      derivative = function (f) { return Math.exp(-f * d) * ((velocity - f) * (d * d)); };
    }
    var f0 = 5 / d;
    for (var i = 1; i < 12; i++) f0 = f0 - envelope(f0) / derivative(f0);
    if (isNaN(f0)) return { stiffness: 100, damping: 10 };
    var stiffness = f0 * f0 * mass;
    return { stiffness: stiffness, damping: z * 2 * Math.sqrt(mass * stiffness) };
  }
  var SPRING = findSpring(DURATION_MS, 0.25);   // { type: 'spring', bounce: .25, duration: .6 }
  var SPRING_FLAT = findSpring(DURATION_MS, 0); // { ...SPRING, bounce: 0 } al cerrar el cuerpo

  // Un valor numérico animado por spring; conserva la velocidad si lo interrumpen.
  function Anim(value, apply) { this.value = value; this.apply = apply; this.raf = 0; this.v = 0; apply(value); }
  Anim.prototype.set = function (to) {
    cancelAnimationFrame(this.raf); this.raf = 0; this.value = to; this.v = 0; this.apply(to);
  };
  Anim.prototype.to = function (target, spring) {
    if (reduced.matches || !spring) return this.set(target);
    cancelAnimationFrame(this.raf);
    var origin = this.value, d0 = target - origin, vd0 = -this.v;
    if (Math.abs(d0) < 0.01 && Math.abs(this.v) < 0.001) return this.set(target);
    var z = spring.damping / (2 * Math.sqrt(spring.stiffness)), w0 = Math.sqrt(spring.stiffness) / 1000, fn;
    if (z < 1) {
      var wd = w0 * Math.sqrt(1 - z * z);
      fn = function (t) { return target - Math.exp(-z * w0 * t) * (d0 * Math.cos(wd * t) + ((vd0 + z * w0 * d0) / wd) * Math.sin(wd * t)); };
    } else {
      fn = function (t) { return target - Math.exp(-w0 * t) * (d0 + (vd0 + w0 * d0) * t); };
    }
    // t nunca es negativo: el timestamp del rAF puede ser anterior a performance.now()
    // y un t < 0 dispararía la exponencial (cuerpo gigante).
    var self = this, start = performance.now(), last = origin, lastT = 0;
    var step = function (now) {
      var t = Math.max(0, now - start), x = fn(t);
      self.v = (x - last) / Math.max(1, t - lastT); last = x; lastT = t;
      self.value = x; self.apply(x);
      if (Math.abs(target - x) < 0.05 && Math.abs(self.v) < 0.005) { self.set(target); return; }
      self.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  };

  /* ------------------------------ Iconos ------------------------------ */
  // Los mismos seis de lucide que usa Sileo (16 px, trazo 2).
  function icon(title, paths, extra) {
    return '<svg ' + (extra || '') + ' xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>' + title + '</title>' + paths + '</svg>';
  }
  var STATE_ICON = {
    success: icon('Check', '<path d="M20 6 9 17l-5-5"/>'),
    loading: icon('Loader Circle', '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', 'data-sileo-icon="spin" aria-hidden="true"'),
    error: icon('X', '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    warning: icon('Circle Alert', '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'),
    info: icon('Life Buoy', '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/>'),
    action: icon('Arrow Right', '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
  };

  /* ------------------------------ CSS ------------------------------ */
  // styles.css de Sileo, con tres cambios: el viewport es `absolute` dentro del
  // contenedor montado, `box-sizing: border-box` (Sileo lo hereda del preflight de
  // Tailwind) y la paleta `lilly`. Se quita `content-visibility` porque medir el
  // contenido oculto dispara un aviso de consola en Chrome.
  var CSS = [
    ':root{--sileo-spring-easing:linear(0,0.002 0.6%,0.007 1.2%,0.015 1.8%,0.026 2.4%,0.041 3.1%,0.06 3.8%,0.108 5.3%,0.157 6.6%,0.214 8%,0.467 13.7%,0.577 16.3%,0.631 17.7%,0.682 19.1%,0.73 20.5%,0.771 21.8%,0.808 23.1%,0.844 24.5%,0.874 25.8%,0.903 27.2%,0.928 28.6%,0.952 30.1%,0.972 31.6%,0.988 33.1%,1.01 35.7%,1.025 38.5%,1.034 41.6%,1.038 45%,1.035 50.1%,1.012 64.2%,1.003 73%,0.999 83.7%,1);',
    '--sileo-duration:600ms;--sileo-height:40px;--sileo-width:350px;',
    '--sileo-state-success:oklch(0.723 0.219 142.136);--sileo-state-loading:oklch(0.556 0 0);--sileo-state-error:oklch(0.637 0.237 25.331);--sileo-state-warning:oklch(0.795 0.184 86.047);--sileo-state-info:oklch(0.685 0.169 237.323);--sileo-state-action:oklch(0.623 0.214 259.815);}',
    // Paleta Lilly: verde iOS, rojo y azul Lilly, ámbar. Solo cambia los tonos de estado.
    '[data-sileo-viewport][data-palette="lilly"]{--sileo-state-success:#34C759;--sileo-state-error:#D52B1E;--sileo-state-warning:#FF9F0A;--sileo-state-info:#1F5FA8;--sileo-state-action:#1F5FA8;--sileo-state-loading:#8E8E93;}',
    '[data-sileo-viewport],[data-sileo-viewport] *{box-sizing:border-box;}',
    '[data-sileo-toast]{position:relative;cursor:pointer;pointer-events:auto;touch-action:none;border:0;background:transparent;padding:0;margin:0;font-family:inherit;width:var(--sileo-width);height:var(--_h,var(--sileo-height));opacity:0;transform:translateZ(0) scale(0.95);transform-origin:center;contain:layout style;overflow:visible;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;}',
    '[data-sileo-toast]:focus{outline:none;}',
    '[data-sileo-toast][data-state="loading"]{cursor:default;}',
    '[data-sileo-toast][data-ready="true"]{opacity:1;transform:translateZ(0) scale(1);transition:transform calc(var(--sileo-duration)*0.66) var(--sileo-spring-easing),opacity calc(var(--sileo-duration)*0.66) var(--sileo-spring-easing),margin-bottom calc(var(--sileo-duration)*0.66) var(--sileo-spring-easing),margin-top calc(var(--sileo-duration)*0.66) var(--sileo-spring-easing),height var(--sileo-duration) var(--sileo-spring-easing);}',
    '[data-sileo-viewport][data-position^="top"] [data-sileo-toast]:not([data-ready="true"]){transform:translateY(-6px) scale(0.95);}',
    '[data-sileo-viewport][data-position^="bottom"] [data-sileo-toast]:not([data-ready="true"]){transform:translateY(6px) scale(0.95);}',
    '[data-sileo-toast][data-ready="true"][data-exiting="true"]{opacity:0;pointer-events:none;}',
    '[data-sileo-viewport][data-position^="top"] [data-sileo-toast][data-ready="true"][data-exiting="true"]{transform:translateY(-6px) scale(0.95);}',
    '[data-sileo-viewport][data-position^="bottom"] [data-sileo-toast][data-ready="true"][data-exiting="true"]{transform:translateY(6px) scale(0.95);}',
    '[data-sileo-canvas]{position:absolute;left:0;right:0;pointer-events:none;transform:translateZ(0);contain:layout style;overflow:visible;}',
    '[data-sileo-canvas][data-edge="top"]{bottom:0;transform:scaleY(-1) translateZ(0);}',
    '[data-sileo-canvas][data-edge="bottom"]{top:0;}',
    '[data-sileo-svg]{overflow:visible;display:block;}',
    '[data-sileo-header]{position:absolute;z-index:20;display:flex;align-items:center;padding:0.5rem;height:var(--sileo-height);overflow:hidden;left:var(--_px,0px);transform:var(--_ht);max-width:var(--_pw);}',
    '[data-sileo-toast][data-ready="true"] [data-sileo-header]{transition:transform var(--sileo-duration) var(--sileo-spring-easing),left var(--sileo-duration) var(--sileo-spring-easing),max-width var(--sileo-duration) var(--sileo-spring-easing);}',
    '[data-sileo-header][data-edge="top"]{bottom:0;}',
    '[data-sileo-header][data-edge="bottom"]{top:0;}',
    '[data-sileo-header-stack]{position:relative;display:inline-flex;align-items:center;height:100%;}',
    '[data-sileo-header-inner]{display:flex;align-items:center;gap:0.5rem;white-space:nowrap;opacity:1;filter:blur(0px);transform:translateZ(0);}',
    '[data-sileo-header-inner][data-layer="current"]{position:relative;z-index:1;animation:sileo-header-enter var(--sileo-duration) var(--sileo-spring-easing) both;}',
    '[data-sileo-header-inner][data-layer="current"]:not(:only-child),[data-sileo-header-inner][data-exiting="true"]{will-change:opacity,filter;}',
    '[data-sileo-header-inner][data-layer="prev"]{position:absolute;left:0;top:0;z-index:0;pointer-events:none;}',
    '[data-sileo-header-inner][data-exiting="true"]{animation:sileo-header-exit calc(var(--sileo-duration)*0.7) ease forwards;}',
    '[data-sileo-badge]{display:flex;height:24px;width:24px;flex-shrink:0;align-items:center;justify-content:center;padding:2px;box-sizing:border-box;border-radius:9999px;color:var(--sileo-tone,currentColor);background-color:var(--sileo-tone-bg,transparent);}',
    '[data-sileo-badge] svg{display:block;}',
    '[data-sileo-title]{font-size:0.825rem;line-height:1rem;font-weight:500;text-transform:capitalize;color:var(--sileo-tone,currentColor);}',
    ':is([data-sileo-badge],[data-sileo-title],[data-sileo-button])[data-state]{--_c:var(--sileo-state-success);}',
    ':is([data-sileo-badge],[data-sileo-title],[data-sileo-button])[data-state="loading"]{--_c:var(--sileo-state-loading);}',
    ':is([data-sileo-badge],[data-sileo-title],[data-sileo-button])[data-state="error"]{--_c:var(--sileo-state-error);}',
    ':is([data-sileo-badge],[data-sileo-title],[data-sileo-button])[data-state="warning"]{--_c:var(--sileo-state-warning);}',
    ':is([data-sileo-badge],[data-sileo-title],[data-sileo-button])[data-state="info"]{--_c:var(--sileo-state-info);}',
    ':is([data-sileo-badge],[data-sileo-title],[data-sileo-button])[data-state="action"]{--_c:var(--sileo-state-action);}',
    ':is([data-sileo-badge],[data-sileo-title])[data-state]{--sileo-tone:var(--_c);--sileo-tone-bg:color-mix(in oklch,var(--_c) 20%,transparent);}',
    '[data-sileo-content]{position:absolute;left:0;z-index:10;width:100%;pointer-events:none;opacity:var(--_co,0);}',
    '[data-sileo-content]:not([data-visible="true"]){visibility:hidden;}',
    '[data-sileo-toast][data-ready="true"] [data-sileo-content]{transition:opacity calc(var(--sileo-duration)*0.08) ease calc(var(--sileo-duration)*0.04),visibility 0s linear calc(var(--sileo-duration)*0.12);}',
    '[data-sileo-content][data-edge="top"]{top:0;}',
    '[data-sileo-content][data-edge="bottom"]{top:var(--sileo-height);}',
    '[data-sileo-content][data-visible="true"]{pointer-events:auto;}',
    '[data-sileo-toast][data-ready="true"] [data-sileo-content][data-visible="true"]{transition:opacity calc(var(--sileo-duration)*0.6) ease calc(var(--sileo-duration)*0.3),visibility 0s;}',
    '[data-sileo-description]{width:100%;text-align:left;padding:1rem;font-size:0.875rem;line-height:1.25rem;contain:layout style paint;}',
    '[data-sileo-button]{display:flex;align-items:center;justify-content:center;width:max-content;height:1.75rem;padding:0 0.625rem;margin-top:0.75rem;border-radius:9999px;border:0;font-size:0.75rem;font-weight:500;cursor:pointer;text-decoration:none;color:var(--sileo-btn-color,currentColor);background-color:var(--sileo-btn-bg,transparent);transition:background-color 150ms ease;}',
    '[data-sileo-button]:hover{background-color:var(--sileo-btn-bg-hover,transparent);}',
    '[data-sileo-button][data-state]{--sileo-btn-color:var(--_c);--sileo-btn-bg:color-mix(in oklch,var(--_c) 15%,transparent);--sileo-btn-bg-hover:color-mix(in oklch,var(--_c) 25%,transparent);}',
    '[data-sileo-icon="spin"]{animation:sileo-spin 1s linear infinite;}',
    '@keyframes sileo-spin{to{transform:rotate(360deg);}}',
    '@keyframes sileo-header-enter{from{opacity:0;filter:blur(6px);}to{opacity:1;filter:blur(0px);}}',
    '@keyframes sileo-header-exit{from{opacity:1;filter:blur(0px);}to{opacity:0;filter:blur(6px);}}',
    // Viewport: absoluto dentro del contenedor montado (no fixed: el teléfono va escalado).
    '[data-sileo-viewport]{position:absolute;z-index:50;display:flex;gap:0.75rem;padding:0.75rem;pointer-events:none;max-width:calc(100% - 1.5rem);contain:layout style;}',
    '[data-sileo-viewport][data-position^="top"] [data-sileo-toast]:not([data-ready="true"]){margin-bottom:calc(-1*(var(--sileo-height) + 0.75rem));}',
    '[data-sileo-viewport][data-position^="bottom"] [data-sileo-toast]:not([data-ready="true"]){margin-top:calc(-1*(var(--sileo-height) + 0.75rem));}',
    '[data-sileo-viewport][data-position^="top"]{top:0;flex-direction:column-reverse;}',
    '[data-sileo-viewport][data-position^="bottom"]{bottom:0;flex-direction:column;}',
    '[data-sileo-viewport][data-position$="left"]{left:0;align-items:flex-start;}',
    '[data-sileo-viewport][data-position$="right"]{right:0;align-items:flex-end;}',
    '[data-sileo-viewport][data-position$="center"]{left:50%;transform:translateX(-50%);align-items:center;}',
    '@media (prefers-reduced-motion:no-preference){[data-sileo-toast][data-ready="true"]:hover,[data-sileo-toast][data-ready="true"][data-exiting="true"]{will-change:transform,opacity,height;}}',
    '@media (prefers-reduced-motion:reduce){[data-sileo-viewport],[data-sileo-viewport] *,[data-sileo-viewport] *::before,[data-sileo-viewport] *::after{animation-duration:0.01ms;animation-iteration-count:1;transition-duration:0.01ms;}}',
    '[data-sileo-viewport][data-theme="dark"] [data-sileo-description]{color:rgba(0,0,0,0.5);}',
    '[data-sileo-viewport][data-theme="light"] [data-sileo-description]{color:rgba(255,255,255,0.5);}',
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('sileo-css')) return;
    var style = document.createElement('style');
    style.id = 'sileo-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  /* ------------------------------ Utilidades ------------------------------ */
  var idCounter = 0;
  function generateId() { return (++idCounter) + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function timeoutKey(t) { return t.id + ':' + t.instanceId; }
  function pillAlign(pos) { return pos.indexOf('right') >= 0 ? 'right' : pos.indexOf('center') >= 0 ? 'center' : 'left'; }
  function expandDir(pos) { return pos.indexOf('top') === 0 ? 'bottom' : 'top'; }
  function el(tag, attrs) {
    var n = document.createElement(tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  function fillNode(target, content) {
    while (target.firstChild) target.removeChild(target.firstChild);
    if (content == null) return;
    if (typeof content === 'string') target.appendChild(document.createTextNode(content));
    else if (content.nodeType) target.appendChild(content);
    else if (content.html != null) target.innerHTML = content.html;
  }
  function setClass(node, cls) { node.className = cls || ''; }

  /* ------------------------------ Estado global ------------------------------ */
  var store = {
    toasts: [], listeners: [], position: 'top-right', options: undefined,
    emit: function () { for (var i = 0; i < this.listeners.length; i++) this.listeners[i](this.toasts); },
    update: function (fn) { this.toasts = fn(this.toasts); this.emit(); },
  };

  function dismissToast(id) {
    var item = null;
    for (var i = 0; i < store.toasts.length; i++) if (store.toasts[i].id === id) item = store.toasts[i];
    if (!item || item.exiting) return;
    store.update(function (prev) { return prev.map(function (t) { return t.id === id ? Object.assign({}, t, { exiting: true }) : t; }); });
    setTimeout(function () { store.update(function (prev) { return prev.filter(function (t) { return t.id !== id; }); }); }, EXIT_DURATION);
  }

  function resolveAutopilot(opts, duration) {
    if (opts.autopilot === false || !duration || duration <= 0) return {};
    var cfg = typeof opts.autopilot === 'object' ? opts.autopilot : undefined;
    var clamp = function (v) { return Math.min(duration, Math.max(0, v)); };
    return {
      expandDelayMs: clamp(cfg && cfg.expand != null ? cfg.expand : AUTO_EXPAND_DELAY),
      collapseDelayMs: clamp(cfg && cfg.collapse != null ? cfg.collapse : AUTO_COLLAPSE_DELAY),
    };
  }

  // Normaliza las extensiones del port: primer argumento string y `action` como alias de `button`.
  function normalize(titleOrOpts, opts) {
    var o = typeof titleOrOpts === 'string' ? Object.assign({ title: titleOrOpts }, opts || {}) : Object.assign({}, titleOrOpts || {});
    if (!o.button && o.action) o.button = { title: o.action.label || o.action.title, onClick: o.action.onClick || function () {} };
    delete o.action;
    return o;
  }

  function mergeOptions(options) {
    var base = store.options || {};
    return Object.assign({}, base, options, { styles: Object.assign({}, base.styles, options.styles) });
  }

  function buildSileoItem(merged, id, fallbackPosition) {
    var duration = merged.duration === undefined ? DEFAULT_TOAST_DURATION : merged.duration;
    var auto = resolveAutopilot(merged, duration);
    return Object.assign({}, merged, {
      id: id, instanceId: generateId(),
      position: merged.position || fallbackPosition || store.position,
      autoExpandDelayMs: auto.expandDelayMs, autoCollapseDelayMs: auto.collapseDelayMs,
    });
  }

  // Igual que Sileo: sin `id`, todos comparten "sileo-default" y el nuevo REEMPLAZA al vivo (morph).
  function createToast(options) {
    var merged = mergeOptions(options);
    var id = merged.id || 'sileo-default';
    var prev = null;
    for (var i = 0; i < store.toasts.length; i++) if (!store.toasts[i].exiting && store.toasts[i].id === id) prev = store.toasts[i];
    var item = buildSileoItem(merged, id, prev && prev.position);
    if (prev) store.update(function (p) { return p.map(function (t) { return t.id === id ? item : t; }); });
    else store.update(function (p) { return p.filter(function (t) { return t.id !== id; }).concat([item]); });
    ensureMounted();
    return { id: id, duration: merged.duration === undefined ? DEFAULT_TOAST_DURATION : merged.duration };
  }

  function updateToast(id, options) {
    var existing = null;
    for (var i = 0; i < store.toasts.length; i++) if (store.toasts[i].id === id) existing = store.toasts[i];
    if (!existing) return;
    var item = buildSileoItem(mergeOptions(options), id, existing.position);
    store.update(function (prev) { return prev.map(function (t) { return t.id === id ? item : t; }); });
  }

  /* ------------------------------ Toast (Sileo.tsx) ------------------------------ */
  function Toast(id, toaster) {
    var self = this;
    this.id = id; this.toaster = toaster;
    this.filterId = 'sileo-gooey-' + id.replace(/[^a-zA-Z0-9_-]/g, '');
    this.view = null; this.applied = undefined; this.lastRefreshKey = undefined; this.pending = null;
    this.expanded = false; this.ready = false; this.pillWidth = 0; this.contentHeight = 0; this.frozenExpanded = 0;
    this.headerKey = null; this.props = {}; this.prevDeps = null; this.wasOpen = false;
    this.timers = { headerExit: 0, autoExpand: 0, autoCollapse: 0, swap: 0 };
    this.pointerStart = null; this.pointerScale = 1;

    // DOM: exactamente la estructura del componente React.
    var root = this.el = el('button', { type: 'button', 'data-sileo-toast': '', 'data-ready': 'false', 'data-expanded': 'false', 'data-exiting': 'false' });
    var canvas = this.canvas = el('div', { 'data-sileo-canvas': '' });
    canvas.style.filter = 'url(#' + this.filterId + ')';
    var svg = this.svg = svgEl('svg', { 'data-sileo-svg': '', width: WIDTH, height: HEIGHT, viewBox: '0 0 ' + WIDTH + ' ' + HEIGHT });
    var title = svgEl('title'); title.textContent = 'Sileo Notification'; svg.appendChild(title);
    var defs = svgEl('defs');
    var filter = svgEl('filter', { id: this.filterId, x: '-20%', y: '-20%', width: '140%', height: '140%', 'color-interpolation-filters': 'sRGB' });
    this.blurNode = svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: DEFAULT_ROUNDNESS * BLUR_RATIO, result: 'blur' });
    filter.appendChild(this.blurNode);
    filter.appendChild(svgEl('feColorMatrix', { in: 'blur', mode: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10', result: 'goo' }));
    filter.appendChild(svgEl('feComposite', { in: 'SourceGraphic', in2: 'goo', operator: 'atop' }));
    defs.appendChild(filter); svg.appendChild(defs);
    this.pill = svgEl('rect', { 'data-sileo-pill': '', rx: DEFAULT_ROUNDNESS, ry: DEFAULT_ROUNDNESS, x: 0, y: 0, width: HEIGHT, height: HEIGHT });
    this.body = svgEl('rect', { 'data-sileo-body': '', y: HEIGHT, width: WIDTH, height: 0, rx: DEFAULT_ROUNDNESS, ry: DEFAULT_ROUNDNESS, opacity: 0 });
    svg.appendChild(this.pill); svg.appendChild(this.body); canvas.appendChild(svg); root.appendChild(canvas);

    this.header = el('div', { 'data-sileo-header': '' });
    this.stack = el('div', { 'data-sileo-header-stack': '' });
    this.header.appendChild(this.stack); root.appendChild(this.header);
    this.content = null; this.desc = null; this.inner = null;

    // Springs de los rectángulos (motion.rect animate={...}).
    this.aPillX = new Anim(0, function (v) { self.pill.setAttribute('x', v); });
    this.aPillW = new Anim(HEIGHT, function (v) { self.pill.setAttribute('width', Math.max(0, v)); });
    this.aPillH = new Anim(HEIGHT, function (v) { self.pill.setAttribute('height', Math.max(0, v)); });
    this.aBodyH = new Anim(0, function (v) { self.body.setAttribute('height', Math.max(0, v)); });
    this.aBodyO = new Anim(0, function (v) { self.body.setAttribute('opacity', Math.min(1, Math.max(0, v))); });

    root.addEventListener('mouseenter', function (e) { self.toaster.onEnter(self.id, e); if (self.hasDesc()) self.setExpanded(true); });
    root.addEventListener('mouseleave', function (e) { self.toaster.onLeave(self.id, e); self.setExpanded(false); });
    root.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'height' && e.propertyName !== 'transform') return;
      if (self.isOpen() || !self.pending) return;
      clearTimeout(self.timers.swap); self.timers.swap = 0;
      var p = self.pending; self.pending = null; self.applyView(p.payload, p.key);
    });
    root.addEventListener('pointerdown', function (e) { self.onPointerDown(e); });
    root.addEventListener('pointermove', function (e) { self.onPointerMove(e); });
    root.addEventListener('pointerup', function (e) { self.onPointerUp(e); });
    root.addEventListener('pointercancel', function (e) { self.onPointerUp(e); });

    this.ro = new ResizeObserver(function () { self.measure(); self.render(); });
  }

  Toast.prototype.hasDesc = function () { return !!(this.view && (this.view.description || this.view.button)); };
  Toast.prototype.isLoading = function () { return this.view && this.view.state === 'loading'; };
  Toast.prototype.isOpen = function () { return this.hasDesc() && this.expanded && !this.isLoading(); };
  Toast.prototype.allowExpand = function () {
    if (this.isLoading()) return false;
    return this.props.canExpand !== undefined ? this.props.canExpand : true;
  };

  Toast.prototype.setExpanded = function (b) { if (this.expanded === b) return; this.expanded = b; this.render(); };

  // Props que le pasa el Toaster (equivalen a las props del componente React).
  Toast.prototype.setProps = function (props) {
    this.props = props;
    var next = { title: props.title != null ? props.title : props.state, description: props.description, state: props.state || 'success', icon: props.icon, styles: props.styles, button: props.button, fill: props.fill };
    if (!this.view) { this.applyView(next, props.refreshKey); this.lastRefreshKey = props.refreshKey; }
    else if (props.refreshKey !== this.lastRefreshKey) {
      this.lastRefreshKey = props.refreshKey;
      clearTimeout(this.timers.swap); this.timers.swap = 0;
      if (this.isOpen()) {
        // Está abierto: se cierra primero y el cambio de contenido se aplica al terminar (o a los 200 ms).
        var self = this; this.pending = { key: props.refreshKey, payload: next };
        this.setExpanded(false);
        this.timers.swap = setTimeout(function () { self.timers.swap = 0; var p = self.pending; if (!p) return; self.pending = null; self.applyView(p.payload, p.key); }, SWAP_COLLAPSE_MS);
      } else { this.pending = null; this.applyView(next, props.refreshKey); }
    } else if (this.view.fill !== props.fill) { this.view.fill = props.fill; this.pill.setAttribute('fill', props.fill); this.body.setAttribute('fill', props.fill); }
    this.runAutopilot();
    this.render();
  };

  Toast.prototype.buildInner = function (view, layer) {
    var inner = el('div', { 'data-sileo-header-inner': '', 'data-layer': layer });
    var badge = el('div', { 'data-sileo-badge': '', 'data-state': view.state }); setClass(badge, view.styles && view.styles.badge);
    if (view.icon != null) fillNode(badge, typeof view.icon === 'string' ? { html: view.icon } : view.icon); else badge.innerHTML = STATE_ICON[view.state] || STATE_ICON.success;
    var t = el('span', { 'data-sileo-title': '', 'data-state': view.state }); setClass(t, view.styles && view.styles.title); t.textContent = view.title;
    inner.appendChild(badge); inner.appendChild(t);
    return inner;
  };

  Toast.prototype.applyView = function (view, key) {
    var self = this;
    this.view = view; this.applied = key;
    var headerKey = view.state + '-' + view.title;
    this.el.setAttribute('data-state', view.state);
    this.pill.setAttribute('fill', view.fill); this.body.setAttribute('fill', view.fill);
    var roundness = Math.max(0, this.props.roundness != null ? this.props.roundness : DEFAULT_ROUNDNESS);
    this.roundness = roundness; this.blur = roundness * BLUR_RATIO;
    this.pill.setAttribute('rx', roundness); this.pill.setAttribute('ry', roundness);
    this.body.setAttribute('rx', roundness); this.body.setAttribute('ry', roundness);
    this.blurNode.setAttribute('stdDeviation', this.blur);

    if (headerKey !== this.headerKey) {
      // Cabecera nueva entra desenfocándose; la anterior sale con blur 420 ms (capas current/prev).
      var old = this.inner;
      var prevLayer = this.stack.querySelector('[data-layer="prev"]'); if (prevLayer) prevLayer.remove();
      if (old) { old.setAttribute('data-layer', 'prev'); old.setAttribute('data-exiting', 'true'); this.ro.unobserve(old); }
      this.inner = this.buildInner(view, 'current');
      this.stack.insertBefore(this.inner, this.stack.firstChild);
      this.ro.observe(this.inner);
      clearTimeout(this.timers.headerExit);
      if (old) this.timers.headerExit = setTimeout(function () { self.timers.headerExit = 0; if (old.parentNode) old.remove(); }, HEADER_EXIT_MS);
      this.headerKey = headerKey;
    } else {
      // Misma clave: se actualizan icono/estilos sin animar.
      var badge = this.inner.firstChild, t = this.inner.lastChild;
      setClass(badge, view.styles && view.styles.badge); setClass(t, view.styles && view.styles.title);
      if (view.icon != null) fillNode(badge, typeof view.icon === 'string' ? { html: view.icon } : view.icon); else badge.innerHTML = STATE_ICON[view.state] || STATE_ICON.success;
    }

    // Contenido (descripción + botón).
    if (this.hasDesc()) {
      if (!this.content) {
        this.content = el('div', { 'data-sileo-content': '', 'data-visible': 'false' });
        this.desc = el('div', { 'data-sileo-description': '' });
        this.content.appendChild(this.desc); this.el.appendChild(this.content);
        this.ro.observe(this.desc);
      }
      setClass(this.desc, view.styles && view.styles.description);
      fillNode(this.desc, view.description);
      if (view.button) {
        var a = el('a', { href: '#', 'data-sileo-button': '', 'data-state': view.state }); setClass(a, view.styles && view.styles.button);
        a.textContent = view.button.title;
        a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (view.button.onClick) view.button.onClick(); });
        a.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        this.desc.appendChild(a);
      }
    } else if (this.content) { this.ro.unobserve(this.desc); this.content.remove(); this.content = null; this.desc = null; this.contentHeight = 0; }

    this.measure();
    this.runAutopilot();
    this.render();
  };

  Toast.prototype.measure = function () {
    if (!this.inner || !this.el.isConnected) return;
    if (this.headerPad == null) { var cs = getComputedStyle(this.header); this.headerPad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); }
    var w = this.inner.scrollWidth + this.headerPad + PILL_PADDING;
    if (w > PILL_PADDING) this.pillWidth = w;
    this.contentHeight = this.desc ? this.desc.scrollHeight : 0;
  };

  // useEffect de autopilot: se re-ejecuta solo cuando cambian sus dependencias.
  Toast.prototype.runAutopilot = function () {
    var deps = [this.hasDesc(), this.allowExpand(), !!this.props.exiting, this.applied, this.props.autoExpandDelayMs, this.props.autoCollapseDelayMs].join('|');
    if (deps === this.prevDeps) return;
    this.prevDeps = deps;
    clearTimeout(this.timers.autoExpand); clearTimeout(this.timers.autoCollapse);
    if (!this.hasDesc()) return;
    if (this.props.exiting || !this.allowExpand()) { this.setExpanded(false); return; }
    var ex = this.props.autoExpandDelayMs, co = this.props.autoCollapseDelayMs;
    if (ex == null && co == null) return;
    var self = this, expandDelay = ex || 0, collapseDelay = co || 0;
    if (expandDelay > 0) this.timers.autoExpand = setTimeout(function () { self.setExpanded(true); }, expandDelay); else this.setExpanded(true);
    if (collapseDelay > 0) this.timers.autoCollapse = setTimeout(function () { self.setExpanded(false); }, collapseDelay);
  };

  Toast.prototype.render = function () {
    if (!this.view) return;
    var open = this.isOpen(), hasDesc = this.hasDesc(), expand = this.props.expand || 'bottom', position = this.props.position || 'left';
    var minExpanded = HEIGHT * MIN_EXPAND_RATIO;
    var rawExpanded = hasDesc ? Math.max(minExpanded, HEIGHT + this.contentHeight) : minExpanded;
    if (open) this.frozenExpanded = rawExpanded;
    var expanded = open ? rawExpanded : (this.frozenExpanded || rawExpanded);
    var svgHeight = hasDesc ? Math.max(expanded, minExpanded) : HEIGHT;
    var expandedContent = Math.max(0, expanded - HEIGHT);
    var pillW = Math.max(this.pillWidth || HEIGHT, HEIGHT);
    var pillHeight = HEIGHT + this.blur * 3;
    var pillX = position === 'right' ? WIDTH - pillW : position === 'center' ? (WIDTH - pillW) / 2 : 0;

    var s = this.el.style;
    s.setProperty('--_h', (open ? expanded : HEIGHT) + 'px');
    s.setProperty('--_pw', pillW + 'px');
    s.setProperty('--_px', pillX + 'px');
    s.setProperty('--_ht', 'translateY(' + (open ? (expand === 'bottom' ? 3 : -3) : 0) + 'px) scale(' + (open ? 0.9 : 1) + ')');
    s.setProperty('--_co', open ? '1' : '0');
    this.el.setAttribute('data-expanded', open ? 'true' : 'false');
    this.el.setAttribute('data-exiting', this.props.exiting ? 'true' : 'false');
    this.el.setAttribute('data-edge', expand); this.el.setAttribute('data-position', position);
    this.canvas.setAttribute('data-edge', expand); this.header.setAttribute('data-edge', expand);
    if (this.content) { this.content.setAttribute('data-edge', expand); this.content.setAttribute('data-visible', open ? 'true' : 'false'); }

    this.svg.setAttribute('height', svgHeight); this.svg.setAttribute('viewBox', '0 0 ' + WIDTH + ' ' + svgHeight);
    var pillSpring = this.ready ? SPRING : null; // antes del primer frame, sin animación ({ duration: 0 })
    this.aPillX.to(pillX, pillSpring); this.aPillW.to(pillW, pillSpring); this.aPillH.to(open ? pillHeight : HEIGHT, pillSpring);
    var bodySpring = open ? SPRING : SPRING_FLAT;
    this.aBodyH.to(open ? expandedContent : 0, this.ready ? bodySpring : null);
    this.aBodyO.to(open ? 1 : 0, this.ready ? bodySpring : null);
  };

  Toast.prototype.markReady = function () {
    var self = this;
    var go = function () { if (self.ready || !self.el.isConnected) return; self.ready = true; self.el.setAttribute('data-ready', 'true'); };
    requestAnimationFrame(go);
    setTimeout(go, 50); // respaldo por si el rAF no llega (pestaña oculta, tiempo virtual)
  };

  // Swipe vertical: hasta 20 px de arrastre; más de 30 px de recorrido descarta.
  Toast.prototype.onPointerDown = function (e) {
    if (this.props.exiting) return;
    if (e.target.closest && e.target.closest('[data-sileo-button]')) return;
    var r = this.el.getBoundingClientRect();
    this.pointerScale = this.el.offsetWidth ? r.width / this.el.offsetWidth : 1; // el teléfono va escalado
    this.pointerStart = e.clientY;
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* sin captura no pasa nada */ }
  };
  Toast.prototype.onPointerMove = function (e) {
    if (this.pointerStart === null) return;
    var dy = (e.clientY - this.pointerStart) / this.pointerScale;
    var sign = dy > 0 ? 1 : -1;
    this.el.style.transform = 'translateY(' + (Math.min(Math.abs(dy), SWIPE_MAX) * sign) + 'px)';
  };
  Toast.prototype.onPointerUp = function (e) {
    if (this.pointerStart === null) return;
    var dy = (e.clientY - this.pointerStart) / this.pointerScale;
    this.pointerStart = null; this.el.style.transform = '';
    if (Math.abs(dy) > SWIPE_DISMISS) dismissToast(this.id);
  };

  Toast.prototype.destroy = function () {
    for (var k in this.timers) clearTimeout(this.timers[k]);
    this.ro.disconnect();
    [this.aPillX, this.aPillW, this.aPillH, this.aBodyH, this.aBodyO].forEach(function (a) { cancelAnimationFrame(a.raf); });
    if (this.el.parentNode) this.el.remove();
  };

  /* ------------------------------ Toaster ------------------------------ */
  function Toaster(host, opts) {
    var self = this;
    opts = opts || {};
    this.host = host; this.theme = opts.theme; this.palette = opts.palette; this.offset = opts.offset;
    this.viewports = {}; this.toasts = {}; this.timers = {}; this.hover = false; this.activeId = undefined; this.latest = undefined;
    store.position = POSITIONS.indexOf(opts.position) >= 0 ? opts.position : 'top-right';
    store.options = opts.options;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    this.mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    this.onMq = function () { self.sync(store.toasts); };
    if (this.mq && this.theme === 'system') this.mq.addEventListener('change', this.onMq);
    this.listener = function (t) { self.sync(t); };
    store.listeners.push(this.listener);
    this.sync(store.toasts);
  }
  Toaster.prototype.resolvedTheme = function () {
    if (this.theme === 'light' || this.theme === 'dark') return this.theme;
    return this.mq && this.mq.matches ? 'dark' : 'light';
  };
  Toaster.prototype.viewport = function (pos) {
    if (this.viewports[pos]) return this.viewports[pos];
    var section = el('section', { 'data-sileo-viewport': '', 'data-position': pos, 'aria-live': 'polite' });
    if (this.theme) section.setAttribute('data-theme', this.resolvedTheme());
    if (this.palette) section.setAttribute('data-palette', this.palette);
    var o = this.offset;
    if (o !== undefined) {
      if (typeof o !== 'object') o = { top: o, right: o, bottom: o, left: o };
      var px = function (v) { return typeof v === 'number' ? v + 'px' : v; };
      if (pos.indexOf('top') === 0 && o.top) section.style.top = px(o.top);
      if (pos.indexOf('bottom') === 0 && o.bottom) section.style.bottom = px(o.bottom);
      if (/left$/.test(pos) && o.left) section.style.left = px(o.left);
      if (/right$/.test(pos) && o.right) section.style.right = px(o.right);
    }
    this.host.appendChild(section);
    this.viewports[pos] = section;
    return section;
  };
  Toaster.prototype.clearAllTimers = function () { for (var k in this.timers) clearTimeout(this.timers[k]); this.timers = {}; };
  Toaster.prototype.schedule = function (items) {
    if (this.hover) return;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.exiting) continue;
      var key = timeoutKey(item);
      if (this.timers[key]) continue;
      if (item.duration === null) continue;
      var dur = item.duration === undefined ? DEFAULT_TOAST_DURATION : item.duration;
      if (dur <= 0) continue;
      this.timers[key] = setTimeout(function (id) { dismissToast(id); }.bind(null, item.id), dur);
    }
  };
  Toaster.prototype.onEnter = function (id) {
    this.activeId = id; this.pushProps();
    if (this.hover) return;
    this.hover = true; this.clearAllTimers();
  };
  Toaster.prototype.onLeave = function () {
    this.activeId = this.latest; this.pushProps();
    if (!this.hover) return;
    this.hover = false; this.schedule(store.toasts);
  };
  Toaster.prototype.pushProps = function () {
    var items = store.toasts, resolved = this.resolvedTheme();
    for (var i = 0; i < items.length; i++) {
      var item = items[i], t = this.toasts[item.id];
      if (!t) continue;
      var fill = item.fill || (this.theme ? THEME_FILLS[resolved] : '#FFFFFF');
      t.setProps(Object.assign({}, item, {
        position: pillAlign(item.position), expand: expandDir(item.position), fill: fill,
        refreshKey: item.instanceId, canExpand: this.activeId === undefined || this.activeId === item.id,
      }));
    }
  };
  Toaster.prototype.sync = function (items) {
    var self = this, seen = {};
    // Ids que ya no existen → fuera.
    for (var id in this.toasts) { if (!items.some(function (t) { return t.id === id; })) { this.toasts[id].destroy(); delete this.toasts[id]; } }
    // Timers huérfanos → fuera.
    var keys = {}; items.forEach(function (t) { keys[timeoutKey(t)] = true; });
    for (var k in this.timers) if (!keys[k]) { clearTimeout(this.timers[k]); delete this.timers[k]; }
    // Elementos por posición, en el orden del arreglo.
    for (var i = 0; i < items.length; i++) {
      var item = items[i], vp = this.viewport(item.position), t = this.toasts[item.id];
      if (t && t.el.parentNode !== vp) { t.destroy(); t = null; }
      var fresh = false;
      if (!t) { t = new Toast(item.id, this); this.toasts[item.id] = t; fresh = true; }
      var prevInVp = null;
      for (var j = i - 1; j >= 0; j--) if (items[j].position === item.position) { prevInVp = this.toasts[items[j].id]; break; }
      var expected = prevInVp ? prevInVp.el.nextSibling : vp.firstChild;
      if (t.el !== expected) vp.insertBefore(t.el, expected);
      if (fresh) t.markReady();
      seen[item.id] = true;
    }
    if (this.theme) for (var pos in this.viewports) this.viewports[pos].setAttribute('data-theme', this.resolvedTheme());
    var latest; for (var n = items.length - 1; n >= 0; n--) if (!items[n].exiting) { latest = items[n].id; break; }
    if (latest !== this.latest) { this.latest = latest; this.activeId = latest; }
    this.pushProps();
    this.schedule(items);
  };
  Toaster.prototype.destroy = function () {
    this.clearAllTimers();
    for (var id in this.toasts) this.toasts[id].destroy();
    for (var pos in this.viewports) this.viewports[pos].remove();
    store.listeners = store.listeners.filter(function (l) { return l !== this.listener; }, this);
    if (this.mq) this.mq.removeEventListener('change', this.onMq);
  };

  var toaster = null;
  function ensureMounted() {
    if (toaster || !document.body) return;
    // Sin `mount` explícito, el contenedor es el body (fixed no; el body es el ancla).
    sileo.mount(document.body, { position: store.position });
  }

  /* ------------------------------ API pública ------------------------------ */
  var sileo = {
    __vanilla: true,
    mount: function (host, opts) {
      injectCSS();
      if (toaster) toaster.destroy();
      toaster = new Toaster(host || document.body, opts || {});
      return sileo;
    },
    unmount: function () { if (toaster) { toaster.destroy(); toaster = null; } },
    show: function (t, o) { var x = normalize(t, o); return createToast(Object.assign(x, { state: x.type })).id; },
    success: function (t, o) { return createToast(Object.assign(normalize(t, o), { state: 'success' })).id; },
    error: function (t, o) { return createToast(Object.assign(normalize(t, o), { state: 'error' })).id; },
    warning: function (t, o) { return createToast(Object.assign(normalize(t, o), { state: 'warning' })).id; },
    info: function (t, o) { return createToast(Object.assign(normalize(t, o), { state: 'info' })).id; },
    action: function (t, o) { return createToast(Object.assign(normalize(t, o), { state: 'action' })).id; },
    // Extensión: un toast en estado loading, persistente hasta `update`/`dismiss`.
    loading: function (t, o) { var x = normalize(t, o); if (x.duration === undefined) x.duration = null; return createToast(Object.assign(x, { state: 'loading' })).id; },
    update: function (id, t, o) { var x = normalize(t, o); updateToast(id, Object.assign(x, { state: x.type || x.state || 'success', id: id })); return id; },
    promise: function (promise, opts) {
      opts = opts || {};
      var loading = typeof opts.loading === 'string' ? { title: opts.loading } : (opts.loading || {});
      var id = createToast(Object.assign({}, loading, { state: 'loading', duration: null, position: opts.position, id: loading.id })).id;
      var p = typeof promise === 'function' ? promise() : promise;
      var resolve = function (v, data) { v = typeof v === 'function' ? v(data) : v; return typeof v === 'string' ? { title: v } : (v || {}); };
      p.then(function (data) {
        if (opts.action) updateToast(id, Object.assign(normalize(resolve(opts.action, data)), { state: 'action', id: id }));
        else updateToast(id, Object.assign(normalize(resolve(opts.success, data)), { state: 'success', id: id }));
      }).catch(function (err) { updateToast(id, Object.assign(normalize(resolve(opts.error, err)), { state: 'error', id: id })); });
      return p;
    },
    dismiss: dismissToast,
    clear: function (position) { store.update(function (prev) { return position ? prev.filter(function (t) { return t.position !== position; }) : []; }); },
    positions: POSITIONS.slice(),
  };
  window.sileo = sileo;
})();
