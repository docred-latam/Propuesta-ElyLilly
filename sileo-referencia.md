# Sileo · referencia del port a JS puro

**Qué es.** Sileo (Aaryan, MIT, v0.1.5) es un toast para React «con física»: una cápsula de
350×40 px que, al tener descripción o botón, **se funde** con un cuerpo más ancho debajo
mediante un filtro SVG *gooey* (blur 8 px + umbral de alfa) y springs de `motion`
(bounce .25, 600 ms). Sin sombra, sin borde, sin barra de progreso: la forma es el mensaje.
Cada toast es un `<button>` con SVG (cápsula + cuerpo), cabecera (badge 24 px + título) y contenido.

## Cómo se ve y se comporta (original = port)
| Aspecto | Valor |
|---|---|
| Geometría | ancho 350 · cápsula 40 alto · radio 16 · expandido ≥ 90 (o 40 + alto del contenido) |
| Cápsula | ancho = badge + título + 16 de padding + 10; alineada left/center/right según posición |
| Tipografía | título 13.2 px / 500 / **Capitalize** en color del estado; descripción 14 px; botón 12 px |
| Badge | círculo 24 px, icono lucide 16 px, fondo = color del estado al 20 % |
| Estados / iconos | success `check` · error `x` · warning `circle-alert` · info `life-buoy` · loading `loader-circle` (gira) · action `arrow-right` |
| Entrada | opacidad 0→1, `translateY(∓6px) scale(.95)`→1, 400 ms, curva `linear()` = spring; el margen negativo desplaza la pila |
| Salida | inversa, 600 ms; el elemento se retira después |
| Expansión | la cápsula crece a 64 px y el cuerpo baja con spring (bounce .25); al cerrar, spring sin rebote; cabecera `translateY(3px) scale(.9)` |
| Autopilot | con descripción: se abre a los 150 ms y se cierra a los 4000 ms (duración 6000 por defecto) |
| Hover | pausa **todos** los temporizadores, expande el toast bajo el mouse y pliega los demás; al salir, reprograma la duración completa |
| Solo uno expandido | únicamente el más reciente (o el que tiene el mouse) puede abrirse |
| Swipe | arrastre vertical con Pointer Events, tope 20 px; soltar tras > 30 px descarta |
| Apilado | **sin `id` no apila**: el nuevo reemplaza al vivo con morph (cabecera vieja sale con blur 6 px en 420 ms, la nueva entra con blur). Con ids distintos: columna con 12 px de separación, el más reciente pegado al borde. Seis posiciones |
| Promesa | loading (persistente, sin expansión) → success/error/action con morph de cabecera; si estaba abierto, se cierra 200 ms antes de cambiar |
| Tema | sin tema: relleno blanco. `theme: 'light'` → cápsula `#1a1a1a` con descripción blanca al 50 %; `'dark'` → `#f2f2f2` con descripción negra al 50 %; `'system'` sigue al SO |
| Reduced motion | animaciones y transiciones a 0.01 ms; los springs saltan al valor final |
| Colores (Sileo) | success oklch verde · error rojo · warning ámbar · info celeste · action azul · loading gris |

## API del port (`window.sileo`)
```js
sileo.mount(el, { position: 'top-center', theme, palette: 'lilly', offset: { top: 48 }, options: {} });
sileo.success('Guardado', { description: '…', action: { label: 'Deshacer', onClick() {} }, duration: 6000 });
sileo.error(opts) · sileo.warning(opts) · sileo.info(opts) · sileo.action(opts) · sileo.show({ type })
sileo.loading('Consultando…')              // persistente hasta update/dismiss (extensión)
sileo.update(id, { title, description })   // cambia estado/contenido con morph (extensión)
sileo.promise(p, { loading, success, error, action?, position? })  // devuelve p
sileo.dismiss(id) · sileo.clear(position?) · sileo.unmount()
```
Opciones (las de Sileo): `title`, `description` (string o Node), `button {title, onClick}`, `position`,
`duration` (ms o `null` = persistente), `icon` (SVG string o Node), `fill`, `roundness`,
`autopilot` (`false` o `{ expand, collapse }`), `styles {title, description, badge, button}`.
Extensiones: primer argumento string, `action {label, onClick}` como alias de `button`, `id` para apilar,
`palette: 'lilly'` (success `#34C759`, error `#D52B1E`, info/action `#1F5FA8`, warning `#FF9F0A`).
Variables CSS expuestas: `--sileo-state-*`, `--sileo-width`, `--sileo-height`, `--sileo-duration`.

## Integración en el prototipo
1. `<script src="src/sileo.js"></script>` después de Alpine; el CSS se inyecta solo una vez (`#sileo-css`).
2. Montar dentro de la pantalla del teléfono (nunca en `body`: el marco va escalado con `transform`):
   `sileo.mount(pantallaEl, { position: 'top-center', palette: 'lilly', offset: { top: 52 } })`.
   El contenedor es `position: absolute` respecto al elemento montado; el offset deja libre la Dynamic Island.
3. `hud('Guardado')` → `sileo.success('Guardado')`. Un aviso con contexto → añade `description`.
   `isla('Consultando…')` → `sileo.loading('Consultando…')` y luego `sileo.update(id, …)` o `sileo.promise`.
4. Sin `id`, los avisos seguidos se reemplazan con morph (como Sileo). Para apilar, pasar `id` distinto.
5. El título lleva `text-transform: capitalize` (fidelidad); si molesta en español, `styles: { title: 'normal-case' }`
   con Tailwind o `options.styles` al montar.

## Diferencias respecto al original
- Contenedor `absolute` en vez de `fixed` (motivo: teléfono escalado). Springs integrados en JS, no `motion`.
- Se quitó `content-visibility: hidden` del contenido plegado (Chrome avisaba en consola al medirlo); se usa `visibility`.
- El relleno debe ser opaco: el filtro gooey descarta alfa parcial, así que no hay versión «vidrio» fiel.
- Sin sonidos, sin barra de tiempo, sin botón de cierre ni Escape: Sileo tampoco los tiene.

## Verificación
`sileo-demo.html?auto=1` dispara tres apilados; `?auto=morph`, `?auto=promise`, `?pos=bottom-left`, `?theme=light`,
`?hover=<n>` para capturas. Verificado en Chrome headless (virtual time y en tiempo real vía CDP) sin mensajes de consola.

## Fuentes
- Docs: https://sileo.aaryan.design/docs · API: https://sileo.aaryan.design/docs/api · Toaster: https://sileo.aaryan.design/docs/api/toaster · Estilos: https://sileo.aaryan.design/docs/styling
- Código (v0.1.5): https://github.com/hiaaryan/sileo — `src/sileo.tsx`, `src/toast.tsx`, `src/styles.css`, `src/constants.ts`
- Port vanilla de terceros consultado como contraste: https://github.com/hamada147/sileo-vanilla
- Springs: `findSpring` de motion (https://github.com/motiondivision/motion), reimplementado en `src/sileo.js`
