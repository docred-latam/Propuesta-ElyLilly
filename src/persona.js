/* persona.js — port a JS puro del componente <Persona variant="halo"> de AI Elements (Vercel, Apache-2.0).
 *
 * Motor principal: el runtime real de Rive (@rive-app/canvas, cargado por CDN una sola vez) con el binario
 * original halo-2.0.riv, la máquina de estados «default» y sus booleanos listening / thinking / speaking /
 * asleep, igual que persona.tsx. El original es monocromo (una propiedad «color»: negro en claro, blanco en
 * oscuro). Para la paleta Lilly se renderiza Rive en BLANCO sobre transparente en un canvas oculto y cada frame
 * se compone en el canvas visible con un degradado cónico que gira despacio (`destination-in`), así la
 * animación de Rive queda intacta y solo cambia el color.
 *
 * Fallback: si el runtime o el .riv no cargan (sin red, CDN bloqueado, canvas no disponible), se monta un
 * SVG con las mismas capas y estados. Misma API en los dos casos.
 *
 * Uso:  const p = crearPersona(el, { estado: 'idle', tamano: 128, colores: ['#D52B1E', …] });
 *       p.setEstado('thinking'); p.setColores(null); p.destruir();
 * Opciones: variante ('halo'), estado, tamano (px), colores (array | null = monocromo), motor ('auto'|'rive'|'svg'),
 *           velocidadColor (s por vuelta del degradado, 12), runtimeUrl, rivUrl.
 */
