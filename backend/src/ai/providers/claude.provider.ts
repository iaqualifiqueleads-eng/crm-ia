import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from '@prisma/client';
import {
  AIProvider, ChatMessage, ChatRequest, ChatResponse, ToolCall, ToolDefinition,
} from '../ai.types';

/**
 * Provider para a Anthropic Messages API.
 * Docs: https://docs.claude.com/en/api/messages
 *
 * Diferenças importantes do formato Anthropic:
 *  - O `system` é parâmetro top-level, não vai no array messages
 *  - Mensagens alternam strict user/assistant (não pode user-user, assistant-assistant)
 *  - Tool calls vêm em content blocks tipados (tool_use)
 *  - Tool results voltam como content blocks (tool_result) dentro de user message
 */
@Injectable()
export class ClaudeProvider implements AIProvider {
  readonly providerName = AiProvider.CLAUDE;
  readonly availableModels = [
    'claude-opus-4-7', 'claude-opus-4-6',
    'claude-sonnet-4-6', 'claude-haiku-4-5',
  ];

  private readonly logger = new Logger(ClaudeProvider.name);
  private readonly apiKey: string;
  private readonly endpoint = 'https://api.anthropic.com/v1/messages';
  private readonly apiVersion = '2023-06-01';

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ANTHROPIC_API_KEY') ?? '';
    if (!this.apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY não configurada — chamadas vão falhar');
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const body = this.buildBody(req);

    const t0 = Date.now();
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.apiVersion,
      },
      body: JSON.stringify(body),
    });
    const latency = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Claude API ${res.status}: ${errText}`);
      throw new Error(`Claude API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await res.json();
    this.logger.debug(`Claude chat ok (${latency}ms, ${data.usage?.input_tokens}/${data.usage?.output_tokens} tokens)`);

    return this.parseResponse(data);
  }

  // ----------------------------------------------------------
  // Construção do body
  // ----------------------------------------------------------
  private buildBody(req: ChatRequest) {
    return {
      model: req.model,
      system: req.systemPrompt,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      messages: this.convertMessages(req.messages),
      ...(req.tools && req.tools.length > 0
        ? { tools: this.convertTools(req.tools) }
        : {}),
    };
  }

  private convertMessages(messages: ChatMessage[]): any[] {
    // Claude exige alternância estrita user/assistant
    // e tool_result vai como content block tipado dentro de uma mensagem user.
    const out: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue; // já tratado fora

      if (msg.role === 'tool') {
        // Resposta de tool — vira content block do tipo tool_result em user
        out.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolCallId,
            content: msg.content,
          }],
        });
        continue;
      }

      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        // Assistant que chamou tools — combina texto + tool_use blocks
        const blocks: any[] = [];
        if (msg.content?.trim()) blocks.push({ type: 'text', text: msg.content });
        for (const tc of msg.toolCalls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        out.push({ role: 'assistant', content: blocks });
        continue;
      }

      // Mensagens normais
      out.push({ role: msg.role, content: msg.content });
    }

    return out;
  }

  private convertTools(tools: ToolDefinition[]) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  // ----------------------------------------------------------
  // Parse da resposta
  // ----------------------------------------------------------
  private parseResponse(data: any): ChatResponse {
    let textOutput = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content ?? []) {
      if (block.type === 'text') {
        textOutput += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input ?? {},
        });
      }
    }

    return {
      content: textOutput,
      toolCalls,
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      finishReason: data.stop_reason ?? 'unknown',
      providerMessageId: data.id,
    };
  }
}
