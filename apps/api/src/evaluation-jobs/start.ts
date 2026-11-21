import { startEvaluationWorker } from "./worker.js";

console.log("[evaluation-worker] Escuchando la cola de análisis.");
const stop = startEvaluationWorker();
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