(function () {
  'use strict';

  var ESTADOS = ['idle', 'listening', 'thinking', 'speaking', 'asleep'];
  var ENTRADAS = ['listening', 'thinking', 'speaking', 'asleep'];
  var RUNTIME_URL = 'https://unpkg.com/@rive-app/canvas@2.30.0/rive.js';
  var RIV_URL = (function () {
    // El .riv vive junto a este script (src/halo-2.0.riv); se resuelve relativo a la URL del script.
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, 'halo-2.0.riv') : 'src/halo-2.0.riv';
  })();
  var STATE_MACHINE = 'default';
  var VB = 256, R = 64;
  var CSS_ID = 'persona-halo-css';

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- runtime de Rive: un solo <script>, una promesa compartida ---------- */
  var cargaRuntime = null;
  function cargarRuntime(url) {
    if (window.rive && window.rive.Rive) return Promise.resolve(window.rive);
    if (cargaRuntime) return cargaRuntime;
    cargaRuntime = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = url || RUNTIME_URL;
      s.async = true;
      s.onload = function () { window.rive && window.rive.Rive ? resolve(window.rive) : reject(new Error('runtime sin global rive')); };
      s.onerror = function () { reject(new Error('no se pudo cargar ' + s.src)); };
      document.head.appendChild(s);
    });
    cargaRuntime.catch(function () { cargaRuntime = null; });   // permite reintentar en otra instancia
    return cargaRuntime;
  }

  function temaOscuro() {
    return document.documentElement.classList.contains('dark') ||
      !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function observarTema(cb) {
    var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (mql) mql.addEventListener('change', cb);
    var mo = window.MutationObserver ? new MutationObserver(cb) : null;
    if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return function () { if (mql) mql.removeEventListener('change', cb); if (mo) mo.disconnect(); };
  }

  /* ---------- motor Rive ---------- */
  function montarRive(raiz, o, alFallar) {
    var tamano = o.tamano, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = Math.round(tamano * dpr);
    var colores = o.colores, estado = o.estado;
    var tintando = !!colores;
    var visible = document.createElement('canvas');      // lo que se ve
    visible.width = px; visible.height = px;
    visible.style.width = tamano + 'px'; visible.style.height = tamano + 'px';
    visible.style.display = 'block';
    raiz.appendChild(visible);
    var lienzoRive = tintando ? document.createElement('canvas') : visible;   // con tinte, Rive pinta aparte
    if (lienzoRive !== visible) {
      // El runtime de Rive deja de dibujar si su canvas no intersecta el viewport, así que el canvas de
      // trabajo va DENTRO del contenedor, superpuesto e invisible por opacidad (no por display/detached).
      lienzoRive.width = px; lienzoRive.height = px;
      lienzoRive.style.cssText = 'position:absolute;left:0;top:0;width:' + tamano + 'px;height:' + tamano + 'px;opacity:0;pointer-events:none';
      raiz.style.position = 'relative';
      raiz.appendChild(lienzoRive);
    }
    var ctx = tintando ? visible.getContext('2d') : null;
    var instancia = null, cargado = false, destruido = false, enPantalla = true, raf = 0, t0 = 0, quitarTema = null;

    function aplicarEstado() {
      if (!instancia || !cargado) return;
      var inputs = instancia.stateMachineInputs(STATE_MACHINE) || [];
      for (var i = 0; i < inputs.length; i++) {
        if (ENTRADAS.indexOf(inputs[i].name) >= 0) inputs[i].value = (inputs[i].name === estado);
      }
    }

    function aplicarColorVm() {
      if (!instancia || !cargado) return;
      try {
        var vmi = instancia.viewModelInstance;
        var c = vmi && vmi.color('color');
        if (!c) return;
        if (tintando || temaOscuro()) c.rgb(255, 255, 255);   // blanco: máscara para el degradado / tema oscuro
        else c.rgb(0, 0, 0);
      } catch (e) { /* variantes sin view model */ }
    }

    // Degradado cónico que gira despacio; si el navegador no tiene createConicGradient, lineal.
    function pintarTinte(ahora) {
      if (!ctx) return;
      var ang = ((ahora - t0) / 1000) / (o.velocidadColor || 12) * Math.PI * 2;
      var g;
      if (ctx.createConicGradient) g = ctx.createConicGradient(ang, px / 2, px / 2);
      else { var dx = Math.cos(ang) * px / 2, dy = Math.sin(ang) * px / 2; g = ctx.createLinearGradient(px / 2 - dx, px / 2 - dy, px / 2 + dx, px / 2 + dy); }
      var n = colores.length;
      for (var i = 0; i <= n; i++) g.addColorStop(i / n, colores[i % n]);   // cierra el ciclo con el primer color
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, px, px);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, px, px);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(lienzoRive, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    function bucle(ahora) {
      raf = 0;
      if (destruido || !tintando) return;
      pintarTinte(ahora);
      if (enPantalla && !reduceMotion) raf = requestAnimationFrame(bucle);
    }
    function arrancarBucle() { if (tintando && !raf && !destruido) raf = requestAnimationFrame(bucle); }
    function play() { if (instancia && cargado && !reduceMotion) { try { instancia.play(); } catch (e) {} } arrancarBucle(); }
    function pause() { if (instancia && cargado) { try { instancia.pause(); } catch (e) {} } if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    // Pausa cuando no está en pantalla: ahorra CPU con varias instancias.
    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
      enPantalla = es[0].isIntersecting;
      if (enPantalla) play(); else pause();
    }) : null;
    if (io) io.observe(raiz);

    function fallar(err) {
      if (destruido) return;
      destruido = true;
      if (io) io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (instancia) { try { instancia.cleanup(); } catch (e) {} instancia = null; }
      if (visible.parentNode) visible.parentNode.removeChild(visible);
      if (lienzoRive !== visible && lienzoRive.parentNode) lienzoRive.parentNode.removeChild(lienzoRive);
      alFallar(err);
    }

    cargarRuntime(o.runtimeUrl).then(function (rive) {
      if (destruido) return;
      t0 = performance.now();
      instancia = new rive.Rive({
        src: o.rivUrl || RIV_URL,
        canvas: lienzoRive,
        autoplay: true,
        autoBind: true,
        stateMachines: STATE_MACHINE,
        layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),   // el default de useRive
        onLoad: function () {
          if (destruido) { try { instancia.cleanup(); } catch (e) {} return; }
          cargado = true;
          aplicarColorVm();
          aplicarEstado();
          quitarTema = observarTema(function () { if (!tintando) aplicarColorVm(); });
          raiz.setAttribute('data-motor', 'rive');
          if (reduceMotion) {
            // Deja el primer frame: se avanza un instante y se pausa (con tinte, se compone una vez).
            setTimeout(function () { pause(); if (tintando) pintarTinte(performance.now()); }, 120);
          } else if (enPantalla) arrancarBucle(); else pause();
        },
        onLoadError: function () { fallar(new Error('no se pudo cargar el .riv')); }
      });
    }).catch(fallar);

    return {
      get estado() { return estado; },
      setEstado: function (s) { estado = s; aplicarEstado(); },
      // Cambiar la paleta sin cambiar de modo es inmediato; cambiar de modo (tinte ↔ monocromo) rehace el montaje.
      setColores: function (c) {
        var nuevo = Array.isArray(c) && c.length ? c.slice() : null;
        if (!!nuevo === tintando) { colores = nuevo; aplicarColorVm(); return null; }
        this.destruir();
        o.colores = nuevo; o.estado = estado;
        return montarRive(raiz, o, alFallar);
      },
      destruir: function () {
        if (destruido) return;
        destruido = true;
        if (io) io.disconnect();
        if (raf) cancelAnimationFrame(raf);
        if (quitarTema) quitarTema();
        if (instancia) { try { instancia.cleanup(); } catch (e) {} instancia = null; }
        if (visible.parentNode) visible.parentNode.removeChild(visible);
        if (lienzoRive !== visible && lienzoRive.parentNode) lienzoRive.parentNode.removeChild(lienzoRive);
      }
    };
  }

  /* ---------- fallback SVG: mismas capas y estados que el .riv ---------- */
  var CSS = [
    '.persona{display:inline-block;line-height:0;vertical-align:middle}',
    '.persona svg,.persona canvas{display:block}',
    '.persona svg{overflow:visible}',
    '.persona circle{fill:none;stroke-linecap:round;transform-origin:128px 128px;transform-box:view-box}',
    '.persona .p-glow{opacity:.18;filter:blur(3px)}',
    '.persona .p-ring{stroke-width:var(--sw)}',
    '.persona .p-frame{opacity:0}',
    '.persona .p-inner{opacity:0}',
    '.persona .p-dash{opacity:0;stroke-dasharray:52 400}',
    '.persona .p-fade{transition:opacity .45s ease}',
    '.persona .p-scale{transition:transform .45s cubic-bezier(.32,.72,0,1)}',
    '.persona[data-estado=idle] .p-ring{animation:p-breathe 3.4s ease-in-out infinite}',
    '.persona[data-estado=idle] .p-glow{animation:p-breathe 3.4s ease-in-out infinite,p-glow-idle 3.4s ease-in-out infinite}',
    '.persona[data-estado=listening] .p-ring{animation:p-listen 1.6s ease-in-out infinite}',
    '.persona[data-estado=listening] .p-glow{animation:p-listen 1.6s ease-in-out infinite;opacity:.26}',
    '.persona[data-estado=listening] .p-inner{opacity:1}',
    '.persona[data-estado=listening] .p-inner-1{animation:p-ripple 2.4s ease-out infinite}',
    '.persona[data-estado=listening] .p-inner-2{animation:p-ripple 2.4s ease-out infinite .5s}',
    '.persona[data-estado=listening] .p-inner-3{animation:p-ripple 2.4s ease-out infinite 1s}',
    '.persona[data-estado=thinking] .p-dash{opacity:.9}',
    '.persona[data-estado=thinking] .p-dashes{animation:p-orbit 2.4s linear infinite;transform-origin:128px 128px;transform-box:view-box}',
    '.persona[data-estado=thinking] .p-ring{animation:p-think-ring 2.4s ease-in-out infinite}',
    '.persona[data-estado=thinking] .p-glow{animation:p-think-glow 2.4s ease-in-out infinite;opacity:.22}',
    '.persona[data-estado=speaking] .p-ring{animation:p-speak 1.3s ease-in-out infinite}',
    '.persona[data-estado=speaking] .p-frame{opacity:.45;animation:p-speak-frame 1.3s ease-in-out infinite}',
    '.persona[data-estado=speaking] .p-glow{animation:p-speak 1.3s ease-in-out infinite}',
    '.persona[data-estado=asleep] .p-ring{opacity:.75;animation:p-sleep 5s ease-in-out infinite}',
    '.persona[data-estado=asleep] .p-glow{opacity:.1;animation:p-sleep 5s ease-in-out infinite}',
    '.persona[data-estado=asleep] .p-frame{opacity:.28;transform:translate(1.5px,1.5px) scale(.9)}',
    '@keyframes p-breathe{0%,100%{transform:scale(.97)}50%{transform:scale(1.03)}}',
    '@keyframes p-glow-idle{0%,100%{opacity:.14}50%{opacity:.24}}',
    '@keyframes p-listen{0%,100%{transform:scale(1.04)}50%{transform:scale(1.1)}}',
    '@keyframes p-ripple{0%{transform:scale(.98);opacity:.55}70%{opacity:.18}100%{transform:scale(1.12);opacity:0}}',
    '@keyframes p-orbit{to{transform:rotate(360deg)}}',
    '@keyframes p-think-ring{0%,100%{transform:rotate(-4deg) scale(1)}50%{transform:rotate(4deg) scale(1.02)}}',
    '@keyframes p-think-glow{0%,100%{transform:translate(-3px,2px) scale(1.02)}50%{transform:translate(3px,-2px) scale(1.04)}}',
    '@keyframes p-speak{0%{transform:rotate(0) scale(1,.92)}50%{transform:rotate(90deg) scale(1,.9)}100%{transform:rotate(180deg) scale(1,.92)}}',
    '@keyframes p-speak-frame{0%{transform:rotate(60deg) scale(.94,1.02)}50%{transform:rotate(150deg) scale(.9,1.02)}100%{transform:rotate(240deg) scale(.94,1.02)}}',
    '@keyframes p-sleep{0%,100%{transform:scale(.9)}50%{transform:scale(.93)}}',
    '@media (prefers-reduced-motion:reduce){.persona circle,.persona .p-dashes{animation:none!important}',
    '.persona[data-estado=listening] .p-inner{opacity:.35}.persona[data-estado=listening] .p-ring,.persona[data-estado=listening] .p-glow{transform:scale(1.06)}',
    '.persona[data-estado=asleep] .p-ring,.persona[data-estado=asleep] .p-glow{transform:scale(.9)}',
    '.persona[data-estado=speaking] .p-ring,.persona[data-estado=speaking] .p-glow{transform:scale(1,.92)}',
    '.persona[data-estado=speaking] .p-frame{transform:rotate(60deg) scale(.94,1.02)}}'
  ].join('\n');

  function inyectarCss() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style'); s.id = CSS_ID; s.textContent = CSS; document.head.appendChild(s);
  }

  function circulo(clase, r, extra) {
    var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('class', clase); c.setAttribute('cx', VB / 2); c.setAttribute('cy', VB / 2); c.setAttribute('r', r);
    if (extra) Object.keys(extra).forEach(function (k) { c.setAttribute(k, extra[k]); });
    return c;
  }

  function montarSvg(raiz, o) {
    var tamano = o.tamano, estado = o.estado, autoColor = !o.colores;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + VB + ' ' + VB); svg.setAttribute('width', tamano); svg.setAttribute('height', tamano);
    var k = VB / tamano;
    var swPx = Math.max(1.25, tamano * 0.016), gwPx = Math.max(3, tamano * 0.055), twPx = Math.max(0.75, tamano * 0.006);
    raiz.style.setProperty('--sw', (swPx * k).toFixed(2));
    var glow = circulo('p-glow p-scale', R, { 'stroke-width': (gwPx * k).toFixed(2) });
    var inner1 = circulo('p-inner p-inner-1 p-fade', 74, { 'stroke-width': (twPx * k).toFixed(2) });
    var inner2 = circulo('p-inner p-inner-2 p-fade', 82, { 'stroke-width': (twPx * k).toFixed(2) });
    var inner3 = circulo('p-inner p-inner-3 p-fade', 93, { 'stroke-width': (twPx * k).toFixed(2) });
    var frame = circulo('p-frame p-ring p-fade p-scale', R);
    var ring = circulo('p-ring p-scale', R);
    var grupo = document.createElementNS('http://www.w3.org/2000/svg', 'g'); grupo.setAttribute('class', 'p-dashes');
    var dash1 = circulo('p-dash p-fade', 72, { 'stroke-width': (twPx * 1.6 * k).toFixed(2), 'stroke-dashoffset': 0 });
    var dash2 = circulo('p-dash p-fade', 72, { 'stroke-width': (twPx * 1.6 * k).toFixed(2), 'stroke-dashoffset': -226 });
    grupo.appendChild(dash1); grupo.appendChild(dash2);
    [glow, inner3, inner2, inner1, frame, ring, grupo].forEach(function (n) { svg.appendChild(n); });
    raiz.appendChild(svg);
    raiz.setAttribute('data-motor', 'svg');

    function pintar(colores) {
      var c = Array.isArray(colores) && colores.length ? colores : [temaOscuro() ? '#ffffff' : '#000000'];
      var anillo = c[0], glowC = c[1] || c[0], ondas = c[2] || c[0], guiones = c[3] || c[1] || c[0];
      ring.setAttribute('stroke', anillo); frame.setAttribute('stroke', anillo); glow.setAttribute('stroke', glowC);
      [inner1, inner2, inner3].forEach(function (n) { n.setAttribute('stroke', ondas); });
      [dash1, dash2].forEach(function (n) { n.setAttribute('stroke', guiones); });
    }
    pintar(o.colores);
    var quitarTema = observarTema(function () { if (autoColor) pintar(null); });

    return {
      get estado() { return estado; },
      setEstado: function (s) { estado = s; },
      setColores: function (c) { autoColor = !(Array.isArray(c) && c.length); pintar(c); return null; },
      destruir: function () { quitarTema(); if (svg.parentNode) svg.parentNode.removeChild(svg); }
    };
  }

  /* ---------- API pública ---------- */
  function crearPersona(el, opciones) {
    if (!el) throw new Error('crearPersona: falta el elemento contenedor');
    var o = Object.assign({ variante: 'halo', estado: 'idle', tamano: 64, colores: null, motor: 'auto' }, opciones || {});
    if (o.variante !== 'halo') console.warn('crearPersona: solo está portada la variante «halo»; se usa halo en lugar de «' + o.variante + '»');
    if (ESTADOS.indexOf(o.estado) < 0) o.estado = 'idle';
    o.colores = Array.isArray(o.colores) && o.colores.length ? o.colores.slice() : null;

    inyectarCss();
    var raiz = document.createElement('span');
    raiz.className = 'persona persona-halo';
    raiz.setAttribute('role', 'img');
    raiz.setAttribute('data-estado', o.estado);
    raiz.setAttribute('aria-label', 'Asistente: ' + o.estado);
    el.appendChild(raiz);

    var motor = null, estado = o.estado;
    var puedeRive = o.motor !== 'svg' && !!document.createElement('canvas').getContext;
    var alFallar = function (err) {
      // Cae al SVG conservando el estado y la paleta actuales; sin lanzar errores.
      if (o.motor === 'rive') console.warn('crearPersona: Rive no disponible (' + (err && err.message) + '); se usa el SVG');
      o.estado = estado;
      motor = montarSvg(raiz, o);
    };
    motor = puedeRive ? montarRive(raiz, o, alFallar) : montarSvg(raiz, o);

    return {
      get estado() { return estado; },
      get motor() { return raiz.getAttribute('data-motor') || 'cargando'; },
      setEstado: function (s) {
        if (ESTADOS.indexOf(s) < 0) { console.warn('crearPersona: estado desconocido «' + s + '»'); return; }
        estado = s; o.estado = s;
        raiz.setAttribute('data-estado', s);
        raiz.setAttribute('aria-label', 'Asistente: ' + s);
        motor.setEstado(s);
      },
      setColores: function (c) {
        o.colores = Array.isArray(c) && c.length ? c.slice() : null;
        var remontado = motor.setColores(o.colores);
        if (remontado) motor = remontado;
      },
      destruir: function () { motor.destruir(); if (raiz.parentNode) raiz.parentNode.removeChild(raiz); }
    };
  }

  crearPersona.ESTADOS = ESTADOS.slice();
  crearPersona.RUNTIME_URL = RUNTIME_URL;
  crearPersona.RIV_URL = RIV_URL;
  window.crearPersona = crearPersona;
})();
