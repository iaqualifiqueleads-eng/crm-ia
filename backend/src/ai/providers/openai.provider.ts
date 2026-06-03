import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from '@prisma/client';
import {
  AIProvider, ChatMessage, ChatRequest, ChatResponse, ToolCall, ToolDefinition,
} from '../ai.types';

/**
 * Provider para a OpenAI Chat Completions API.
 * Docs: https://platform.openai.com/docs/api-reference/chat
 *
 * Diferenças do formato OpenAI:
 *  - System prompt vai como mensagem com role 'system' (no array messages)
 *  - Tool calls: assistant message tem array `tool_calls`
 *  - Tool results: mensagem com role 'tool' e tool_call_id
 *  - Arguments de tool_calls vêm como STRING JSON (precisa parse)
 */
@Injectable()
export class OpenAIProvider implements AIProvider {
  readonly providerName = AiProvider.OPENAI;
  readonly availableModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'];

  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly apiKey: string;
  private readonly endpoint = 'https://api.openai.com/v1/chat/completions';

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY') ?? '';
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY não configurada — chamadas vão falhar');
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const body = this.buildBody(req);

    const t0 = Date.now();
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const latency = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`OpenAI API ${res.status}: ${errText}`);
      throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await res.json();
    this.logger.debug(`OpenAI chat ok (${latency}ms, ${data.usage?.prompt_tokens}/${data.usage?.completion_tokens} tokens)`);

    return this.parseResponse(data);
  }

  // ----------------------------------------------------------
  // Build body
  // ----------------------------------------------------------
  private buildBody(req: ChatRequest) {
    const messages: any[] = [
      { role: 'system', content: req.systemPrompt },
      ...this.convertMessages(req.messages),
    ];

    const body: any = {
      model: req.model,
      messages,
      max_tokens: req.maxTokens,
    };

    // o1-mini não aceita temperature
    if (!req.model.startsWith('o1')) {
      body.temperature = req.temperature;
    }

    if (req.tools && req.tools.length > 0) {
      body.tools = this.convertTools(req.tools);
      body.tool_choice = 'auto';
    }

    return body;
  }

  private convertMessages(messages: ChatMessage[]): any[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            tool_call_id: m.toolCallId,
            content: m.content,
          };
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          return {
            role: 'assistant',
            content: m.content || null,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          };
        }
        return { role: m.role, content: m.content };
      });
  }

  private convertTools(tools: ToolDefinition[]) {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  // ----------------------------------------------------------
  // Parse response
  // ----------------------------------------------------------
  private parseResponse(data: any): ChatResponse {
    const choice = data.choices?.[0] ?? {};
    const message = choice.message ?? {};

    const toolCalls: ToolCall[] = [];
    for (const tc of message.tool_calls ?? []) {
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(tc.function?.arguments ?? '{}');
      } catch (e) {
        this.logger.warn(`Falha ao parsear arguments do tool_call: ${tc.function?.arguments}`);
      }
      toolCalls.push({
        id: tc.id,
        name: tc.function?.name,
        arguments: args,
      });
    }

    return {
      content: message.content ?? '',
      toolCalls,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? 'unknown',
      providerMessageId: data.id,
    };
  }
}
