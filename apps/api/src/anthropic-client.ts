import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { userApiKey } from "./user-api-key.js";
import { SpendLimitError, spendMeter, type SpendMeter } from "./security/spend.js";

/**
 * Pure wiring, exported for tests: every messages.create on this client first asks the
 * spend meter (throws SpendLimitError when the day's budget is gone, before any request)
 * and then records the response's usage. A response without usage (e.g. a gateway that strips
 * it) is charged as if it used all of max_tokens, so the cap never goes blind. Streaming calls
 * carry no usage on the returned object; nothing in this app streams, and they are still gated.
 */
export function meterClient(client: Anthropic, meter: SpendMeter): Anthropic {
  const create = client.messages.create.bind(client.messages);
  const metered = ((params: Anthropic.MessageCreateParams, options?: Anthropic.RequestOptions) => {
    const gate = meter.check();
    if (!gate.ok) throw new SpendLimitError(gate.message);
    const pending = create(params, options);
    void Promise.resolve(pending).then(
      (res) => {
        if (params.stream) return;
        const usage = (res as Partial<Anthropic.Message> | null)?.usage;
        meter.record(params.model, usage ?? { output_tokens: params.max_tokens });
      },
      () => undefined, // the caller handles the error; failed calls are not billed
    );
    return pending;
  }) as typeof client.messages.create;
  client.messages.create = metered;
  return client;
}

/**
 * The only place model clients are created, so every call (lab agents, judge, refine,
 * MCP quick test) uses the same key, goes through ANTHROPIC_BASE_URL when it is set, and
 * is counted against the daily spend cap (enforced only where a limit is set: the server).
 */
export function anthropicClient(options: { maxRetries?: number } = {}): Anthropic {
  // A visitor's own key goes straight to Anthropic (never through the server's proxy) and is
  // billed to them, so the server's daily spend cap does not count it. Rate limits still apply.
  const own = userApiKey();
  if (own) return new Anthropic({ apiKey: own, ...options });
  return meterClient(
    new Anthropic({ apiKey: config.anthropicApiKey, baseURL: config.anthropicBaseUrl, ...options }),
    spendMeter,
  );
}
