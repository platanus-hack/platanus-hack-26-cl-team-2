# Análisis asíncrono en Demo Setup B

La interfaz programa un trabajo y recibe HTTP 202. Un worker consume la cola guardada en `evaluation_jobs`, clasifica funciones, ejecuta pruebas y guarda atributos. La pestaña solo consulta el avance; se puede cerrar sin cancelar el trabajo.

Los trabajos pueden estar en cola, ejecutándose, deteniéndose, completados, fallidos o detenidos. Detener corta después del paso en curso. Se conservan las evaluaciones de agentes ya terminados. Un worker interrumpido se detecta tras cinco minutos sin señal de actividad; el trabajo pasa a fallido y no se repiten automáticamente llamadas facturables.

## Local

El servidor Node inicia el worker automáticamente. SQLite crea la tabla de cola al abrirse. Inicia la app como siempre con `pnpm dev`.

## Producción con PostgreSQL

1. Crear únicamente la tabla de cola: `pnpm --filter @sandbox/api db:eval-jobs`. Este comando es aditivo y no modifica otras tablas. También está declarada en el esquema Drizzle.
2. Mantener un proceso Node para el worker, con la misma `DATABASE_URL`, `ANTHROPIC_API_KEY`, configuración de modelo y límites de gasto que la API.
3. Ejecutar `pnpm --filter @sandbox/api eval:worker` en un servicio persistente, por ejemplo un servicio worker de Render o Railway. Después de compilar también puede ejecutarse `node apps/api/dist/evaluation-jobs/start.js` desde la raíz.
4. Si la API está en un servidor Node persistente, ya incluye un worker. Para separarlo, usar `EVALUATION_WORKER_DISABLED=1` en ese servidor y lanzar el proceso dedicado.

Vercel recibe trabajos y consulta resultados. Su función HTTP no ejecuta esta cola en segundo plano: requiere el worker persistente conectado a PostgreSQL. Mientras no exista un worker, la interfaz muestra «En cola: esperando al worker de análisis».

Cada worker procesa un trabajo a la vez. Las actualizaciones y reclamaciones son condicionales para no ejecutar el mismo trabajo desde dos workers. Los límites de gasto existentes son por proceso; para una demo se recomienda un único worker y configurar también límites de consumo en el proveedor.

Las rutas de la cola requieren la misma autorización administrativa que el guardado de agentes. Cada paso conserva los controles de consumo. Si cambia un perfil desde que se programó el análisis, se interrumpe para evitar asignar atributos a una configuración diferente.
