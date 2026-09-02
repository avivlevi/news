import Anthropic from '@anthropic-ai/sdk';

/** Reads and compares the articles themselves — the judgement calls. */
export const MODEL_DEEP = 'claude-opus-5';
/** Cheap passes over short lists. */
export const MODEL_FAST = 'claude-sonnet-5';

export type Effort = 'low' | 'medium' | 'high';

interface ToolCall {
  model: string;
  tool: Anthropic.Tool;
  prompt: string;
  maxTokens: number;
  effort: Effort;
}

/**
 * Every model call in the pipeline is the same shape: one prompt, one forced
 * tool, one structured answer. Returns null when the model produced no tool
 * call, which callers treat as "found nothing".
 */
/** A stream that stalls would otherwise hang the whole run; the analysis calls take 1-3 minutes. */
const CALL_TIMEOUT_MS = 5 * 60_000;

export async function callTool<T>(client: Anthropic, call: ToolCall): Promise<T | null> {
  const res = await client.messages.stream({
    model: call.model,
    max_tokens: call.maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort: call.effort },
    tools: [call.tool],
    tool_choice: { type: 'tool', name: call.tool.name },
    messages: [{ role: 'user', content: call.prompt }],
  }, { timeout: CALL_TIMEOUT_MS }).finalMessage();

  const block = res.content.find(b => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') return null;
  return block.input as T;
}

export const makeClient = (apiKey: string) => new Anthropic({ apiKey, maxRetries: 2, timeout: CALL_TIMEOUT_MS });
export type { Anthropic };
