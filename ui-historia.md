# Acabado visual · La historia (`#cap-*`)

Auditoría y corrección aplicadas sobre `src/85-historia.html` y los bloques `.hist*` del
`<style>` de `src/00-shell-inicio.html`. Nada fuera de ese alcance se tocó.

## Lo que estaba mal y ya está corregido

### Alineación y ritmo vertical
1. **El hero no estaba en el mismo riel que las tarjetas.** Tenía su propio
   `padding: 0 clamp(32px,7vw,132px)` *encima* del padding de `.hist`, así que a 1440 su
   contenido empezaba en x=173 mientras las tarjetas empezaban en x=100. Ahora el hero y
   las secciones comparten `width: min(100%,1240px)` centrado y el hero no lleva padding
   lateral propio: todo arranca y termina en la misma línea.
2. **Cero aire entre el hero y la primera tarjeta.** La regla
   `.hist > section:first-of-type + .hist-sec { margin-top: 0 }` las dejaba pegadas. Ahora
   lleva el mismo `clamp(56px,8vh,104px)` que separa a las hermanas.
3. **Las láminas «qué hizo» no tenían padding horizontal.** `.hist > .hist-sec { padding-left: 0 }`
   (especificidad 0-2-0) ganaba sobre `.hist-sec--proto { padding: … }` (0-1-0), así que el
   titular y la ventana del teléfono quedaban pegados al borde de la tarjeta. Se eliminó esa
   regla y el padding de `--proto` volvió a aplicar.
4. **Aire desigual al final.** Entre tarjetas había 104px, pero 144 antes de los cuatro
   momentos, 184 antes de la parrilla y 264 antes del cierre, por padding acumulado. Se puso
   `padding: 0` en `--cierre` y `--parrilla` y el margen común quedó de único responsable; el
   cierre conserva un respiro mayor a propósito (`padding-top: clamp(40px,8vh,88px)`).

### Tipografía
5. Escala unificada: **62 hero · 48 apertura de capítulo · 40 sección · 22 bloque · 16.5
   cuerpo · 15 pie · 14.5 nota · 13 dato/legal**. `.hist-h1` bajó de 58 a 48 (a 58 competía
   con el hero, contra lo decidido en CONTEXTO: «el único grande es el del hero»), el kicker
   bajó de 19 a 15 (era más grande que el cuerpo), `.hist-celda-d` subió de 13.5 a 14.5 y
   `.hist-momento-d` de 15.5 a 15.
6. **`.hist-pie` quedó en 15px, no en 13.** El encargo pedía 13, pero son frases narrativas
   completas («Óscar no lo pensó dos veces…») proyectadas en una presentación: a 13px dejan
   de leerse. El 13 se reservó para el dato y la nota legal. Queda a criterio de Andrés.
7. **El titular de «qué hizo» era un flex.** Cada tramo de texto era un ítem, así que la frase
   se partía en bloques con 8px de separación entre palabras. Pasó a `display: block` con la
   marca como `inline-flex` en línea: ahora fluye como una sola frase.
8. Viudas: `text-wrap: balance` en titulares y `pretty` en párrafos y notas.

### Contraste sobre negro
9. Con la cortina roja detrás, el fondo sube a ~0.046 de luminancia y los grises bajos no
   llegan a 4.5:1. Medido: `.5` daba **3.78:1** y `.55` tampoco pasaba. Se subieron
   `.hist-rol` (.55→.72), `.hist-pie` (.55→.68), `.hist-dato-u` (.5→.72, y de 12 a 13px),
   `.hist-cifra p` (.5→.7), `.hist-celda` (.55→.7), `.hist-nota` (.62→.74), `.hist-p`
   (.72→.78) y `.hist-hero-p` (.62→.74). La nota legal del cierre estaba en **blanco 25 %**
   (prácticamente invisible): pasó a 13px / 45 %. El rojo de los enlaces secundarios
   (`.hist-momento-v`, la flecha de celda) pasó de `#D52B1E` a `#E8412F`, que sobre negro sí
   se lee.

### Las láminas «qué hizo»
10. **Las cuatro celdas no medían igual.** Eran dos rejillas de 2 columnas apiladas, con las
    filas dimensionadas por separado. Ahora es **una sola rejilla** con
    `grid-auto-rows: 1fr`, así que las cuatro celdas comparten altura. El teléfono salió de
    dentro del bloque de notas y volvió a ser hermano suyo dentro de `.hist-proto`.
11. El degradado inferior cortaba la barra «Preguntar a Lilly 360»: la máscara pasó de 78 % a
    84 % y el teléfono de 290 a 300px. El botón de acción sigue alineado al borde derecho de
    la ventana interior, que es lo correcto.

### Responsive
12. **Riesgo de desbordamiento horizontal real.** Las rejillas usaban `1fr`, que no baja del
    `min-content`: la parrilla de 2 columnas y las notas de 2 columnas imponían su ancho a
    toda la historia en móvil. Todas pasaron a `minmax(0,1fr)`. La parrilla ahora es de una
    columna bajo 560px y las notas bajo 760px.
