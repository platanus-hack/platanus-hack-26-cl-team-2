# MESH

## Encuentra las vulnerabilidades entre los agentes

Una organización puede tener agentes que parecen seguros por separado y aun así
exponerse a riesgos cuando estos se comunican, delegan tareas y utilizan
herramientas compartidas. MESH permite explorar esas interacciones mediante
simulaciones controladas y evidencia observable.

## Cómo funciona

1. **Crea la organización:** genera y guarda perfiles de agentes por área,
   experiencia, motivación y proactividad.
2. **Introduce actores externos:** utiliza clientes colaboradores, confundidos,
   insistentes, sabiondos o impacientes, o un atacante malicioso simulado.
3. **Ejecuta un escenario:** selecciona participantes y entrega una solicitud o
   correo al agente inicial para observar cómo responde el grupo.
4. **Explora el grafo:** visualiza mensajes enviados y llamadas a herramientas,
   con acceso a los eventos que respaldan cada conexión.
5. **Monitorea los resultados:** consulta volumen y promedio de interacciones,
   intentos peligrosos o bloqueados y hallazgos del evaluador de IA.

El laboratorio también permite repetir escenarios de correo con verificación
del remitente y comparar sus resultados. Así ayuda a investigar cómo la presión,
la delegación y la confianza entre participantes pueden conducir a una acción
indebida.

## Evidencia antes que apariencia

MESH distingue las relaciones observadas de los datos ficticios de demostración.
Los intentos registrados en las trazas se muestran por separado de los hallazgos
del evaluador de IA. La ausencia de hallazgos no se presenta como garantía de
seguridad y una ejecución aislada no constituye una tasa de éxito de ataques.

## Alcance del prototipo

El prototipo utiliza React y Vite para la interfaz, una API Node con Hono,
modelos Claude y almacenamiento de perfiles mediante Drizzle con SQLite o
Postgres. Las herramientas financieras son simuladas y los cambios de cuenta
bancaria se bloquean. Los perfiles, ejecuciones y trazas se conservan en la base
de datos; no es un sistema de monitoreo de tráfico de producción.

Proyecto desarrollado para Platanus Hackathon, track AI Security.
