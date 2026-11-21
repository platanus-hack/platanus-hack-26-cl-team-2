# Front y API en Vercel

El proyecto incluye una función Node en `api/index.ts`. `vercel.json` compila
el front y dirige `/api/*` y `/health` hacia la aplicación Hono. No se inicia
un servidor escuchando puertos dentro de la función.

## Configuración

1. Usa la raíz del repositorio como Root Directory y `main` como rama de
   producción. Los archivos de este cambio deben estar integrados en esa rama.
2. Configura `DATABASE_URL` con Postgres, `ANTHROPIC_API_KEY` y
   `WEB_ORIGIN=https://platanushacka-henna.vercel.app` en Production.
3. Con la conexión de producción disponible de forma segura en tu terminal,
   ejecuta `pnpm --filter @sandbox/api db:push`. Este cambio agrega
   `simulation_runs`; la ejecución anterior de db:push no incluyó esa tabla.
4. Despliega de nuevo. Usa el build definido en `vercel.json`:
   `pnpm --filter @sandbox/shared build && pnpm --filter @sandbox/web build`.
   La salida está en `apps/web/dist`.
5. Verifica `/health`, `/api/agents`, `/api/runs` y
   `/api/email-scenarios` en el dominio público.

No pongas secretos en variables `VITE_*` ni en archivos versionados.

## Protecciones de la demo pública

La API limita el consumo de créditos sin configuración adicional. Variables
opcionales en Production:

- `ADMIN_TOKEN`: si se define, las escrituras (crear o borrar agentes, guardar
  perfiles, generar empresas, evals de vulnerabilidad) exigen el header
  `x-admin-token`. En el navegador:
  `localStorage.setItem("meshAdminToken", "<token>")`. Sin definir, las
  escrituras quedan abiertas.
- `MAX_SPEND_USD_PER_DAY` (por defecto `5`): tope diario en US$ de llamadas al
  modelo; `0` lo desactiva. Al agotarse, la API responde 429 hasta el día
  siguiente (UTC).
- `RATE_LIMIT_PER_MINUTE` (por defecto `12` en Vercel): solicitudes que llaman
  al modelo por IP y por minuto; `0` lo desactiva. `MAX_RUNS_PER_DAY` (por
  defecto `40`) limita las ejecuciones diarias.

La IP del visitante se toma de `x-real-ip` (o del primer valor de
`x-vercel-forwarded-for`), que Vercel escribe. Los contadores viven en la memoria
de cada instancia de la función: son una protección aproximada, no un límite
exacto.

El paquete `@sandbox/shared` exporta JavaScript y declaraciones desde `dist`.
Se compila al instalar dependencias y antes del build de Vercel. La función
incluye explícitamente esos archivos; no debe cargar fuentes `.ts` del workspace
en producción. Si aparece `ERR_MODULE_NOT_FOUND` para ese paquete, verifica que
el despliegue incluya este cambio y no tenga un Build Command antiguo sobrescrito.

## Simulaciones y persistencia

Perfiles, ejecuciones, trazas y dictámenes se consultan desde la base de datos.
Cada turno guarda una instantánea; los eventos SSE se leen de esa persistencia,
por lo que el lector no necesita compartir proceso con el ejecutor.

En Vercel el POST espera a que finalice la simulación: no deja promesas en
segundo plano después de enviar la respuesta. El front muestra el indicador
de ejecución durante esa espera y recibe la traza al finalizar. Las lecturas
independientes del dashboard pueden ver las instantáneas de turnos completados.

El presupuesto de simulación es de 240 segundos y la función declara
`maxDuration: 300`. Activa Fluid Compute y confirma que tu plan/configuración
admite ese tiempo. Si la plataforma impone un límite menor, ajusta ambos valores.
Las ejecuciones interrumpidas se muestran como fallidas al vencer su plazo.
No se reanudan automáticamente ni se reintentan acciones: para trabajos más
largos se necesita un workflow o cola duradera.

Las herramientas financieras siguen siendo simuladas. Esta configuración no
agrega autenticación ni aislamiento entre usuarios; antes de abrir un servicio
multiusuario con datos sensibles o consumo irrestricto de créditos, deben
implementarse esos controles.
