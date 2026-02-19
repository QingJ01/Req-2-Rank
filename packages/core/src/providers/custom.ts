import { OpenAIProvider } from "./openai.js";

export class CustomOpenAICompatibleProvider extends OpenAIProvider {
  id = "custom";
  name = "Custom OpenAI-Compatible";
}
