# Agent Security Bench (ASB): Formalizing and Benchmarking Attacks and Defenses in LLM-based Agents

- **Autores:** Hanrong Zhang, Jingyuan Huang, Kai Mei, Yifei Yao, Zhenting Wang, Chenlu Zhan, Hongwei Wang, Yongfeng Zhang
- **Año / venue:** 2024 (arXiv) / ICLR 2025 (Comments de arXiv: "Accepted by ICLR 2025"; encabezado del PDF: "Published as a conference paper at ICLR 2025")
- **Enlace:** https://arxiv.org/abs/2410.02644 (código: https://github.com/agiresearch/ASB)
- **PDF local:** ~/papers-ia-safety/benchmarks-agentes/zhang-2024-asb.pdf
- **Verificado:** metadatos `citation_*` de la página de arXiv 2410.02644 (v1 2024-10-03, última versión 2025-05-30) y encabezado del PDF. · Revisado por verificador independiente (2026-11-21)

## Resumen (10 líneas)
ASB formaliza y mide ataques y defensas contra agentes LLM en todas las etapas: system prompt, prompt del usuario, uso de herramientas y memoria.
Tiene 10 escenarios (e-commerce, conducción autónoma, finanzas, etc.), 10 agentes, más de 400 herramientas, 27 tipos de ataque/defensa y 7 métricas.
Ataques: 10 de prompt injection (directa, DPI, e indirecta, IPI), memory poisoning, un backdoor nuevo ("Plan-of-Thought") y 4 mixtos.
Defensas: 11, entre ellas delimitadores, sandwich, instructional prevention, paraphrasing, dynamic prompt rewriting, y detectores por perplejidad y por LLM.
Cubre 13 modelos de base (Claude 3.5 Sonnet, GPT-4o, Llama 3, Qwen2, Gemma2…).
Que un ataque tenga éxito significa que el agente usa la herramienta específica del ataque. Que la tarea se cumpla significa que usa todas las herramientas requeridas.
La ASR promedio más alta es 84.30%, con el ataque mixto.
Las defensas de prevención resultan insuficientes: bajan poco la ASR y cuestan utilidad.
La relación entre capacidad y ASR sube y luego baja: los modelos mejores obedecen más, pero los más capaces también rechazan más.
Proponen NRP (Net Resilient Performance) para resumir utilidad y seguridad en un solo número.

## Ataque o defensa que propone
- Ataque nuevo: **Plan-of-Thought (PoT) backdoor**, un disparador escondido en demostraciones del system prompt.
- Métrica nueva: **NRP = PNA × (1 − ASR)**, donde PNA (Performance under No Attack) es el porcentaje de tareas completadas sin ataque ni defensa.
- Otras métricas (Tabla 4): RR (refuse rate), BP (benign performance con backdoor sin disparador), FPR/FNR para defensas de detección.

## Números que reporta
- **Tabla 5 / sección 5.3**: el ataque mixto (DPI+IPI+memory poisoning) logra la ASR promedio más alta, 84.30%, con refuse rate de 3.22%. Memory poisoning es el más débil (7.92%). GPT-4o tiene un refuse rate de 20.05% y una ASR de 60.35% bajo DPI. GPT-3.5 Turbo, con 3.00% de rechazo, llega a 98.40%.
- **Tabla 6** (PNA / ASR promedio / NRP): Claude-3.5 Sonnet 100.00 / 56.44 / 43.56%. LLaMA3-70B 66.50 / 54.84 / 30.03%. GPT-4o 79.00 / 64.41 / 28.12%. Promedio de los 13 modelos: 29.46 / 46.91 / 15.64%.
- **Sección 5.4 (Tablas 7–8)**: con paraphrasing y dynamic prompt rewriting contra DPI, la ASR promedio sigue alta, 56.87% y 44.45%. Las defensas de prevención "often cause some utility losses" sin ataque (App. D.2).

## Conexión con MESH
- **NRP es una métrica que MESH puede adoptar casi gratis**: para cada combinación de `FIX_COMBOS` en `apps/api/src/batch.ts`, NRP = (utilidad en correos benignos) × (1 − tasa de `dangerousAttempted` en ataques). Así una defensa que bloquee todo pierde puntos por utilidad. Requiere que antes exista la medición de utilidad en benignos (ver nota de AgentDojo).
- **Refuse rate**: en MESH, el análogo es que el agente escribe una advertencia (`agentWarnedAtFinance` en `summarize()`) o escala sin actuar. Se puede reportar como "tasa de rechazo/escalamiento" y cruzarla con benignos para ver falsos positivos.
- **Que se cumpla la tarea = usar las herramientas requeridas** es un criterio determinista simple, igual al que MESH podría usar para `issue_refund` en `ctrl_01_customer_refund` o `bec_ben_02_customer_duplicate_charge`.
- **Contradice un poco el optimismo sobre defensas de prompt**: las defensas tipo delimitador o instrucción tienen poco efecto. `provenance_tag` (`apps/api/src/harness/provenance.ts`) es de esa familia (agrega texto al mensaje). El valor de MESH está en mostrar *dónde* se pierde la señal (`risk-paths.ts`), no en prometer que la etiqueta basta.
- **Cuidado al citar**: el PNA de 100% para Claude 3.5 Sonnet sale de las tareas de ASB, donde basta usar las herramientas requeridas. Es un criterio laxo y no se puede comparar con la utilidad de AgentDojo.
