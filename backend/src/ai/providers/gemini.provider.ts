import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from '@prisma/client';
import {
  AIProvider, ChatMessage, ChatRequest, ChatResponse, ToolCall, ToolDefinition,
} from '../ai.types';

/**
 * Provider para Google Gemini.
 * Docs: https://ai.google.dev/api/rest/v1beta/models/generateContent
 *
 * Diferenças do Gemini:
 *  - Sem role 'system' nativo — usa `systemInstruction` no top-level
 *  - Role 'assistant' chama-se 'model' aqui
 *  - Role 'tool' chama-se 'function' e o conteúdo é functionResponse tipado
 *  - Function calls vêm em parts[].functionCall
 *  - Tokens em `usageMetadata` com nomes diferentes
 */
@Injectable()
export class GeminiProvider implements AIProvider {
  readonly providerName = AiProvider.GEMINI;
  readonly availableModels = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];

  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('GEMINI_API_KEY') ?? '';
    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY não configurada — chamadas vão falhar');
    }
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const url = `${this.baseUrl}/${req.model}:generateContent?key=${this.apiKey}`;
    const body = this.buildBody(req);

    const t0 = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const latency = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Gemini API ${res.status}: ${errText}`);
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data: any = await res.json();
    this.logger.debug(`Gemini chat ok (${latency}ms)`);
    return this.parseResponse(data);
  }

  // ----------------------------------------------------------
  // Build body
  // ----------------------------------------------------------
  private buildBody(req: ChatRequest) {
    const body: any = {
      systemInstruction: {
        parts: [{ text: req.systemPrompt }],
      },
      contents: this.convertMessages(req.messages),
      generationConfig: {
        temperature: req.temperature,
        maxOutputTokens: req.maxTokens,
      },
    };

    if (req.tools && req.tools.length > 0) {
      body.tools = [{
        functionDeclarations: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      }];
    }
    return body;
  }

  private convertMessages(messages: ChatMessage[]): any[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'function',
            parts: [{
              functionResponse: {
                name: m.toolName,
                response: this.safeParse(m.content),
              },
            }],
          };
        }
        if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
          const parts: any[] = [];
          if (m.content?.trim()) parts.push({ text: m.content });
          for (const tc of m.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.arguments,
              },
            });
          }
          return { role: 'model', parts };
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        };
      });
  }

  // ----------------------------------------------------------
  // Parse response
  // ----------------------------------------------------------
  private parseResponse(data: any): ChatResponse {
    const candidate = data.candidates?.[0] ?? {};
    const parts = candidate.content?.parts ?? [];

    let text = '';
    const toolCalls: ToolCall[] = [];
    let toolCallCounter = 0;

    for (const part of parts) {
      if (part.text) {
        text += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          // Gemini não devolve id — geramos um determinístico
          id: `gem_${Date.now()}_${toolCallCounter++}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args ?? {},
        });
      }
    }

    return {
      content: text,
      toolCalls,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
      },
      finishReason: candidate.finishReason ?? 'unknown',
      providerMessageId: data.responseId,
    };
  }

  private safeParse(s: string): any {
    try { return JSON.parse(s); } catch { return { result: s }; }
  }
}
