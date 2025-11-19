import { GoogleGenAI, Chat, GenerateContentResponse, Content, Part } from "@google/genai";
import { Message, Role, Attachment, ModelConfig } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export class GeminiService {
  private chat: Chat | null = null;
  private currentModelId: string | null = null;
  
  // Helper to format history for the API
  private formatHistory(messages: Message[]): Content[] {
    return messages
      .filter(m => !m.isError) // Exclude error messages
      .map(m => {
        const parts: Part[] = [];

        // Add text content if exists
        if (m.content) {
            parts.push({ text: m.content });
        }
        
        // Add attachments
        if (m.role === Role.USER && m.attachments) {
            m.attachments.forEach(att => {
                if (att.isText) {
                    // Text files or extracted text from DOCX
                    parts.push({ text: `\n[Attachment: ${att.name}]\n${att.data}\n` });
                } else {
                    // Images or native PDF support
                    parts.push({
                        inlineData: {
                            data: att.data,
                            mimeType: att.mimeType
                        }
                    });
                }
            });
        }

        return {
          role: m.role,
          parts: parts
        };
      });
  }

  public async startChat(previousMessages: Message[] = [], config: ModelConfig) {
    const validHistory = previousMessages.filter(m => m.id !== 'welcome');
    const history = this.formatHistory(validHistory);
    
    this.currentModelId = config.apiModel;

    // Configure tools (Grounding)
    const tools = [];
    if (config.useGrounding) {
        tools.push({ googleSearch: {} });
    }

    // Configure Thinking for Reasoning model
    // We use a high budget for complex tasks on the 'Pro' model
    const thinkingConfig = config.id === 'reasoning' 
        ? { thinkingBudget: 16384 } 
        : undefined;

    this.chat = ai.chats.create({
      model: config.apiModel,
      history: history,
      config: {
        systemInstruction: "You are Cortex, an advanced AI assistant. You are helpful, harmless, and honest. Use markdown for formatting, such as headers (##), lists, and bold text. If the user provides a document, analyze its content.",
        tools: tools.length > 0 ? tools : undefined,
        thinkingConfig: thinkingConfig,
      },
    });
  }

  public async *sendMessageStream(
    message: string, 
    attachments: Attachment[] = [],
    config: ModelConfig
  ): AsyncGenerator<GenerateContentResponse, void, unknown> {
    
    // Re-initialize chat if model changed or not initialized
    if (!this.chat || this.currentModelId !== config.apiModel) {
        // If chat isn't ready, we try to start it with empty history, though App.tsx usually handles this.
        await this.startChat([], config);
    }

    if (!this.chat) throw new Error("Chat not initialized");

    try {
      // Construct message content
      const parts: (string | Part)[] = [];
      
      if (message) parts.push({ text: message });
      
      if (attachments) {
          attachments.forEach(att => {
              if (att.isText) {
                  parts.push({ text: `\n[Attachment: ${att.name}]\n${att.data}\n` });
              } else {
                  parts.push({
                      inlineData: {
                          data: att.data,
                          mimeType: att.mimeType
                      }
                  });
              }
          });
      }

      const result = await this.chat.sendMessageStream({ 
        message: parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts 
      });
      
      for await (const chunk of result) {
        yield chunk as GenerateContentResponse;
      }
    } catch (error) {
      console.error("Error sending message to Gemini:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();