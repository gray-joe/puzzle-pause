import { Agent } from 'undici';

export interface ModelConfig {
    /** Stable bot-account key — the local part of the account's email, and its identity in a
     *  league. Deliberately separate from `id` so swapping in a newer model keeps one player. */
    account: string;
    /** The bot's display name in leagues, and its label in benchmark reports. */
    label: string;
    /** OpenCode Zen model id, exactly as listed at https://opencode.ai/zen/v1/models. */
    id: string;
    endpoint: string;
    format: 'openai-chat' | 'openai-responses' | 'anthropic-messages';
}

// opencode.ai's gateway appears to close idle keep-alive sockets more aggressively than undici's
// pool expects under concurrent multi-worker load, which otherwise surfaces as an intermittent
// "TypeError: fetch failed" / "SocketError: other side closed" on a reused connection. Confirmed
// via curl and isolated fetch calls, both 100% reliable — only the pooled/reused path fails. A
// near-zero keepAliveTimeout makes undici treat every connection as stale and open a fresh one.
const freshConnectionDispatcher = new Agent({ keepAliveTimeout: 1, keepAliveMaxTimeout: 1 });

// Output cap per call, reasoning included — the answer itself is one line, so nearly all of this
// is thinking. Generous because a budget spent entirely on thinking leaves no text (an empty
// answer, counted as a rejected guess): 4096 ran out on retries, where a model hunts at length for
// an alternative to a rejected answer. Still bounds cost and latency on a model that won't stop.
const MAX_OUTPUT_TOKENS = 16_000;

function buildBody(model: ModelConfig, prompt: string) {
    switch (model.format) {
        case 'anthropic-messages':
            return {
                model: model.id,
                max_tokens: MAX_OUTPUT_TOKENS,
                messages: [{ role: 'user', content: prompt }],
            };
        case 'openai-responses':
            return { model: model.id, input: prompt, max_output_tokens: MAX_OUTPUT_TOKENS };
        case 'openai-chat':
            return {
                model: model.id,
                max_tokens: MAX_OUTPUT_TOKENS,
                messages: [{ role: 'user', content: prompt }],
            };
    }
}

function buildHeaders(model: ModelConfig, apiKey: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (model.format === 'anthropic-messages') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    return headers;
}

function extractText(model: ModelConfig, data: any): string {
    switch (model.format) {
        case 'anthropic-messages': {
            // content[0] isn't reliably the answer — extended-thinking models put a
            // "thinking" block first, with the actual "text" block after it.
            const textBlock = data.content?.find((c: any) => c.type === 'text');
            return textBlock?.text ?? '';
        }
        case 'openai-responses': {
            const message = data.output?.find((item: any) => item.type === 'message');
            const text = message?.content?.find((c: any) => c.type === 'output_text')?.text;
            return text ?? data.output_text ?? '';
        }
        case 'openai-chat':
            return data.choices?.[0]?.message?.content ?? '';
    }
}

export async function askModel(model: ModelConfig, prompt: string): Promise<string> {
    const apiKey = process.env.OPENCODE_API_KEY;
    if (!apiKey) throw new Error('OPENCODE_API_KEY is not set (add it to web/.env.local)');

    // Retry 5xx and 429 (rate limited — the one 4xx that's explicitly "try again"); other 4xx
    // and a hard timeout won't fix themselves. Backoff is longer/jittered than a typical HTTP
    // retry because this gateway's under real concurrent load from every model in the matrix.
    let lastError = '';
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            const res = await fetch(model.endpoint, {
                method: 'POST',
                headers: buildHeaders(model, apiKey),
                body: JSON.stringify(buildBody(model, prompt)),
                signal: AbortSignal.timeout(150_000), // high-effort reasoning models can take minutes
                // @ts-expect-error -- `dispatcher` is a real, Node-specific fetch extension not in the lib.dom.d.ts fetch types
                dispatcher: freshConnectionDispatcher,
            });
            if (res.ok) return extractText(model, await res.json());

            lastError = `${res.status} ${await res.text()}`;
            if (res.status < 500 && res.status !== 429) break;
        } catch (err) {
            const cause = err instanceof Error && err.cause ? ` (cause: ${err.cause})` : '';
            lastError = `${err}${cause}`;
            if (err instanceof Error && err.name === 'TimeoutError') break;
        }
        const backoffMs = 3_000 * attempt + Math.random() * 2_000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    throw new Error(`${model.label} request to ${model.endpoint} failed: ${lastError}`);
}
