import { OPENAI_GENERATION_MODEL } from "@/lib/content/config";

type OpenAIResponse = {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

export type AIResult<T> = {
  parsed: T;
  raw: OpenAIResponse;
  model: string;
};

function extractOutputText(response: OpenAIResponse) {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  throw new Error("OpenAI response did not contain structured output.");
}

export function getAIStatus() {
  return {
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    liveGenerationEnabled: Boolean(process.env.OPENAI_API_KEY),
    model: OPENAI_GENERATION_MODEL
  };
}

export async function requestStructuredContent<T>({
  name,
  instructions,
  input,
  schema,
  useWebSearch = false
}: {
  name: string;
  instructions: string;
  input: string;
  schema: Record<string, unknown>;
  useWebSearch?: boolean;
}): Promise<AIResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it in AWS Amplify environment variables.");
  }
  const model = OPENAI_GENERATION_MODEL;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      ...(useWebSearch ? { tools: [{ type: "web_search" }] } : {}),
      text: {
        format: {
          type: "json_schema",
          name,
          strict: true,
          schema
        }
      }
    }),
    cache: "no-store"
  });
  const raw = (await response.json()) as OpenAIResponse;
  if (!response.ok) throw new Error(raw.error?.message ?? "OpenAI request failed.");
  return { parsed: JSON.parse(extractOutputText(raw)) as T, raw, model };
}
