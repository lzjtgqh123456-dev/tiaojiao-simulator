export interface PromptCategoryGroup {
  id: string;
  name: string;
  icon: string;
  prompts: string[];
}

export const UNIVERSAL_PROMPT_GROUPS: PromptCategoryGroup[] = [];

// Flat default universal list for compact display
export const DEFAULT_UNIVERSAL_PROMPTS: string[] = [];
