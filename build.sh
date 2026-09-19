#!/bin/sh
# Une las piezas de src/ en index.html. Cada pantalla vive en su archivo para que varias personas (o agentes) editen sin pisarse.
cd "$(dirname "$0")"
{
  cat src/00-shell-inicio.html src/10-inicio.html src/20-tema.html src/30-detalle.html src/40-formacion.html src/50-pieza.html src/60-guardados.html src/70-perfil.html src/75-registro.html src/80-shell-cierre.html src/85-historia.html src/90-fin.html
  printf '\n<script src="src/app.js?v=%s"></script>\n</body>\n</html>\n' "$(date +%Y%m%d%H%M)"
} > index.html
echo "index.html generado"
