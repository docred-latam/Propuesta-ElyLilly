// Persona (AI Elements, variante halo) para todos los orbes de IA. Registro fuera del componente para que Alpine no envuelva
// las instancias de Rive en proxies; se poda solo: las instancias cuyo elemento ya no está en el DOM se destruyen.
const PERSONA_LILLY = ['#D52B1E', '#F0705E', '#F8C9CF', '#FFF4F1', '#CFE0FA', '#1F5FA8', '#6B4FBF'];
// Los orbes pequeños (≤ 40 px) usan una paleta sin paradas claras: a ese tamaño el anillo fino se perdía sobre el disco blanco.
const PERSONA_LILLY_MINI = ['#D52B1E', '#E24D3E', '#C8102E', '#6B4FBF', '#1F5FA8', '#3772B7', '#D52B1E'];
const _personas = [];
function podarPersonas() { for (let i = _personas.length - 1; i >= 0; i--) if (!_personas[i].el.isConnected) { try { _personas[i].p.destruir(); } catch (_) {} _personas.splice(i, 1); } }

function app() {
  return {
    solo: false, // con ?solo=1 queda solo el teléfono sobre negro
    dispositivo: 'iphone', // 'iphone' | 'ipad' | 'desktop' — el marco del prototipo; el contenido se adapta con container queries (@3xl tablet, @6xl escritorio)
    // La presentación arranca por la historia; con ?p=inicio se entra directo al app.
    pantalla: 'historia', enfermedad: 'diabetes', tab: 'diagnostico', formato: 'todos',
    detalle: {}, pieza: {}, respuesta: null, historial: [], guia: true,
    // Cascarón iOS: dirección de la transición, contador que la re-dispara, texto de la Dynamic Island y si el contenido está desplazado.
    direccion: 'adelante', transicion: 0, island: '', scrolled: false,
    // Marcos del prototipo (tamaño exterior en px) y tamaño de la ventana para escalarlos a la vista.
    dispositivos: [ { id: 'iphone', nombre: 'Mobile' }, { id: 'ipad', nombre: 'Tablet' }, { id: 'desktop', nombre: 'Desktop' } ],
    marcos: { iphone: { w: 460, h: 976 }, ipad: { w: 1230, h: 870 }, desktop: { w: 1440, h: 900 } },
    ventana: { w: window.innerWidth, h: window.innerHeight },
    // Hoja inferior tipo Maps (iPhone): detent small | medium | large; `y` es dónde queda el borde superior de la hoja medido
    // desde el pie de la pantalla; `alturas` es ese valor por detent y `gaps` el aire bajo la tarjeta (en small flota sobre la tab bar).
    hoja: { detent: 'small', y: 167, arrastrando: false, movio: false, texto: '', enfermedad: null, detentPrevio: null, alturas: { small: 167, medium: 535, large: 894 }, gaps: { small: 82, medium: 4, large: 0 } },
    recientes: [
      { titulo: 'Tratamiento farmacológico de la diabetes tipo 2', tipo: 'Algoritmo', enfermedad: 'diabetes', tab: 'tratamiento' },
      { titulo: 'Escalas de severidad: EASI, SCORAD e IGA', tipo: 'Tabla', enfermedad: 'derma', tab: 'diagnostico' },
      { titulo: 'Clasificación BI-RADS', tipo: 'Tabla', enfermedad: 'mama', tab: 'diagnostico' },
      { titulo: 'Metas glucémicas individualizadas', tipo: 'Tabla', enfermedad: 'diabetes', tab: 'tratamiento' },
      { titulo: 'Criterios para escalar a terapia sistémica', tipo: 'Algoritmo', enfermedad: 'derma', tab: 'tratamiento' },
    ],
    // Consulta al RAG (simulada, fase 2): foco del campo, texto escrito, estado idle | pensando | respuesta y la pregunta enviada.
    rag: { foco: false, texto: '', estado: 'idle', pregunta: '', abierto: false, modo: 'texto', hilo: [], escuchando: false, dictado: [], fuentesAbierto: false, contexto: '', hablando: false,
      fuentes: [
        { n: 'Estudios clínicos aprobados por Lilly', on: true, fijo: true },
        { n: 'Guías de práctica clínica', on: true },
        { n: 'Información para prescribir', on: false },
        { n: 'Contenido de Formación ágil', on: false },
      ] },
    ragBanco: {
      diabetes: [
        { p: 'Meta de HbA1c en adulto mayor', pieza: 'Metas glucémicas', titulo: 'Meta de HbA1c en el adulto mayor', cuerpo: 'En adultos mayores frágiles o con hipoglucemias previas la meta se relaja a menos de 8 %; en adultos mayores sanos puede mantenerse por debajo de 7,5 %.' },
        { p: 'Cuándo iniciar insulina basal', pieza: 'Tratamiento farmacológico', titulo: 'Cuándo iniciar insulina basal', cuerpo: 'Se considera con HbA1c mayor de 10 %, glucemia mayor de 300 mg/dL o síntomas catabólicos, y cuando dos agentes no alcanzan la meta a las 12 semanas.' },
        { p: 'Interacciones con metformina', pieza: 'Manejo del paciente con obesidad', titulo: 'Interacciones relevantes de la metformina', cuerpo: 'Vigilar el medio de contraste yodado, el alcohol y los diuréticos de asa por el riesgo de acidosis láctica; ajustar la dosis según la tasa de filtración glomerular.' },
      ],
      mama: [
        { p: 'Criterios de alto riesgo en monarchE', pieza: 'Tratamiento del cáncer de mama', titulo: 'Alto riesgo en monarchE', cuerpo: 'Cuatro o más ganglios positivos, o de uno a tres ganglios con tumor de 5 cm o más o grado histológico 3, definen la cohorte de alto riesgo.' },
        { p: 'Manejo de la diarrea por CDK4/6', pieza: 'Manejo de eventos adversos', titulo: 'Diarrea por inhibidores de CDK4/6', cuerpo: 'Iniciar loperamida con el primer episodio de heces blandas, hidratar y ajustar la dosis solo si la diarrea alcanza grado 2 persistente o grado 3.' },
        { p: 'Duración de la terapia endocrina', pieza: 'Seguimiento posterior', titulo: 'Duración de la terapia endocrina', cuerpo: 'Cinco años como base; extender a diez en pacientes con ganglios positivos o alto riesgo de recaída tardía, valorando tolerancia y adherencia.' },
      ],
      derma: [
        { p: 'Cuándo escalar a terapia sistémica', pieza: 'Criterios para escalar', titulo: 'Cuándo escalar a terapia sistémica', cuerpo: 'Cuando el tratamiento tópico optimizado, incluida la terapia proactiva, no controla la enfermedad y hay impacto en el sueño o la calidad de vida.' },
        { p: 'Potencia del corticoide por zona', pieza: 'Emolientes y corticoides', titulo: 'Potencia del corticoide según la zona', cuerpo: 'Baja potencia en cara, pliegues y genitales; media en tronco y extremidades; alta solo en placas liquenificadas de manos y pies por ciclos cortos.' },
        { p: 'Terapia proactiva: frecuencia', pieza: 'Tratamiento escalonado', titulo: 'Frecuencia de la terapia proactiva', cuerpo: 'Dos aplicaciones por semana en las zonas de brote habitual, una vez controlado el brote, con emoliente diario en el resto de la piel.' },
      ],
    },

    // El separador marca dónde se sale del app: lo de la derecha ocurre en otra plataforma.
    atajos: [
      { id: 'historia', nombre: 'La historia' },
      { id: 'registro', nombre: 'Registro' },
      { id: 'inicio', nombre: 'Home' },
      { id: 'tema', nombre: 'Búsqueda rápida' },
      { id: 'formacion', nombre: 'Formación ágil' },
      { sep: true },
      { id: 'dashboard', nombre: 'Back office' },
      { id: 'arquitectura', nombre: 'Arquitectura' },
    ],
    // Pantallas «de sistema» dentro del teléfono sin tab bar, hoja ni sidebar (registro es el momento 0). El back office ya no vive
    // en el teléfono: la <section> del marco se oculta entera y `dispositivo` no se altera.
    sinCascaron: ['registro'],
    tabs: [ { id: 'diagnostico', nombre: 'Diagnóstico' }, { id: 'tratamiento', nombre: 'Tratamiento' }, { id: 'infografias', nombre: 'Infografías' } ],
    tabBar: [ { id: 'inicio', nombre: 'Inicio', icono: 'house' }, { id: 'guardados', nombre: 'Guardados', icono: 'bookmark' }, { id: 'perfil', nombre: 'Perfil', icono: 'user-round' } ],
    // Contrato compartido (revisión UX): guardados alimenta el bookmark de la nav bar y la pantalla Guardados; el HUD confirma acciones.
    guardados: [], tabMin: false, cargando: false, inicioPrimeraVez: true,
    // Contrato compartido: `modal` en true oculta la tab bar (lo pone el agente de Pieza al subir su hoja de pregunta).
    modal: false,
    perfil: { notificaciones: true, envivo: true, intereses: ['diabetes', 'mama'] },
    formatos: [ { id: 'todos', nombre: 'Todo', icono: 'layout-grid' }, { id: 'video', nombre: 'Video', icono: 'play-circle' }, { id: 'live', nombre: 'En vivo', icono: 'radio' }, { id: 'pdf', nombre: 'Estudio PDF', icono: 'file-text' }, { id: 'info', nombre: 'Infografía', icono: 'image' }, { id: 'encuesta', nombre: 'Encuesta', icono: 'list-checks' } ],

    enfermedades: {
      diabetes: { nombre: 'Diabetes tipo 2', corto: 'Diabetes', area: 'Endocrinología', icono: 'droplet', portada: 'img/diabetes-portada.jpg', hero: 'img/webinar-endocrino.jpg', producto: 'Mounjaro', principio: 'tirzepatida',
        borde: 'border-diabetes/40', chip: 'bg-lillyblue-soft text-lillyblue', soft: 'bg-lillyblue-soft', texto: 'text-lillyblue', formacionSub: 'Webinar hoy 6:00 pm · 12 contenidos nuevos' },
      mama: { nombre: 'Cáncer de mama', corto: 'C. de mama', area: 'Oncología', icono: 'ribbon', portada: 'img/mama-portada.jpg', hero: 'img/webinar-oncologo.jpg', producto: 'Verzenio', principio: 'abemaciclib',
        borde: 'border-mama/40', chip: 'bg-lillyblue-soft text-lillyblue', soft: 'bg-lillyblue-soft', texto: 'text-lillyblue', formacionSub: 'Nuevo estudio fase 3 · 8 contenidos nuevos' },
      derma: { nombre: 'Dermatitis atópica', corto: 'Dermatitis', area: 'Dermatología', icono: 'hand', portada: 'img/derma-portada.jpg', hero: 'img/webinar-derma.jpg', producto: 'Ebglyss', principio: 'lebrikizumab',
        borde: 'border-derma/40', chip: 'bg-lillyblue-soft text-lillyblue', soft: 'bg-lillyblue-soft', texto: 'text-lillyblue', formacionSub: 'Podcast nuevo · 6 contenidos nuevos' },
    },

    contenido: {
      diabetes: {
        diagnostico: [
          { tipo: 'Algoritmo', titulo: 'Criterios diagnósticos de diabetes tipo 2 y prediabetes', minutos: 4, fecha: '12 ago 2026' },
          { tipo: 'Tabla', titulo: 'Interpretación de HbA1c, glucemia en ayunas y prueba de tolerancia', minutos: 3, fecha: '30 jul 2026' },
          { tipo: 'Guía', titulo: 'Tamizaje en adultos con factores de riesgo cardiometabólico', minutos: 6, fecha: '18 jun 2026' },
          { tipo: 'Tabla', titulo: 'Cribado de complicaciones: retinopatía, nefropatía y pie diabético', minutos: 4, fecha: '22 ago 2026' },
        ],
        tratamiento: [
          { tipo: 'Algoritmo', titulo: 'Tratamiento farmacológico de la diabetes tipo 2 según perfil del paciente', minutos: 5, fecha: '02 sep 2026' },
          { tipo: 'Tabla', titulo: 'Metas glucémicas individualizadas y frecuencia de control', minutos: 3, fecha: '15 ago 2026' },
          { tipo: 'Algoritmo', titulo: 'Manejo del paciente con obesidad y enfermedad cardiovascular establecida', minutos: 5, fecha: '21 jul 2026' },
          { tipo: 'Guía', titulo: 'Inicio y titulación de insulina basal en consulta externa', minutos: 5, fecha: '28 ago 2026' },
        ],
        infografias: [
          { tipo: 'Infografía', titulo: '¿Qué es la diabetes tipo 2? Guía para el paciente', minutos: 2, fecha: '05 sep 2026' },
          { tipo: 'Infografía', titulo: 'Plato saludable y actividad física: recomendaciones semanales', minutos: 2, fecha: '20 ago 2026' },
          { tipo: 'Infografía', titulo: 'Señales de alarma de hipoglucemia: qué hacer en casa', minutos: 2, fecha: '01 jul 2026' },
        ],
      },
      mama: {
        diagnostico: [
          { tipo: 'Algoritmo', titulo: 'Abordaje de la masa mamaria palpable en atención primaria', minutos: 4, fecha: '28 ago 2026' },
          { tipo: 'Tabla', titulo: 'Clasificación BI-RADS y conducta según categoría', minutos: 3, fecha: '10 ago 2026' },
          { tipo: 'Guía', titulo: 'Tamizaje según riesgo: edad de inicio e intervalos', minutos: 5, fecha: '22 jun 2026' },
          { tipo: 'Algoritmo', titulo: 'Estudio de la paciente con mamografía BI-RADS 4', minutos: 4, fecha: '15 ago 2026' },
        ],
        tratamiento: [
          { tipo: 'Algoritmo', titulo: 'Tratamiento del cáncer de mama HR+/HER2− temprano de alto riesgo', minutos: 6, fecha: '04 sep 2026' },
          { tipo: 'Tabla', titulo: 'Manejo de eventos adversos frecuentes en terapia endocrina', minutos: 4, fecha: '19 ago 2026' },
          { tipo: 'Algoritmo', titulo: 'Seguimiento posterior al tratamiento adyuvante', minutos: 4, fecha: '07 jul 2026' },
          { tipo: 'Guía', titulo: 'Terapia endocrina adyuvante: elección según estado menopáusico', minutos: 5, fecha: '26 ago 2026' },
        ],
        infografias: [
          { tipo: 'Infografía', titulo: 'Autoexamen de mama: paso a paso', minutos: 2, fecha: '03 sep 2026' },
          { tipo: 'Infografía', titulo: 'Qué esperar durante la terapia endocrina', minutos: 2, fecha: '25 jul 2026' },
          { tipo: 'Infografía', titulo: 'Diarrea durante el tratamiento: cuándo consultar', minutos: 2, fecha: '11 jun 2026' },
        ],
      },
      derma: {
        diagnostico: [
          { tipo: 'Algoritmo', titulo: 'Criterios diagnósticos de dermatitis atópica en adultos y adolescentes', minutos: 4, fecha: '26 ago 2026' },
          { tipo: 'Tabla', titulo: 'Escalas de severidad: EASI, SCORAD e IGA', minutos: 3, fecha: '08 ago 2026' },
          { tipo: 'Guía', titulo: 'Diagnóstico diferencial con psoriasis y dermatitis de contacto', minutos: 5, fecha: '15 jun 2026' },
          { tipo: 'Tabla', titulo: 'Signos de infección secundaria en el eccema: cuándo cultivar', minutos: 3, fecha: '20 ago 2026' },
        ],
        tratamiento: [
          { tipo: 'Algoritmo', titulo: 'Tratamiento escalonado de la dermatitis atópica moderada a severa', minutos: 5, fecha: '06 sep 2026' },
          { tipo: 'Tabla', titulo: 'Emolientes y corticoides tópicos: potencia y zonas de aplicación', minutos: 3, fecha: '12 ago 2026' },
          { tipo: 'Algoritmo', titulo: 'Criterios para escalar a terapia sistémica', minutos: 4, fecha: '09 jul 2026' },
          { tipo: 'Guía', titulo: 'Manejo del prurito nocturno y del sueño en dermatitis atópica', minutos: 4, fecha: '30 ago 2026' },
        ],
        infografias: [
          { tipo: 'Infografía', titulo: 'Rutina de cuidado de la piel en dermatitis atópica', minutos: 2, fecha: '01 sep 2026' },
          { tipo: 'Infografía', titulo: 'Desencadenantes frecuentes y cómo evitarlos', minutos: 2, fecha: '23 jul 2026' },
          { tipo: 'Infografía', titulo: 'Cómo aplicar correctamente un tratamiento tópico', minutos: 2, fecha: '14 jun 2026' },
        ],
      },
    },

    algoritmos: {
      diabetes: { raiz: 'Tratamiento de la diabetes tipo 2', ramas: [
        { nombre: 'Estilo de vida', color: 'bg-sky-500', suave: 'bg-sky-50 text-sky-900', nodos: ['Educación en diabetes y plan de alimentación individualizado', 'Actividad física 150 min/semana', 'Meta de reducción de peso ≥ 5 %'] },
        { nombre: 'Farmacológico inicial', color: 'bg-violet-600', suave: 'bg-violet-50 text-violet-900', nodos: ['Metformina 500–2000 mg/día si no hay contraindicación', 'HbA1c ≥ 1,5 % sobre meta: terapia dual desde el inicio', 'Revalorar a las 12 semanas'] },
        { nombre: 'Con comorbilidad', color: 'bg-indigo-900', suave: 'bg-indigo-50 text-indigo-900', nodos: ['ECV establecida o alto riesgo: agonista GLP-1 o iSGLT2 con beneficio demostrado', 'Falla cardiaca o ERC: iSGLT2', 'Obesidad: priorizar agentes con pérdida de peso'] },
        { nombre: 'Intensificación', color: 'bg-red-500', suave: 'bg-red-50 text-red-900', nodos: ['Fuera de meta a las 12 semanas: agregar segundo agente', 'HbA1c > 10 % o síntomas: considerar insulina basal', 'Evitar inercia terapéutica'] },
      ], notas: ['ECV, enfermedad cardiovascular. ERC, enfermedad renal crónica. iSGLT2, inhibidores del cotransportador sodio-glucosa tipo 2.', '* Ajustar dosis según tasa de filtración glomerular.', '** Las metas de HbA1c se individualizan según edad, comorbilidades y riesgo de hipoglucemia.'],
        referencia: 'American Diabetes Association. Standards of Care in Diabetes—2026. Diabetes Care. 2026;49(Suppl 1). Adaptación editorial para Lilly 360 Colombia.' },
      mama: { raiz: 'Tratamiento HR+/HER2− temprano', ramas: [
        { nombre: 'Estadificación', color: 'bg-sky-500', suave: 'bg-sky-50 text-sky-900', nodos: ['Confirmar receptores hormonales y HER2', 'Ganglios, tamaño y grado tumoral', 'Ki-67 cuando esté disponible'] },
        { nombre: 'Riesgo estándar', color: 'bg-violet-600', suave: 'bg-violet-50 text-violet-900', nodos: ['Cirugía conservadora o mastectomía', 'Radioterapia según indicación', 'Terapia endocrina 5 a 10 años'] },
        { nombre: 'Alto riesgo', color: 'bg-indigo-900', suave: 'bg-indigo-50 text-indigo-900', nodos: ['≥ 4 ganglios, o 1–3 ganglios con tumor ≥ 5 cm o grado 3', 'Considerar inhibidor de CDK4/6 adyuvante por 2 años', 'Quimioterapia según perfil'] },
        { nombre: 'Seguimiento', color: 'bg-red-500', suave: 'bg-red-50 text-red-900', nodos: ['Control clínico cada 3–6 meses los primeros 3 años', 'Mamografía anual', 'Vigilar diarrea y neutropenia si hay CDK4/6'] },
      ], notas: ['HR+, receptores hormonales positivos. CDK4/6, cinasas dependientes de ciclina 4 y 6.', '* La decisión de terapia adyuvante se toma en junta multidisciplinaria.'],
        referencia: 'NCCN Clinical Practice Guidelines in Oncology: Breast Cancer, v.3.2026. Adaptación editorial para Lilly 360 Colombia.' },
      derma: { raiz: 'Tratamiento escalonado de la dermatitis atópica', ramas: [
        { nombre: 'Base (todos)', color: 'bg-sky-500', suave: 'bg-sky-50 text-sky-900', nodos: ['Emolientes 2 veces al día', 'Evitar desencadenantes e irritantes', 'Educación del paciente y cuidador'] },
        { nombre: 'Leve', color: 'bg-violet-600', suave: 'bg-violet-50 text-violet-900', nodos: ['Corticoide tópico de baja o media potencia', 'Inhibidor de calcineurina en cara y pliegues', 'Antihistamínico solo si hay prurito nocturno'] },
        { nombre: 'Moderada', color: 'bg-indigo-900', suave: 'bg-indigo-50 text-indigo-900', nodos: ['Corticoide tópico de alta potencia en brotes', 'Terapia proactiva 2 veces por semana', 'Fototerapia si está disponible'] },
        { nombre: 'Severa', color: 'bg-red-500', suave: 'bg-red-50 text-red-900', nodos: ['Falla a tópicos optimizados: terapia sistémica', 'Biológico anti-IL-13 o anti-IL-4/13', 'Inhibidor de JAK según perfil de riesgo'] },
      ], notas: ['IL, interleucina. JAK, cinasa Janus.', '* Severidad según EASI o SCORAD y afectación de calidad de vida.'],
        referencia: 'Wollenberg A, et al. European guideline (EuroGuiDerm) on atopic eczema, 2025 update. JEADV. Adaptación editorial para Lilly 360 Colombia.' },
    },

    formacion: {
      diabetes: [
        { formato: 'live', imagen: 'img/webinar-endocrino.jpg', titulo: 'Tirzepatida en la práctica: casos clínicos de la consulta real', autor: 'Dra. Ana Rojas · Endocrinóloga · Hoy 6:00 pm', fecha: 'Hoy', duracion: '60 min', pregunta: '¿Cuál es el primer paso ante un paciente con HbA1c de 9,2 % y obesidad?', opciones: ['Insulina basal de inmediato', 'Metformina más un agente con beneficio en peso', 'Solo cambios en el estilo de vida'], correcta: 1, explicacion: 'Con HbA1c 1,5 % por encima de meta se recomienda terapia dual desde el inicio.', resumen: 'Sesión en vivo con revisión de tres casos de consulta y espacio de preguntas con la experta.' },
        { formato: 'video', imagen: 'img/oscar-tablet.jpg', titulo: 'Metas glucémicas: cómo individualizar en el adulto mayor', autor: 'Dr. Julián Mesa · Medicina interna', fecha: '10 sep 2026', duracion: '15 min', progreso: 35, pregunta: '¿Qué meta de HbA1c es razonable en un adulto mayor frágil con hipoglucemias previas?', opciones: ['< 6,5 %', '< 7 %', '< 8 %'], correcta: 2, explicacion: 'En pacientes frágiles se relaja la meta para reducir el riesgo de hipoglucemia.', resumen: 'Microaprendizaje de 15 minutos sobre cómo ajustar las metas de control según fragilidad, expectativa de vida y riesgo de hipoglucemia.' },
        { formato: 'pdf', imagen: 'img/estudio-pdf.jpg', titulo: 'SURPASS-2: tirzepatida frente a semaglutida en diabetes tipo 2', autor: 'Estudio clínico · NEJM 2021', fecha: '03 sep 2026', duracion: '18 pág.', pregunta: '¿Cuál fue el desenlace primario del estudio?', opciones: ['Cambio en HbA1c a la semana 40', 'Eventos cardiovasculares mayores', 'Cambio de peso a la semana 52'], correcta: 0, explicacion: 'El desenlace primario fue el cambio en HbA1c desde el inicio a la semana 40.', resumen: 'Resumen estructurado del estudio con tablas de eficacia, seguridad y aplicabilidad a la práctica en Colombia.' },
        { formato: 'info', imagen: 'img/diabetes-portada.jpg', titulo: 'Interpretación rápida del monitoreo continuo de glucosa', autor: 'Comité editorial Lilly', fecha: '28 ago 2026', pregunta: '¿Qué porcentaje de tiempo en rango se considera meta para la mayoría de adultos?', opciones: ['> 50 %', '> 70 %', '> 90 %'], correcta: 1, explicacion: 'La meta general es más del 70 % del tiempo entre 70 y 180 mg/dL.', resumen: 'Infografía interactiva con los indicadores del reporte de glucosa y su lectura clínica.' },
        { formato: 'encuesta', imagen: 'img/junta-medica.jpg', titulo: '¿Qué barreras encuentras para iniciar terapia inyectable?', autor: 'Encuesta a la comunidad · 2 min', fecha: '25 ago 2026', pregunta: '¿Cuál es la principal barrera en tu consulta?', opciones: ['Costo y acceso', 'Temor del paciente a la inyección', 'Falta de tiempo para educar'], correcta: 0, explicacion: 'Gracias por tu respuesta. Los resultados agregados se publican el próximo mes.', resumen: 'Encuesta breve para conocer las barreras reales en la práctica y orientar los próximos contenidos.' },
        { formato: 'video', imagen: 'img/junta-medica.jpg', titulo: 'Insulinización en 10 minutos: técnica, dosis inicial y titulación', autor: 'Dra. Ana Rojas · Endocrinóloga', fecha: '05 sep 2026', duracion: '12 min', progreso: 0, pregunta: '¿Cuál es la dosis inicial habitual de insulina basal?', opciones: ['0,1–0,2 U/kg/día', '0,5 U/kg/día', '1 U/kg/día'], correcta: 0, explicacion: 'Se inicia con 10 U o 0,1–0,2 U/kg y se titula cada 3 días según la glucemia en ayunas.', resumen: 'Microaprendizaje práctico con demostración de dispositivos y esquema de titulación.' },
        { formato: 'pdf', imagen: 'img/estudio-pdf.jpg', titulo: 'SURMOUNT-1: tirzepatida en obesidad sin diabetes', autor: 'Estudio clínico · NEJM 2022', fecha: '20 ago 2026', duracion: '14 pág.', pregunta: '¿Cuál fue la reducción media de peso a la semana 72 con la dosis más alta?', opciones: ['Cerca del 5 %', 'Cerca del 12 %', 'Cerca del 21 %'], correcta: 2, explicacion: 'La dosis de 15 mg alcanzó cerca del 21 % de reducción de peso.', resumen: 'Resumen estructurado con eficacia, seguridad y aplicabilidad a la práctica.' },
      ],
      mama: [
        { formato: 'video', imagen: 'img/webinar-oncologo.jpg', titulo: 'monarchE a 5 años: qué cambia en el adyuvante de alto riesgo', autor: 'Dr. Camilo Peña · Oncólogo clínico', fecha: '08 sep 2026', duracion: '22 min', progreso: 60, pregunta: '¿Cuánto dura el tratamiento adyuvante con inhibidor de CDK4/6 en monarchE?', opciones: ['1 año', '2 años', '5 años'], correcta: 1, explicacion: 'El esquema adyuvante fue de dos años, sumado a la terapia endocrina.', resumen: 'Revisión de los resultados de seguimiento y su impacto en la selección de pacientes.' },
        { formato: 'live', imagen: 'img/junta-medica.jpg', titulo: 'Junta multidisciplinaria abierta: casos de alto riesgo', autor: 'Fundación Santa Fe · Jueves 7:00 pm', fecha: 'Jueves', duracion: '90 min', pregunta: '¿Qué criterio define alto riesgo en monarchE?', opciones: ['Cualquier ganglio positivo', '≥ 4 ganglios, o 1–3 con tumor ≥ 5 cm o grado 3', 'Solo Ki-67 elevado'], correcta: 1, explicacion: 'La cohorte 1 se definió por carga ganglionar, tamaño y grado.', resumen: 'Sesión en vivo con discusión de casos reales y votación interactiva.' },
        { formato: 'pdf', imagen: 'img/estudio-pdf.jpg', titulo: 'Manejo de la diarrea inducida por inhibidores de CDK4/6', autor: 'Guía de práctica · ESMO 2025', fecha: '30 ago 2026', duracion: '12 pág.', pregunta: '¿Cuándo se inicia loperamida?', opciones: ['Con el primer episodio de heces blandas', 'Solo en diarrea grado 3', 'Nunca de forma profiláctica'], correcta: 0, explicacion: 'El manejo temprano reduce la necesidad de ajustar la dosis.', resumen: 'Guía práctica con algoritmo de manejo por grado y recomendaciones para el paciente.' },
        { formato: 'info', imagen: 'img/mama-portada.jpg', titulo: 'Terapia endocrina: adherencia y efectos adversos frecuentes', autor: 'Comité editorial Lilly', fecha: '20 ago 2026', pregunta: '¿Qué porcentaje de pacientes abandona la terapia endocrina antes de 5 años?', opciones: ['Cerca del 10 %', 'Entre 30 y 50 %', 'Más del 80 %'], correcta: 1, explicacion: 'La no adherencia es frecuente y se asocia con peor supervivencia.', resumen: 'Infografía para la consulta con estrategias de apoyo a la adherencia.' },
        { formato: 'video', imagen: 'img/oscar-tablet.jpg', titulo: 'Cómo leer un reporte de patología mamaria en 8 minutos', autor: 'Dra. Marcela Ruiz · Patóloga', fecha: '02 sep 2026', duracion: '8 min', progreso: 0, pregunta: '¿Qué define el subtipo HER2 positivo?', opciones: ['Ki-67 mayor de 20 %', 'HER2 3+ por inmunohistoquímica o amplificación por ISH', 'Receptores hormonales negativos'], correcta: 1, explicacion: 'HER2 positivo es inmunohistoquímica 3+ o amplificación por hibridación in situ.', resumen: 'Guía visual del reporte: receptores, HER2, grado histológico y Ki-67.' },
        { formato: 'encuesta', imagen: 'img/junta-medica.jpg', titulo: '¿Con qué frecuencia remites a junta multidisciplinaria?', autor: 'Encuesta a la comunidad · 1 min', fecha: '12 ago 2026', pregunta: '¿Cuándo remites a junta?', opciones: ['Siempre, antes de iniciar tratamiento', 'Solo en casos de alto riesgo', 'Casi nunca, por falta de acceso'], correcta: 0, explicacion: 'Gracias por tu respuesta. Los resultados agregados se publican el próximo mes.', resumen: 'Encuesta breve para orientar los próximos ateneos.' },
      ],
      derma: [
        { formato: 'video', imagen: 'img/webinar-derma.jpg', titulo: 'Anti-IL-13 en dermatitis atópica: a quién y cuándo', autor: 'Dra. Laura Gómez · Dermatóloga', fecha: '09 sep 2026', duracion: '18 min', progreso: 20, pregunta: '¿Cuál es el criterio principal para escalar a terapia sistémica?', opciones: ['Cualquier brote', 'Falla a tópicos optimizados con impacto en calidad de vida', 'Solo si hay asma asociada'], correcta: 1, explicacion: 'Se escala cuando el tratamiento tópico bien hecho no controla la enfermedad.', resumen: 'Microaprendizaje con criterios de selección, monitoreo y expectativas de respuesta.' },
        { formato: 'pdf', imagen: 'img/estudio-pdf.jpg', titulo: 'ADvocate 1 y 2: lebrikizumab en dermatitis atópica moderada a severa', autor: 'Estudio clínico · NEJM 2023', fecha: '01 sep 2026', duracion: '16 pág.', pregunta: '¿Cuál fue el desenlace primario a la semana 16?', opciones: ['IGA 0/1 con reducción ≥ 2 puntos', 'Prurito NRS', 'SCORAD 50'], correcta: 0, explicacion: 'El desenlace primario fue IGA 0/1 con mejoría de al menos 2 puntos.', resumen: 'Resumen estructurado del estudio con tablas de eficacia y seguridad.' },
        { formato: 'live', imagen: 'img/noche-lectura.jpg', titulo: 'Podcast en vivo: piel, sueño y salud mental en el paciente con eccema', autor: 'Con la Dra. Gómez y un paciente invitado', fecha: 'Martes', duracion: '45 min', pregunta: '¿Qué escala mide el impacto en calidad de vida?', opciones: ['EASI', 'DLQI', 'IGA'], correcta: 1, explicacion: 'El DLQI mide el impacto dermatológico en la calidad de vida.', resumen: 'Conversación sobre el impacto del prurito en el sueño y el ánimo, con espacio de preguntas.' },
        { formato: 'info', imagen: 'img/derma-portada.jpg', titulo: 'Cómo aplicar terapia proactiva con corticoide tópico', autor: 'Comité editorial Lilly', fecha: '18 ago 2026', pregunta: '¿Con qué frecuencia se aplica en terapia proactiva?', opciones: ['Diario', '2 veces por semana en zonas de brote', 'Solo durante el brote'], correcta: 1, explicacion: 'La terapia proactiva mantiene el control con aplicación intermitente.', resumen: 'Infografía paso a paso para el paciente y su cuidador.' },
        { formato: 'video', imagen: 'img/oscar-tablet.jpg', titulo: 'EASI en 5 minutos: cómo puntuar en la consulta', autor: 'Dra. Laura Gómez · Dermatóloga', fecha: '27 ago 2026', duracion: '6 min', progreso: 0, pregunta: '¿Qué puntaje EASI define enfermedad moderada?', opciones: ['1 a 6', '7 a 21', 'Mayor de 21'], correcta: 1, explicacion: 'Un EASI de 7 a 21 corresponde a enfermedad moderada.', resumen: 'Demostración por regiones corporales con ejemplos fotográficos.' },
        { formato: 'encuesta', imagen: 'img/junta-medica.jpg', titulo: '¿Qué barrera pesa más para iniciar un biológico?', autor: 'Encuesta a la comunidad · 1 min', fecha: '10 ago 2026', pregunta: '¿Cuál es la principal barrera en tu consulta?', opciones: ['Autorización de la EPS', 'Temor a la inmunosupresión', 'Desconocimiento de los criterios'], correcta: 0, explicacion: 'Gracias por tu respuesta. Los resultados agregados se publican el próximo mes.', resumen: 'Encuesta breve para orientar el próximo webinar.' },
      ],
    },

    guias: {
      inicio: { foto: 'img/oscar-consulta.jpg', momento: 'Inicio · Lilly 360', titulo: 'Dos necesidades, un solo lugar', hora: 'Cualquier momento del día', historia: 'Óscar es médico. Atiende un paciente cada 20 minutos. Tiene dos necesidades constantes: resolver una duda exacta ya, y mantenerse actualizado cuando le queda un espacio. El inicio se organiza por esas dos necesidades, no por productos.', puntos: ['Búsqueda rápida y Formación ágil como los dos bloques del home', 'Las tres enfermedades del brief como puerta de entrada, nunca la marca', 'Web responsive: se ve igual en el celular, la tablet y el computador'] },
      tema: { foto: 'img/maria-paciente.jpg', momento: 'Momento 1 · Búsqueda rápida', titulo: 'María tiene 54 años y una HbA1c de 9,2 %', hora: '9:00 – 11:00 am · en consulta', historia: 'María llega con el reporte de laboratorio. Óscar necesita decidir el tratamiento en los próximos cinco minutos. Entra a la enfermedad, elige Tratamiento y encuentra el algoritmo sin buscar entre cien resultados.', puntos: ['Tres subniveles fijos: Diagnóstico, Tratamiento e Infografías para pacientes', 'Cada pieza dice qué es, cuánto toma y cuándo se actualizó', 'La barra del RAG interno consulta solo los estudios aprobados por Lilly (fase 2)'] },
      detalle: { foto: 'img/oscar-tablet.jpg', momento: 'Momento 1 · Pieza gráfica', titulo: 'El algoritmo de decisión en una pantalla', hora: '9:00 – 11:00 am · en consulta', historia: 'Óscar recorre las ramas de arriba abajo: estilo de vida, farmacológico inicial, comorbilidad, intensificación. María tiene obesidad y riesgo cardiovascular, así que abre la tercera rama y ahí está la respuesta. Lo guarda con un toque para la próxima consulta.', puntos: ['Contenido médico: habla de la enfermedad y del principio activo, no de la marca', 'Referencia bibliográfica y notas al pie en cada pieza', 'Cada rama se abre y se cierra como una lista nativa: nada de diagramas que hay que arrastrar'] },
      formacion: { foto: 'img/almuerzo-tablet.jpg', momento: 'Momento 2 y 3 · Formación ágil', titulo: 'Óscar almuerza y tiene 30 minutos', hora: '12:00 – 12:30 pm · antes de dormir', historia: 'Ya no hay urgencia. Óscar quiere ver el webinar de la Dra. Rojas, leer el resumen de un estudio o terminar el microaprendizaje que dejó al 35 %. Todo está en el canal de la enfermedad, en el formato que le sirva en ese momento.', puntos: ['Multiformato: video on demand, en vivo, estudio PDF, infografía y encuesta', 'Información para prescribir en una sección aparte: es contenido comercial', 'Cada consumo deja rastro para el dashboard de trazabilidad'] },
      registro: { foto: 'img/oscar-consulta.jpg', momento: 'Momento 0 · Registro', titulo: 'Cómo llega Óscar a Lilly 360', hora: 'Una sola vez, desde el correo de invitación', historia: 'Óscar recibe la invitación y se registra en cinco pantallas: correo, país y perfil profesional, consentimientos y listo. Los mismos datos que hoy pide Lilly Conexiones, pero una tarea por pantalla y sin cajas con borde negro.', puntos: ['Correo, Google o LinkedIn para entrar', 'Consentimientos con interruptores: solo el de privacidad es obligatorio', 'Termina con la cuenta verificada como profesional de la salud'] },
      historia: { foto: 'img/oscar-consulta.jpg', momento: 'La historia · Lo que entendimos', titulo: 'Un día con el Dr. Óscar', hora: 'Antes del producto, el problema', historia: 'La presentación arranca por el médico, no por la plataforma: qué le pasa a Óscar en un día, y qué hicimos en cada uno de sus cuatro momentos. Al final se entra al prototipo.', puntos: ['Dos necesidades: resolver ya, y mantenerse al día', 'Cuatro momentos, cuatro respuestas del producto', 'Las capturas salen del prototipo real, no de un mockup aparte'] },
      arquitectura: { foto: 'img/estudio-pdf.jpg', momento: 'Infraestructura · La propuesta técnica', titulo: 'Sobre qué se construye', hora: 'Equipo de Leonardo · fuera del app', historia: 'Esta es la lámina que se presenta al cliente, no una pantalla del app: la arquitectura que propone Leonardo. Todo corre sobre la nube de Lilly, con los tres ambientes que pide el brief, y cada pieza de terceros se paga por consumo.', puntos: ['El núcleo en AWS: aplicación, datos y medición', 'Passport y Auth0 para entrar; OCE y MLR para conectar con Lilly', 'Toca una pieza y explica por qué está ahí'] },
      dashboard: { foto: 'img/junta-medica.jpg', momento: 'Back office · Otra plataforma', titulo: 'Lo que Lilly ve', hora: 'Equipo de Lilly, fuera del app', historia: 'Esto no es el app del médico: es la herramienta de analítica (PostHog o la que defina Lilly) donde cae todo lo que Óscar hace. Cada toque, cada video visto y cada pregunta al RAG llega como evento, y el equipo de Lilly lo filtra por enfermedad y periodo para decidir el próximo contenido.', puntos: ['Fuera del app: otra herramienta, otro rol', 'Eventos, no pantallas: cada toque es un evento', 'Filtros por enfermedad y periodo para decidir contenido'] },
      guardados: { foto: 'img/estudio-pdf.jpg', momento: 'Biblioteca personal', titulo: 'Lo que Óscar marcó para volver', hora: 'Cualquier momento', historia: 'Cada bookmark de un algoritmo, una tabla o un video cae aquí. Es la lista corta que Óscar abre antes de la consulta o al final del día.', puntos: ['Se alimenta del bookmark de la nav bar', 'Abre la pieza en su pantalla: detalle o formación', 'Vacío honesto: dice qué hacer para llenarla'] },
      perfil: { foto: 'img/junta-medica.jpg', momento: 'Cuenta y preferencias', titulo: 'Óscar decide qué le llega', hora: 'Una vez, al empezar', historia: 'Especialidad verificada, intereses por enfermedad y qué notificaciones quiere. La información para prescribir vive aquí, aparte del contenido médico.', puntos: ['Intereses como chips: alimentan el Inicio y las notificaciones', 'Interruptores iOS reales para las notificaciones', 'Cerrar sesión e información legal al final, como en iOS'] },
      pieza: { foto: 'img/noche-lectura.jpg', momento: 'Momento 3 · Microaprendizaje', titulo: 'El contenido pregunta de vuelta', hora: '9:00 – 9:30 pm · antes de dormir', historia: 'A los cinco minutos el video se detiene y le hace una pregunta a Óscar. Si responde, suma para su certificado. Si no, el video sigue. Así el contenido no es un PDF que se lee de corrido, sino algo que conversa con el médico.', puntos: ['Interacciones dentro del contenido: preguntas, encuestas, casos', 'Progreso, certificado y ruta de aprendizaje', 'Guardar y compartir con colegas desde la misma pantalla'] },
    },

    get enf() { return this.enfermedades[this.enfermedad]; },
    get contenidoTema() { return this.contenido[this.enfermedad][this.tab]; },
    get algoritmo() { return this.algoritmos[this.enfermedad]; },
    get relacionados() { return this.contenido[this.enfermedad][this.tab].filter(c => c.titulo !== this.detalle.titulo).concat(this.contenido[this.enfermedad].infografias.slice(0, 1)).slice(0, 3); },
    get contenidoFormacion() { const l = this.formacion[this.enfermedad]; return this.formato === 'todos' ? l : l.filter(c => c.formato === this.formato); },
    get guiaActual() { return this.guias[this.pantalla]; },
    // Encuadre de las fotos verticales (1200×1800): la cara queda arriba, así que el recorte se ancla cerca del borde superior.
    posFoto(src) { return { 'img/oscar-tablet.jpg': 'center 10%', 'img/almuerzo-tablet.jpg': 'center 15%', 'img/webinar-oncologo.jpg': 'center 40%', 'img/estudio-pdf.jpg': 'center 25%' }[src] || 'center 50%'; },
    // Estado del orbe grande de la consulta: cerrada → asleep; escuchando → listening; pensando → thinking; respuesta entrando (2,5 s) → speaking; si no, idle.
    get personaEstado() {
      if (!this.rag.abierto) return 'asleep';
      if (this.rag.escuchando) return 'listening';
      if (this.rag.estado === 'pensando') return 'thinking';
      if (this.rag.hablando) return 'speaking';
      return 'idle';
    },
    // Monta un Persona en `el` (tamaño en px, estado inicial) y lo registra con un rol para actualizar en bloque. `mono` → blanco (isla).
    montarPersona(el, tamano, estado, o = {}) {
      if (typeof crearPersona !== 'function' || !el) return null;
      podarPersonas();
      const p = crearPersona(el, { estado: estado || 'asleep', tamano, colores: o.mono ? ['#FFFFFF', '#FFFFFF'] : (tamano <= 40 ? PERSONA_LILLY_MINI : PERSONA_LILLY) });
      _personas.push({ p, el, rol: o.rol || 'mini' });
      return p;
    },
    personasSetEstado(estado, rol) { podarPersonas(); _personas.forEach(x => { if (!rol || x.rol === rol) x.p.setEstado(estado); }); },
    get saludo() { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; },
    get marco() { return this.marcos[this.dispositivo] || this.marcos.iphone; },
    // Escala para que el marco quepa: alto menos la barra del prototipo, ancho menos el panel de guía si está visible. Nunca más de 1.
    get escala() {
      const guiaW = (this.guia && this.ventana.w >= 1024) ? 380 : 0;
      // En modo solo no hay barra superior ni selector: el marco puede ocupar casi toda la ventana.
      const alto = this.solo ? 24 : 56 + 64 + 50, ancho = this.solo ? 24 : 64;
      const aw = this.ventana.w - guiaW - ancho, ah = this.ventana.h - alto;
      return Math.max(.2, Math.min(1, aw / this.marco.w, ah / this.marco.h));
    },
    // Ámbito de la consulta: en iPhone con la hoja sin enfermedad elegida, la consulta es sobre todo Lilly 360.
    get ragAmbito() { return (this.dispositivo === 'iphone' && this.pantalla === 'tema' && !this.hoja.enfermedad) ? null : this.enf; },
    // Búsqueda global por título en todas las enfermedades y pestañas (sin tildes, sin mayúsculas).
    get hojaResultados() {
      const n = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const q = n(this.hoja.texto.trim()); if (!q) return [];
      const out = [];
      for (const k in this.contenido) { if (this.hoja.enfermedad && k !== this.hoja.enfermedad) continue; for (const t in this.contenido[k]) for (const c of this.contenido[k][t]) if (n(c.titulo).includes(q)) out.push({ c, k, t }); }
      return out.slice(0, 8);
    },
    // Término en negrita dentro del título (sin tildes para encontrarlo, respetando el texto original).
    hojaResaltar(titulo) {
      const esc = t => t.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
      const n = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const q = n(this.hoja.texto.trim()); if (!q) return esc(titulo);
      const i = n(titulo).indexOf(q); if (i < 0 || n(titulo).length !== titulo.length) return esc(titulo);
      return esc(titulo.slice(0, i)) + '<b class="font-semibold">' + esc(titulo.slice(i, i + q.length)) + '</b>' + esc(titulo.slice(i + q.length));
    },
    hojaEnter() { const r = this.hojaResultados[0]; if (r) this.hojaAbrirResultado(r); else if (this.hoja.texto.trim()) this.ragEnviar(this.hoja.texto); },
    // Velo del Inicio detrás de la hoja, progresivo con el arrastre: small blur 0 / opacidad 1 · medium 6 px / .7 · large 8 px / .5.
    get hojaVeloEstilo() {
      if (this.dispositivo !== 'iphone' || !['inicio', 'tema'].includes(this.pantalla)) return '';
      const s = this.hojaY('small'), m = this.hojaY('medium'), l = this.hojaY('large');
      const y = Math.max(s, Math.min(l, this.hoja.y));
      let blur, op;
      if (y <= m) { const t = (y - s) / (m - s); blur = 6 * t; op = 1 - .3 * t; }
      else { const t = (y - m) / (l - m); blur = 6 + 2 * t; op = .7 - .2 * t; }
      return `filter: blur(${blur.toFixed(2)}px) opacity(${op.toFixed(3)})`;
    },
    get hojaGap() { return this.hoja.gaps[this.hoja.detent] || 0; },
    get hojaTabOculta() {
      if (this.dispositivo !== 'iphone') return false;
      if (this.sinCascaron.includes(this.pantalla)) return true;
      if (this.modal || this.rag.abierto || this.rag.fuentesAbierto) return true;
      if (!(this.pantalla === 'inicio' || this.pantalla === 'tema')) return false;
      return this.hoja.arrastrando ? this.hoja.y > this.hojaY('small') + 60 : this.hoja.detent !== 'small';
    },
    get ragSugerencias() { return this.ragBanco[this.enfermedad].map(r => r.p); },
    get ragRespuesta() { const b = this.ragBanco[this.enfermedad]; return b.find(r => r.p === this.rag.pregunta) || b[0]; },
    // — Puente narrativa ⇄ prototipo: se sale por un momento de la historia y se vuelve al mismo capítulo —
    capitulo: 'cap-0',
    verEnProto(destino, enfermedad, cap) {
      this.capitulo = cap;
      if (enfermedad) this.enfermedad = enfermedad;
      if (destino === 'consulta') { this.ir('tema'); this.$nextTick(() => this.ragAbrir()); return; }
      this.ir(destino);
    },
    irHistoria(cap) {
      if (cap) this.capitulo = cap;
      this.ir('historia');
      // Dos frames: uno para que Alpine muestre la historia y otro para que el contenedor tenga alto medible.
      this.$nextTick(() => requestAnimationFrame(() => requestAnimationFrame(() => {
        const sec = document.getElementById(this.capitulo), caja = sec && sec.closest('.hist');
        if (caja && sec) caja.scrollTop = sec.offsetTop;
        lucide.createIcons();
      })));
    },
    get sinMarco() { return ['dashboard', 'arquitectura', 'historia'].includes(this.pantalla); },
    get tituloNativo() { return { tema: 'Búsqueda rápida', detalle: this.detalle.titulo || 'Algoritmo', formacion: 'Formación ágil', pieza: this.pieza.titulo || this.nombreFormato(this.pieza.formato), guardados: 'Guardados', perfil: 'Perfil', registro: 'Registro', dashboard: 'Back office' }[this.pantalla] || ''; },
    get piezaActual() { return this.pantalla === 'pieza' ? this.pieza : this.detalle; },
    get tabActivo() { return ['guardados', 'perfil'].includes(this.pantalla) ? this.pantalla : 'inicio'; },
    // Sidebar con selección única: raíz, o la enfermedad dentro de Búsqueda rápida o de Formación ágil.
    get sidebarActivo() {
      if (['tema', 'detalle'].includes(this.pantalla)) return 'busqueda-' + this.enfermedad;
      if (['formacion', 'pieza'].includes(this.pantalla)) return 'formacion-' + this.enfermedad;
      return this.pantalla;
    },

    iconoTipo(t) { return { Algoritmo: 'git-branch', Tabla: 'table', Guía: 'book-open', Infografía: 'image' }[t] || 'file'; },
    iconoFormato(f) { return { video: 'play-circle', live: 'radio', pdf: 'file-text', info: 'image', encuesta: 'list-checks' }[f] || 'file'; },
    nombreFormato(f) { return { video: 'Video on demand', live: 'En vivo', pdf: 'Estudio PDF', info: 'Infografía', encuesta: 'Encuesta' }[f] || ''; },

    ir(p, extra) {
      if (p !== this.pantalla) this.historial.push(this.pantalla);
      this.direccion = 'adelante'; this.transicion++;
      if (p === 'formacion' && this.enVivoHoy(this.enfermedad)) {
        // iPhone: Live Activity en la isla. iPad/escritorio: toast Sileo con acción para entrar a la pieza en vivo.
        const live = this.formacion[this.enfermedad].find(c => c.formato === 'live' && c.fecha === 'Hoy');
        if (this.dispositivo === 'iphone') this.isla('En vivo hoy');
        else this.conSileo(() => sileo.info('En vivo hoy', { id: 'envivo', description: live.titulo.split(':')[0] + ' · ' + ((live.autor.match(/\d{1,2}:\d{2} [ap]m/) || ['6:00 pm'])[0]), action: { label: 'Entrar', onClick: () => this.abrirPieza(live) } }));
      }
      if (p === 'detalle' && !this.detalle.titulo) this.detalle = this.contenido[this.enfermedad].tratamiento[0], this.tab = 'tratamiento';
      if (p === 'pieza' && !this.pieza.titulo) this.pieza = this.formacion[this.enfermedad][0];
      this.pantalla = p; this.refrescar();
      if (this.dispositivo === 'iphone') { if (p === 'tema') { this.hoja.enfermedad = this.enfermedad; this.hojaIr('large'); } else if (p === 'inicio' && this.hoja.detent === 'large') this.hojaIr('medium'); }
    },
    atras() {
      let p = this.historial.pop(); if (!p) return;
      // En iPhone «Tema» es la hoja: al volver desde un detalle reaparece en medium sobre el Inicio.
      if (this.dispositivo === 'iphone' && p === 'tema') { p = 'inicio'; this.hojaIr(this.hoja.detentPrevio || 'large'); this.hoja.detentPrevio = null; }
      this.direccion = 'atras'; this.transicion++; this.pantalla = p; this.refrescar();
    },
    // La Dynamic Island muestra el estado de una tarea unos segundos y vuelve a compactarse sola.
    isla(texto, ms = 2200) { clearTimeout(this._isla); this.island = texto; this._isla = setTimeout(() => { this.island = ''; }, ms); },
    // Enviar una consulta: abre el modo consulta, agrega el turno al hilo, «piensa» 600 ms (isla o pastilla) y responde en el hilo.
    ragEnviar(texto, esperar = 600) {
      texto = (texto || '').trim(); if (!texto) return;
      clearInterval(this._dictado);
      Object.assign(this.rag, { abierto: true, escuchando: false, dictado: [], pregunta: texto, texto: '', foco: false, estado: 'pensando' });
      this.rag.hilo.push({ rol: 'usuario', texto });
      if (document.activeElement) document.activeElement.blur();
      this.ragBajar();
      clearTimeout(this._rag);
      // iPad/escritorio (sin isla): el estado «consultando» es un toast de promesa; en iPhone lo muestra la Dynamic Island.
      let listo = null; const promesa = new Promise(r => { listo = r; });
      if (this.dispositivo !== 'iphone') this.conSileo(() => sileo.promise(promesa, { loading: 'Consultando estudios…', success: 'Respuesta lista', error: 'Sin conexión' }));
      if (esperar >= 0) this._rag = setTimeout(() => { this.rag.hilo.push({ rol: 'lilly', ...this.ragRespuestaDe(texto) }); this.rag.estado = 'respuesta'; this.rag.hablando = true; clearTimeout(this._habla); this._habla = setTimeout(() => { this.rag.hablando = false; }, 2500); this.ragBajar(); listo(); }, esperar);
    },
    // Si la pregunta no está en el banco, responde con un texto genérico coherente con la enfermedad (o con Lilly 360).
    // La respuesta trae la pieza aprobada que la sustenta (`pieza`, con su enfermedad y pestaña) para abrirla desde el hilo.
    piezaDe(prefijo, k) { for (const t in this.contenido[k]) { const c = this.contenido[k][t].find(c => c.titulo.startsWith(prefijo)); if (c) return { pieza: c, piezaEnf: k, piezaTab: t }; } return { pieza: this.contenido[k].tratamiento[0], piezaEnf: k, piezaTab: 'tratamiento' }; },
    ragRespuestaDe(p) {
      const k = this.enfermedad, b = this.ragBanco[k]; const r = b.find(r => r.p === p);
      if (r) return { ...r, ...this.piezaDe(r.pieza, k) };
      const ambito = this.ragAmbito ? this.ragAmbito.nombre.toLowerCase() : 'las tres enfermedades de Lilly 360';
      return { p, titulo: p, cuerpo: `Según los estudios aprobados por Lilly sobre ${ambito}, ${p.replace(/[¿?]/g, '').toLowerCase()} se resuelve individualizando según el perfil del paciente; revisa el algoritmo de tratamiento y la guía vigente para los criterios específicos.`, ...this.piezaDe('Tratamiento', k) };
    },
    ragAbrirPieza(t) { this.enfermedad = t.piezaEnf; this.tab = t.piezaTab; this.ragCerrar(); this.abrirDetalle(t.pieza); },
    ragAbrirCon(c) { this.rag.contexto = c && c.titulo ? c.titulo : ''; this.ragAbrir(); },
    ragSeguimientos(t) { return this.ragBanco[this.enfermedad].filter(r => r.titulo !== t.titulo).slice(0, 2).map(r => r.p); },
    ragBajar() { this.$nextTick(() => { const el = this.$refs.hilo; if (el) el.scrollTop = el.scrollHeight; }); },
    ragAbrir() { this.rag.abierto = true; if (this.rag.modo === 'texto') this.$nextTick(() => { if (this.$refs.consultaInput) this.$refs.consultaInput.focus({ preventScroll: true }); }); },
    ragSeguir() { this.ragAbrir(); },
    ragCerrar() { clearInterval(this._dictado); Object.assign(this.rag, { abierto: false, estado: 'idle', escuchando: false, dictado: [], fuentesAbierto: false, foco: false, contexto: '' }); },
    ragModo(m) { this.rag.modo = m; if (m === 'voz') this.ragDictar(); else this.ragCancelarVoz(true); },
    ragTeclado() { this.rag.modo = 'texto'; this.$nextTick(() => { if (this.$refs.consultaInput) this.$refs.consultaInput.focus({ preventScroll: true }); }); },
    // Dictado simulado: la pregunta aparece palabra por palabra (las clave en tinta) y a los ~1,5 s se envía. `congelar` la deja escrita sin enviar (capturas).
    ragDictar(congelar = false) {
      const banco = this.ragBanco[this.enfermedad]; const frase = banco[this.rag.hilo.filter(t => t.rol === 'usuario').length % banco.length].p;
      const clave = w => w.length >= 6 || /[A-Z0-9]/.test(w.slice(1));
      const palabras = frase.split(' ').map(t => ({ t, clave: clave(t.replace(/[¿?,.]/g, '')) }));
      this.rag.modo = 'voz'; this.rag.escuchando = true; this.rag.dictado = congelar ? palabras : [];
      clearInterval(this._dictado); if (congelar) return;
      let i = 0;
      this._dictado = setInterval(() => {
        if (i < palabras.length) { this.rag.dictado.push(palabras[i++]); return; }
        clearInterval(this._dictado); setTimeout(() => { if (this.rag.escuchando) this.ragEnviar(frase); }, 450);
      }, Math.max(120, Math.round(1100 / palabras.length)));
    },
    ragCancelarVoz(quieto = false) { clearInterval(this._dictado); this.rag.escuchando = false; this.rag.dictado = []; if (!quieto) this.rag.modo = 'texto'; },
    enVivoHoy(k) { return this.formacion[k].some(c => c.formato === 'live' && c.fecha === 'Hoy'); },
    // En iPhone la Búsqueda rápida es la hoja en large; en iPad y escritorio sigue siendo la pantalla Tema.
    abrirTema(k) { this.enfermedad = k; this.tab = 'diagnostico'; if (this.dispositivo === 'iphone') { this.hoja.enfermedad = k; this.hojaIr('large'); } else this.ir('tema'); },
    hojaElegir(k) { this.enfermedad = k; this.tab = 'diagnostico'; this.hoja.enfermedad = k; this.$nextTick(() => lucide.createIcons()); },
    hojaQuitarEnfermedad() { this.hoja.enfermedad = null; this.$nextTick(() => { lucide.createIcons(); if (this.$refs.hojaInput) this.$refs.hojaInput.focus({ preventScroll: true }); }); },
    hojaAbrirResultado(r) { this.enfermedad = r.k; this.tab = r.t; this.hoja.enfermedad = r.k; this.abrirDetalle(r.c); },
    abrirReciente(r) { this.enfermedad = r.enfermedad; this.tab = r.tab; const c = this.contenido[r.enfermedad][r.tab].find(c => c.titulo.startsWith(r.titulo)); if (c) this.abrirDetalle(c); else this.hojaIr('large'); },

    // ----- Hoja inferior: detents, arrastre con Pointer Events y snap por velocidad -----
    hojaY(d) { return this.hoja.alturas[d]; },
    hojaMedir() {
      if (this.dispositivo !== 'iphone') return;
      const H = (this.$refs.main && this.$refs.main.clientHeight) || 902;   // alto del área bajo la status bar, sin escalar
      this.hoja.alturas = { small: 167, medium: Math.round((H + 54) * .56), large: H - 8 };
      this.hoja.y = this.hojaY(this.hoja.detent);
    },
    // Rubber-band de WWDC18: la hoja sigue el dedo cada vez menos al pasar del detent más alto o más bajo.
    hojaRubber(d, dim) { return (1 - 1 / ((d * .55) / dim + 1)) * dim; },
    hojaIr(d) {
      if (!this.hoja.alturas[d]) return;
      this.hoja.detent = d; this.hoja.y = this.hojaY(d);
      if (this.dispositivo === 'iphone') {
        if (d === 'large' && this.pantalla === 'inicio') this.pantalla = 'tema';
        if (d !== 'large' && this.pantalla === 'tema') this.pantalla = 'inicio';
      }
      this.$nextTick(() => lucide.createIcons());
    },
    hojaBuscar() { if (this.hoja.movio) return; this.hojaIr('large'); this.$nextTick(() => { if (this.$refs.hojaInput) this.$refs.hojaInput.focus({ preventScroll: true }); }); },
    hojaLibre() { this.hoja.enfermedad = null; this.hojaIr('large'); },
    hojaCancelar() { this.hoja.texto = ''; this.hoja.enfermedad = null; this.hojaIr('medium'); },
    hojaInicioArrastre(e) {
      if (this.dispositivo !== 'iphone' || e.button > 0) return;
      const enLista = this.hoja.detent === 'large' && e.target.closest('.hoja-body');
      this._h = { id: e.pointerId, y0: e.clientY, yInicio: this.hoja.y, lista: enLista, decidido: !enLista, el: e.currentTarget, v: 0, ultimo: [e.clientY, performance.now()] };
      this.hoja.movio = false;
    },
    hojaMover(e) {
      const h = this._h; if (!h || e.pointerId !== h.id) return;
      const dy = (e.clientY - h.y0) / this.escala;   // el marco está escalado: el dedo se mide en px de pantalla
      if (!h.decidido) {
        if (Math.abs(dy) < 6) return;
        // En large, la lista toma el gesto; solo si está en el tope y se arrastra hacia abajo vuelve a mover la hoja.
        if (dy > 0 && h.lista.scrollTop <= 0) h.decidido = true; else { this._h = null; return; }
      }
      if (!this.hoja.arrastrando) { this.hoja.arrastrando = true; try { h.el.setPointerCapture(h.id); } catch (_) {} }
      if (Math.abs(dy) > 6) this.hoja.movio = true;
      let y = h.yInicio - dy;   // el dedo sube → la hoja crece
      const max = this.hojaY('large'), min = this.hojaY('small');
      if (y > max) y = max + this.hojaRubber(y - max, max);
      if (y < min) y = min - this.hojaRubber(min - y, max);
      this.hoja.y = y;
      const t = performance.now(); h.v = (e.clientY - h.ultimo[0]) / Math.max(1, t - h.ultimo[1]) / this.escala; h.ultimo = [e.clientY, t];
    },
    hojaSoltar(e) {
      const h = this._h; if (!h || e.pointerId !== h.id) return; this._h = null;
      if (!this.hoja.arrastrando) return;   // fue un toque, no un arrastre
      this.hoja.arrastrando = false;
      // El detent no es el más cercano a donde está la hoja, sino a donde iría el dedo si siguiera desacelerando
      // (WWDC18, tasa 0.998 ⇒ y + v·499). Un flick fuerte salta detents; un arrastre lento cae en el vecino.
      const proy = this.hoja.y - h.v * (.998 / .002);
      const orden = ['small', 'medium', 'large'];
      const destino = orden.reduce((a, d) => Math.abs(this.hojaY(d) - proy) < Math.abs(this.hojaY(a) - proy) ? d : a, orden[0]);
      this.hojaIr(destino);
      setTimeout(() => { this.hoja.movio = false; }, 50);
    },
    abrirDetalle(c) { this.detalle = c; if (c.tipo === 'Infografía') this.tab = 'infografias'; if (this.dispositivo === 'iphone' && ['inicio', 'tema'].includes(this.pantalla)) this.hoja.detentPrevio = this.hoja.detent; this.ir('detalle'); },
    abrirGuardado(g) { this.enfermedad = g.enfermedad; if (g.formato) this.abrirPieza(g); else { this.tab = g.tab || 'tratamiento'; this.abrirDetalle(g); } },
    // Contrato compartido: guardar/quitar por título con HUD; irRaiz vacía la pila (tab bar y sidebar); hud confirma en 1,8 s.
    guardar(c) {
      if (!c || !c.titulo) return;
      const i = this.guardados.findIndex(g => g.titulo === c.titulo);
      if (i >= 0) { this.guardados.splice(i, 1); this.hud('Quitado de Guardados'); }
      else { this.guardados.unshift({ ...c, enfermedad: this.enfermedad, tab: this.tab }); this.hud('Guardado'); }
    },
    esGuardado(c) { return !!c && this.guardados.some(g => g.titulo === c.titulo); },
    // Avisos con Sileo (src/sileo.js), montado dentro de .proto-main para que viaje con el marco escalado. Títulos sin Capitalize.
    montarSileo() {
      if (typeof sileo === 'undefined' || !this.$refs.main) return;
      // Ojo con los nombres de Sileo: theme 'dark' es la cápsula clara (#f2f2f2, texto en tinta), la que va sobre nuestro fondo claro.
      sileo.mount(this.$refs.main, { position: 'top-center', theme: 'light' /* en Sileo el nombre va al revés: 'light' es la cápsula OSCURA, que es la que pidió Andrés */, palette: 'lilly', offset: { top: 12 } /* .proto-main ya empieza bajo la barra de estado de cada marco: 12 la deja sentada arriba en los tres */, options: { styles: { title: 'sileo-normal' } } });
      // Los avisos disparados antes del montaje (p. ej. desde ?p= en init) esperan aquí: si no, Sileo se montaría solo en el body.
      this._sileoListo = true; (this._sileoCola || []).splice(0).forEach(fn => fn());
    },
    conSileo(fn) { if (typeof sileo === 'undefined') return; if (this._sileoListo) fn(); else (this._sileoCola = this._sileoCola || []).push(fn); },
    hud(texto, ms) {
      if (typeof sileo === 'undefined') return;
      const extra = ms ? { duration: ms } : {};
      const mapa = {
        'Guardado': () => sileo.success('Guardado', { description: 'En Guardados', action: { label: 'Ver', onClick: () => this.irRaiz('guardados') }, ...extra }),
        'Quitado de Guardados': () => sileo.info('Quitado de Guardados', extra),
        'Enlace copiado': () => sileo.success('Enlace copiado', extra),
        'Cuenta creada': () => sileo.success('Cuenta creada', { description: 'Bienvenido a Lilly 360', ...extra }),
        'Sesión iniciada': () => sileo.success('Sesión iniciada', extra),
      };
      this.conSileo(mapa[texto] || (() => sileo.success(texto, extra)));
    },
    irRaiz(p) { this.historial = []; this.direccion = 'atras'; this.transicion++; this.pantalla = p; this.tabMin = false; this.refrescar(); if (this.dispositivo === 'iphone' && p === 'inicio' && this.hoja.detent === 'large') this.hojaIr('medium'); },
    // Botón de búsqueda de la tab bar (UITab.search): desde cualquier pantalla a la hoja en large sin enfermedad y con foco.
    buscarGlobal() { this.irRaiz('inicio'); this.hoja.enfermedad = null; this.hoja.texto = ''; this.hojaIr('large'); this.$nextTick(() => { if (this.$refs.hojaInput) this.$refs.hojaInput.focus({ preventScroll: true }); }); },
    // Tab bar que se minimiza al bajar y vuelve al subir (B11); `scrolled` compacta la nav bar.
    alDesplazar(el) { const y = el.scrollTop; this.scrolled = y > 24; const d = y - (this._scrollY || 0); if (d > 8 && y > 60) this.tabMin = true; else if (d < -8 || y < 40) this.tabMin = false; this._scrollY = y; },
    abrirFormacion(k) { this.enfermedad = k; this.formato = 'todos'; this.ir('formacion'); },
    abrirPieza(c) { this.pieza = c; this.respuesta = null; this.ir('pieza'); },
    refrescar() { this.scrolled = false; this.$nextTick(() => { lucide.createIcons(); if (this.$refs.scroll) this.$refs.scroll.scrollTop = 0; }); },
    init() {
      // Alpine llama solo a init() si existe en x-data, y el body además tiene x-init="init()": sin esta guarda corre dos veces
      // (watchers duplicados, dos turnos en el hilo del RAG).
      if (this._iniciado) return; this._iniciado = true;
      // ?p=tema&e=mama&t=tratamiento abre una pantalla directa: sirve para pantallazos y para compartir un enlace.
      const q = new URLSearchParams(location.search);
      if (q.get('captura') === '1') document.body.classList.add('sin-animacion');
      // ?pieza=<n> elige qué contenido de Formación se abre: sirve para las capturas de la historia.
      if (q.get('pieza')) { const n = +q.get('pieza'); const lista = this.formacion[this.enfermedad]; if (lista && lista[n]) this.pieza = lista[n]; }
      if (q.get('solo') === '1') { this.solo = true; this.guia = false; }
      if (q.get('guia') === '0') this.guia = false;
      if (q.get('e') && this.enfermedades[q.get('e')]) this.enfermedad = q.get('e');
      if (q.get('t')) this.tab = q.get('t');
      if (q.get('d') && this.marcos[q.get('d')]) this.dispositivo = q.get('d');
      if (q.get('p') && this.guias[q.get('p')]) { this.pantalla = q.get('p'); this.ir(q.get('p')); }
      this.refrescar();
      this.$watch('tab', () => { this.refrescar(); this.cargando = true; clearTimeout(this._sk); this._sk = setTimeout(() => { this.cargando = false; this.$nextTick(() => lucide.createIcons()); }, 250); });
      this.$watch('formato', () => this.refrescar());
      this.$watch('enfermedad', () => this.refrescar());
      this.$watch('respuesta', () => this.refrescar());
      this.$watch('guia', () => this.refrescar());
      this.$watch('island', () => this.refrescar());
      ['rag.estado', 'rag.abierto', 'rag.modo', 'rag.fuentesAbierto', 'rag.escuchando', 'rag.hilo', 'hoja.detent', 'hoja.enfermedad', 'hoja.texto', 'guardados', 'tabMin', 'rag.contexto', 'pantalla'].forEach(k => this.$watch(k, () => this.$nextTick(() => lucide.createIcons())));
      // El dispositivo se persiste en ?d= para poder compartir y capturar; la escala sigue el tamaño de la ventana.
      this.$watch('dispositivo', d => { const u = new URL(location.href); u.searchParams.set('d', d); history.replaceState(null, '', u); this.refrescar(); });
      // Solo un cambio real de ventana (> 2 px) recalcula la escala: ni el canvas de Persona ni un ResizeObserver interno la tocan.
      window.addEventListener('resize', () => { const w = window.innerWidth, h = window.innerHeight; if (Math.abs(w - this.ventana.w) < 2 && Math.abs(h - this.ventana.h) < 2) return; this.ventana = { w, h }; this.hojaMedir(); });
      // La hoja se mide con el DOM listo; ?hoja=small|medium|large fija el detent para capturas.
      // Con ?hoja= el detent se aplica sin animar (is-dragging quita la transición) para que la captura no salga a mitad del snap.
      this.$nextTick(() => { this.hojaMedir(); if (q.get('hoja')) { this.hoja.arrastrando = true; this.hojaIr(q.get('hoja')); this.$nextTick(() => { this.hoja.arrastrando = false; }); } });
      this.$watch('dispositivo', () => setTimeout(() => { this.hojaMedir(); this.montarSileo(); }, 420));
      this.$nextTick(() => this.montarSileo());
      // Persona: el orbe grande sigue `personaEstado`; los pequeños duermen con la consulta cerrada y despiertan al abrirla.
      this.$watch('personaEstado', e => this.personasSetEstado(e, 'grande'));
      // Los pequeños van en idle en reposo (asleep es imperceptible a 32 px sobre vidrio) y en listening con la consulta abierta.
      this.$watch('rag.abierto', a => this.personasSetEstado(a ? 'listening' : 'idle', 'mini'));
      // ?rag=1 abre el foco con sugerencias, ?rag=2 muestra la respuesta y ?rag=3 congela el estado «pensando»: solo para capturas.
      const rag = q.get('rag');
      if (rag === '1') this.rag.foco = true;
      if (rag === '2') this.ragEnviar(this.ragSugerencias[0]);
      if (rag === '3') this.ragEnviar(this.ragSugerencias[0], -1);
      // ?rag=4 modo consulta inicial (texto), ?rag=5 voz escuchando con la onda, ?rag=6 hilo con respuesta y panel de fuentes abierto.
      if (rag === '4') this.rag.abierto = true;
      // ?guardar=1 marca la pieza abierta y deja el HUD visible para la captura.
      if (q.get('guardar') === '1') { this.$nextTick(() => { this.guardar(this.piezaActual); this.hud('Guardado', 60000); }); }
      if (rag === '5') { this.rag.abierto = true; this.ragDictar(true); }
      if (rag === '6') { this.ragEnviar(this.ragSugerencias[0]); setTimeout(() => { this.rag.fuentesAbierto = true; }, 900); }
      // ?rag=7: dos preguntas seguidas (una del banco y una libre) para comprobar que cada envío produce su respuesta.
      if (rag === '7') { this.ragEnviar(this.ragSugerencias[1]); setTimeout(() => this.ragEnviar('¿Y si además tiene enfermedad renal?'), 1400); }
    },
  };
}