13. La píldora del hero no podía partirse (`height` fija + `white-space` por defecto): a 420px
    no cabía. Ahora es `min-height` con `padding` y se parte en dos líneas.
14. En una columna la foto seguía el alto del texto y salía desproporcionada. Se le dio
    proporción propia: 16:10 bajo 900px y 4:3 bajo 560px.
15. Las cifras eran un `flex-wrap` que dejaba «3» y «4» arriba y «25» huérfana abajo. Ahora es
    una rejilla `auto-fit` con el número sobre la etiqueta: tres columnas alineadas en
    escritorio, dos en tablet.

### Estados y accesibilidad
16. No había foco visible en ningún control de la historia. Se añadió a `.hist-btn`,
    `.hist-ver`, `.hist-celda`, `.hist-momento` y a los puntos del índice; con el foco también
    aparecen «Verlo en el prototipo» y la flecha de la celda, que antes solo salían al pasar
    el mouse.
17. Los puntos del índice miden 7px. Se les dio un área de clic de 31×19 con un `::after`
    (sin solaparse entre sí), manteniendo el punto igual de discreto.
18. Los dos botones de lámina que no decían a dónde iban («Ver el canal de la enfermedad»,
    «Ver el microaprendizaje») llevan `aria-label` que añade «en el prototipo» sin tocar el
    texto visible. Los `alt` ya estaban bien: informativos en las fotos y `aria-hidden` en las
    capas de luz.

## Pendiente, fuera de alcance
- **Preload huérfano.** La consola avisa que `img/lilly-firma.png` se precarga y no se usa: la
  historia usa `lilly-firma-blanca.png`. El `<link rel="preload">` está en el `<head>`, fuera
  de los bloques `.hist`.
- **Aire en los PNG del logo.** `lilly-firma-blanca.png` trae márgenes propios; se compensó con
  `margin-left: -10px` en la marca grande, pero lo limpio es recortar el archivo.
- **`scroll-snap-align: start` en el hero** no hacía nada (el contenedor no declara
  `scroll-snap-type`). Se quitó la propiedad muerta; si se quiere el snap hay que tocar el
  contenedor de scroll.
- **La pantalla de cada lámina deja mucho negro a los lados** del teléfono. Llenarlo pedía otra
  composición, no acabado, así que no se tocó.

## Excepción deliberada (18 de septiembre de 2026, con recomposición el mismo día): «Quiénes somos» (`cap-marca`)
La regla 5 de arriba («escala tipográfica única») **no aplica** a `.cap-marca-lead` y `.cap-marca-grande`,
del primer momento de la historia (DocRed, antes de entrar a Lilly 360). Es a propósito: es el único
tramo que habla de DocRed y no de Lilly 360, así que se le dio un tratamiento editorial propio para que
se sienta como apertura de credenciales, no como una tarjeta «qué hizo» ni como una escena de Óscar. No
es un patrón a replicar en el resto de la historia.

Encargo posterior del mismo día: recomponer `cap-marca` como una apertura de credenciales, no como
publicidad institucional ni como una escena del día de Óscar. Los cinco puntos que debía demostrar
(conocimiento del comportamiento digital de los médicos, experiencia en educación médica, acceso a una
comunidad profesional latinoamericana, capacidad de producir contenido y desarrollar experiencias
digitales, comprensión del contexto farmacéutico) se resolvieron así:

- **Foto a página completa con velo azul marino a la izquierda**, en vez de la foto lateral que tenía
  antes. `.cap-marca-foto` es un bloque normal después del texto en móvil (logo, titular, texto, imagen,
  credenciales, como pidió el encargo) y, desde 900px, se vuelve el fondo absoluto de toda la sección,
  con `.cap-marca-foto::after` como el velo (dos degradados: uno horizontal, opaco a la izquierda y
  transparente hacia la derecha; uno vertical, más sutil). Sigue dentro del riel de 1240px de la
  historia, no del viewport completo: sería un cambio estructural mayor que el encargo no pidió.
- **Acentos en azul marino y verde menta** (`#2D3192` y `#6DCB8A`, los colores de marca documentados en
  `img/CREDITOS.md`), nunca rojo Lilly: el encargo original pedía "turquesa y magenta", pero esos no son
  los colores de marca validados de DocRed — se usaron los reales para no introducir una paleta sin
  respaldo.
- **Credenciales como franja integrada** (`.cap-marca-cifras`/`.cap-marca-cifra`), con separadores
  verticales en escritorio y una cuadrícula de dos columnas en móvil, no cuatro cajas sueltas. De las
  cuatro cifras pedidas, dos están confirmadas en la documentación de este proyecto (más de 100.000
  profesionales de la salud verificados; más de 6 años de experiencia) y dos —15 países, más de 4.500
  contenidos producidos— se tomaron tal como las dictó Andrés en el encargo, sin una fuente propia del
  proyecto para cruzarlas: quedan pendientes de que él las confirme antes de que esta pieza salga de aquí.
