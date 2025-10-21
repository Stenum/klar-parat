declare module 'openai' {
  export default class OpenAI {
    constructor(config: { apiKey: string });
    chat: {
      completions: {
        create(input: {
          model: string;
          temperature: number;
          max_tokens: number;
          messages: { role: string; content: string }[];
        }): Promise<{
          choices?: { message?: { content?: string } }[];
        }>;
      };
    };
  }
}
