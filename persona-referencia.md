# Persona (AI Elements · Vercel), variante `halo` · referencia del port

Compilado el 17 de septiembre de 2026. Archivos: `src/persona.js` (el port), `src/halo-2.0.riv` (el binario original),
`persona-demo.html` (demo con conmutadores «Rive real / SVG fallback» y «Lilly / monocromo», cinco estados,
un orbe de 128 px y cinco de 16-24 px).

## Qué es el original y cómo funciona

- `Persona` es un componente React de AI Elements que **no dibuja nada por sí mismo**: monta un lienzo de
  **Rive** (`@rive-app/react-webgl2`) y carga un archivo binario `.riv` por variante desde el blob de Vercel.
  La variante `halo` es `halo-2.0.riv` (4,5 KB, artboard 256 × 256, nombre «Halo»).
- Cada `.riv` trae una máquina de estados llamada `default` con **cinco booleanos**: `listening`, `thinking`,
  `speaking`, `asleep` y `hover`. `state="idle"` es «ninguno activo». El componente pone en `true` solo el
  booleano del estado actual y Rive resuelve transiciones (`listening_in/out`, `thinking_off`, `on_in/out`,
  `off`, `hover_in/out`) y bucles (`on_idle1/2`, `listening_loop`, `thinking_loop1/2`, `speaking_loop`).
- **Es monocromo.** El único parámetro es la propiedad `color` del view model: negro (0,0,0) en tema claro y
  blanco (255,255,255) en oscuro, observando la clase `.dark` de `<html>` y `prefers-color-scheme`. Los grises
  salen de la opacidad de cada capa: `Glow`, `Ring`, `Ring - Frame` (fantasma), `Ring - Inner 1/2/3` (ondas),
  `Dash 1/2 + Mirror` (guiones que orbitan), `Wisp 1/2/3`, `Hitbox`.
- Layout por defecto de `useRive`: `Fit.Contain` + `Alignment.Center`, `autoplay: true`.

## Origen del binario y licencias

| Qué | Dónde | Licencia |
|---|---|---|
| Componente `persona.tsx` | https://github.com/vercel/ai-elements/blob/main/packages/elements/src/persona.tsx | Apache-2.0 («Copyright 2023 Vercel, Inc.», archivo LICENSE del repo) |
| Binario `halo-2.0.riv` | https://ejiidnob33g9ap1r.public.blob.vercel-storage.com/halo-2.0.riv (copiado a `src/halo-2.0.riv`, SHA-256 `c8d97df3…9dcc96`) | Se distribuye con el repo Apache-2.0; se conserva el archivo sin modificar |
| Runtime de Rive | https://unpkg.com/@rive-app/canvas@2.30.0/rive.js (fijado; `@latest` resolvía a 2.42.2 el 17-09-2026) | MIT |

## Cómo está hecho el port

1. **Motor Rive (principal).** `crearPersona` inyecta una sola vez el `<script>` del runtime (promesa compartida
   entre instancias) y crea `new rive.Rive({ src, canvas, autoplay: true, autoBind: true, stateMachines: 'default',
   layout: Contain/Center })`. En `onLoad` fija el `color` del view model y los cuatro booleanos exactamente como
   `persona.tsx`; `setEstado` vuelve a recorrer `stateMachineInputs('default')`.
2. **Tinte Lilly sin tocar la animación.** Con `colores`, Rive pinta en **blanco** sobre transparente en un canvas
   de trabajo (dentro del contenedor, superpuesto y con `opacity: 0`, porque el runtime deja de dibujar si su
   canvas no intersecta el viewport). En un `requestAnimationFrame` propio, el canvas visible se rellena con un
   **degradado cónico** de la paleta que gira una vuelta cada 12 s (`velocidadColor`) y se recorta con
   `globalCompositeOperation = 'destination-in'` usando el frame de Rive como máscara. `colores: null` deja el
   monocromo original (Rive dibuja directo en el canvas visible, negro o blanco según el tema).
3. **Rendimiento.** `IntersectionObserver` pausa Rive y el bucle de tinte cuando el orbe sale de pantalla.
   Con `prefers-reduced-motion: reduce` se deja el primer frame (Rive avanza 120 ms y se pausa; el tinte se
   compone una vez). Canvas a `devicePixelRatio` con tope 2. Cinco orbes pequeños + uno grande = seis instancias
   de Rive con un solo WASM compartido.