- **Titular como elemento principal** (`.cap-marca-grande`, reutilizada la misma clase para no romper el
  efecto de revelado por palabras que ya la animaba desde el JS) y el texto de respaldo dividido en dos
  párrafos (`.cap-marca-lead` / `.cap-marca-lead--enfasis`), en vez de un párrafo largo.
- **Transición hacia Óscar**: la frase cifrada de `cap-dia` (que ya existía como puente, con el efecto
  encrypted-text) se reemplazó por la frase exacta del encargo, y se agregó `.hist-dia-cta` — una
  indicación neutra, no roja, con "Conozca al Dr. Óscar Martínez" — donde antes había un párrafo
  descriptivo del reto. DocRed desaparece como protagonista ahí: de `cap-oscar` en adelante nada de esta
  vuelta se tocó.

También se agregó `.hist-hilo`: un número (01–07, hoy 01–09) con una línea corta, antes del kicker o
titular de cada momento narrativo (no de las láminas «qué hizo»), a modo de hilo conductor. Es corto a
propósito: `.hist-sec` recorta con `overflow:hidden`, así que una línea que intentara cruzar de una
tarjeta a la siguiente se vería cortada a mitad de camino.

## Dos lenguajes visuales deliberadamente distintos (18 de septiembre de 2026): escena humana vs. intervención de Lilly 360
Encargo del propio Andrés: «La Historia» debe sentirse como el día del Dr. Óscar Martínez, y el momento en
que Lilly 360 aparece debe leerse como una intervención digital, no como otro capítulo de su vida. Antes,
las escenas humanas y las láminas «qué hizo» compartían el mismo cascarón de tarjeta (`.hist-sec`: borde,
fondo, radio de 26px, ritmo simétrico), así que la solución se leía como "más de lo mismo". Se resolvió con
dos clases modificadoras que conviven con las que ya existían, sin tocar la mecánica de alternancia par/impar
ni la rejilla base:

- **`.hist-sec--humana`** (escenas de Óscar: `cap-oscar`, `cap-necesidades`, `cap-rapida`, `cap-formacion`,
  `cap-noche`, `cap-colegas`). Quita el cascarón de tarjeta (`border:0; background:none; border-radius:0;
  overflow:visible`) y abre la proporción columna/foto a `.9fr / 1.24fr` en escritorio: la fotografía manda,
  el texto respira sin caja. `.hist-hora` (Inicio de la jornada, 9:00 a. m., Mediodía, Al final del día) ancla
  cada escena en el reloj del día con un punto **neutro**, no rojo — el rojo se reserva por completo para
  cuando interviene Lilly 360. Cada escena que termina en una necesidad sin resolver (`cap-rapida`,
  `cap-formacion`) cierra con `.hist-hilo-rojo`: una línea con un punto rojo que pulsa, la única cosa roja en
  toda la escena, anticipando que algo va a intervenir.
- **`.hist-sec--intervencion`** (`cap-busqueda`, `cap-valor`, ambas ya `.hist-sec--proto`). Añade un tinte
  rojo casi imperceptible (`rgba(213,43,30,.08)` en degradado, no un fondo rojo sólido — el encargo pedía la
  señal roja como jerarquía, no la sección entera en rojo), borde con el mismo rojo, y un `margin-top`
  negativo que reduce el aire con la escena anterior (efecto de solape leve, no un recorte real de la foto:
  no hay forma de probarlo visualmente desde esta sesión, así que se optó por el ajuste más conservador que
  cumple la intención). Abre con `.hist-puente` — la frase obligatoria «En ese momento, Lilly 360 entra en su
  día.» con un punto rojo que repite el pulso de `.hist-hilo-rojo`, como si la señal de la escena anterior se
  "recogiera" aquí. Las notas pasan de la rejilla de cuatro celdas iguales (`.hist-notas`/`.hist-nota`, que
  sigue existiendo para otras láminas) a `.hist-notas--anotacion`/`.hist-nota--anotacion`: píldoras cortas y
  numeradas que aparecen en cascada (`transition-delay` escalonado bajo `.is-dentro`), no una explicación
  larga. Cierra con `.hist-resultado`: la frase de resultado que antes vivía al final de la escena humana se
  movió aquí, porque es la consecuencia de la intervención, no de la escena — lleva su propia etiqueta
  («Resultado») y un acento rojo a la izquierda, en vez de ser un párrafo más.

Las animaciones también se diferenciaron: las escenas humanas siguen con el revelado que ya existía (foto en
mosaico, `.hist-anim` con `translateY`); las intervenciones activan además el pulso rojo del punto puente y
la cascada de anotaciones. Se extendió el stagger existente (`.is-dentro .hist-anim:nth-child(2)/(3)`) a
`nth-child(4)` y `(5)` porque las láminas de intervención tienen más hermanos directos (puente, título,
cápsula, resultado) que las dos hermanas de una escena humana.

`cap-momentos` (el cierre «Por qué lo proponemos») no se marcó con ninguna de las dos clases a propósito: no
es una escena de Óscar ni una intervención puntual, es la síntesis de ambas — se deja con su tratamiento
`--cierre` existente.