4. **Fallback SVG.** Si el runtime no carga, el `.riv` falla o no hay canvas, se monta el SVG (siete `<circle>`
   con `@keyframes` por estado) con la misma API y sin lanzar errores; `p.motor` dice cuál quedó activo.
   `motor: 'svg'` lo fuerza; `motor: 'rive'` avisa por consola si cae.

## Tabla de estados (comportamiento en el original; el SVG lo aproxima)

| Estado | Original (Rive) |
|---|---|
| **idle** | Anillo con glow; respira muy despacio (escala ±3 %) y el glow sube y baja de opacidad. |
| **listening** | `listening_in`: el anillo crece ~6 % y aparecen tres ondas concéntricas afuera; en el bucle el anillo pulsa y las ondas se expanden y desvanecen escalonadas. |
| **thinking** | Dos guiones finos opuestos orbitan fuera del anillo (~2,4 s por vuelta); el anillo oscila unos grados y el glow se desplaza respecto del anillo. |
| **speaking** | El anillo se aplasta en elipse y gira; el fantasma hace lo mismo desfasado (doble contorno en movimiento). |
| **asleep** | `off`: anillo al ~90 %, menos opaco, glow casi apagado, fantasma un poco desplazado, respiración muy lenta. |
| **hover** | Booleano aparte que el componente React no expone; no portado. |

## API

```js
const p = crearPersona(el, {
  variante: 'halo',        // única variante portada
  estado: 'idle',          // idle | listening | thinking | speaking | asleep
  tamano: 128,             // px; probado de 16 a 128
  colores: ['#D52B1E', '#F0705E', '#F8C9CF', '#FFF4F1', '#CFE0FA', '#1F5FA8', '#6B4FBF'],  // null = monocromo original
  motor: 'auto',           // auto | rive | svg
  velocidadColor: 12,      // segundos por vuelta del degradado
  // runtimeUrl, rivUrl    // para servirlos desde otro sitio
});
p.setEstado('thinking');  p.setColores(null);  p.estado;  p.motor;  p.destruir();
crearPersona.ESTADOS; crearPersona.RUNTIME_URL; crearPersona.RIV_URL;
```

El `.riv` se resuelve relativo a la URL de `persona.js` (`src/halo-2.0.riv`). Hay que servir la página por HTTP:
con `file://` el `fetch` del binario falla y todo cae al SVG.

## Integración en el prototipo (Alpine)

```html
<script src="src/persona.js"></script>
<div x-data="{ p: null, estado: 'idle' }"
     x-init="p = crearPersona($refs.orbe, { estado, tamano: 128, colores: LILLY })"
     x-effect="p && p.setEstado(estado)">
  <span x-ref="orbe"></span>
</div>
```

Orbes de botón: `crearPersona($refs.mini, { tamano: 18, colores: LILLY })`. Registro («Bienvenido, Dr. Óscar»):
arrancar en `asleep`, `speaking` mientras escribe, `idle` al terminar. Consulta: `listening` con micrófono,
`thinking` al enviar, `speaking` al responder.

## Verificación

- Chrome headless (`--headless=new --disable-gpu`, budget 5000): los seis orbes montan con `data-motor="rive"`
  en Lilly y en monocromo; con `motor=svg`, los seis con `data-motor="svg"`. Capturas de thinking, listening y
  speaking en Rive+Lilly y Rive mono coinciden con el original.
- Consola: sin errores. El runtime imprime un INFO «No WebGL support. Image mesh will not be drawn» solo con
  `--disable-gpu` (el runtime `canvas` usa Canvas 2D; no afecta al halo). Con `--use-angle=swiftshader` no sale.
- Fallback: con un `.riv` inexistente y con un runtime inexistente, ambas instancias caen a SVG, `setEstado`,
  `setColores` y `destruir` funcionan y `window.onerror` no recibe nada.

## Límites

- El tinte es una máscara de color sobre el render monocromo: donde el original tiene gris (glow, ondas) se ve
  el degradado atenuado, no un segundo color; es lo que permite conservar la animación exacta.
- Cambiar entre tinte y monocromo con `setColores` vuelve a montar la instancia (reinicia la animación).
- Hover, Wisp y las otras cinco variantes no están portados; el SVG de reserva aproxima curvas y tiempos a ojo.
