import { CustomAiProviderItem } from '../types';

export const BUILTIN_AI_PROVIDERS: CustomAiProviderItem[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek AI (深度求索)',
    protocolType: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    note: '极速、超高性价比顶级模型，剧情与角色扮演演绎极其出色',
    modelsPreset: ['deepseek-chat', 'deepseek-reasoner'],
    isBuiltIn: true,
  },
  {
    id: 'openai',
    name: 'OpenAI (官方)',
    protocolType: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    note: 'OpenAI 官方接口，支持 GPT-4o、GPT-4o-mini、o1/o3 等',
    modelsPreset: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'o1-mini', 'o3-mini', 'gpt-3.5-turbo'],
    isBuiltIn: true,
  },
  {
    id: 'gemini',
    name: 'Google Gemini (官方 Key)',
    protocolType: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-3.6-flash',
    note: '使用您的 Google AI Studio 专属密钥，响应极快、上下文超长',
    modelsPreset: ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview', 'gemini-2.0-flash-001'],
    isBuiltIn: true,
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic / 中转)',
    protocolType: 'openai',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
    note: '文学质感与长篇对白细腻度极高的高级模型',
    modelsPreset: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    isBuiltIn: true,
  },
  {
    id: 'siliconflow',
    name: '硅基流动 (SiliconFlow)',
    protocolType: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    note: '国内极速聚合平台，包含满血 DeepSeek-V3/R1、Qwen2.5 等，充值/赠金高性价比',
    modelsPreset: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen2.5-32B-Instruct',
      'Qwen/Qwen2.5-14B-Instruct',
      'meta-llama/Meta-Llama-3.1-70B-Instruct',
    ],
    isBuiltIn: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (全球聚合大模型)',
    protocolType: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    note: '聚合全球数百种模型 (Claude, GPT, Gemini, Llama, DeepSeek 等)，支持单 Key 畅用',
    modelsPreset: [
      'anthropic/claude-3.5-sonnet',
      'deepseek/deepseek-r1',
      'deepseek/deepseek-chat',
      'google/gemini-2.0-flash-001',
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    customHeaders: {
      'HTTP-Referer': 'https://ultrawoman.local',
      'X-Title': 'Tokusatsu AI Simulator',
    },
    isBuiltIn: true,
  },
  {
    id: 'agnes',
    name: 'Agnes AI (官方聚合 API)',
    protocolType: 'openai',
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    defaultModel: 'agnes-2.5-flash',
    note: 'Agnes AI 官方聚合 API (基地址: https://apihub.agnes-ai.com/v1)。深度思考推荐使用 deepseek-r1 / deepseek-reasoner / agnes-2.5-pro / agnes-2.5-flash 等推理模型。',
    modelsPreset: [
      'agnes-2.5-flash',
      'agnes-2.5-pro',
      'deepseek-r1',
      'deepseek-reasoner',
      'deepseek-chat',
      'agnes-2.0-flash',
      'gpt-4o-mini',
      'gpt-4o',
      'claude-3-5-sonnet',
      'o3-mini',
      'o1-mini'
    ],
    isBuiltIn: true,
  },
  {
    id: 'moonshot',
    name: '月之暗面 (Kimi / Moonshot)',
    protocolType: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    note: '中文理解与长文本能力强大，支持 moonshot-v1-8k/32k/128k',
    modelsPreset: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    isBuiltIn: true,
  },
  {
    id: 'zhipu',
    name: '智谱清言 (Zhipu GLM-4)',
    protocolType: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    note: '国内顶级大模型，glm-4-flash 高性价比/免费调用，glm-4-plus 性能强劲',
    modelsPreset: ['glm-4-flash', 'glm-4-plus', 'glm-4-air', 'glm-4-0520'],
    isBuiltIn: true,
  },
  {
    id: 'aliyun_qwen',
    name: '阿里云通义千问 (DashScope / Qwen)',
    protocolType: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    note: '阿里云百炼 / 通义千问 OpenAI 兼容模式，覆盖 qwen-max / qwen-plus / qwen-turbo',
    modelsPreset: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long', 'qwen2.5-72b-instruct'],
    isBuiltIn: true,
  },
  {
    id: 'doubao',
    name: '火山引擎 / 字节豆包 (Doubao)',
    protocolType: 'openai',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
    note: '火山引擎大模型方舟服务，需使用在控制台创建的推理接入点 Endpoint 作为 Model',
    modelsPreset: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k'],
    isBuiltIn: true,
  },
  {
    id: 'yi',
    name: '零一万物 (01.AI / Yi)',
    protocolType: 'openai',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    defaultModel: 'yi-lightning',
    note: '零一万物 Yi 系列大模型，yi-lightning 极速高智力，yi-large 表现出众',
    modelsPreset: ['yi-lightning', 'yi-large', 'yi-medium', 'yi-large-rag'],
    isBuiltIn: true,
  },
  {
    id: 'stepfun',
    name: '阶跃星辰 (StepFun)',
    protocolType: 'openai',
    baseUrl: 'https://api.stepfun.com/v1',
    defaultModel: 'step-1-8k',
    note: '阶跃星辰 Step 系列多模态与超长文本大模型',
    modelsPreset: ['step-1-8k', 'step-1-32k', 'step-1-128k', 'step-2-16k'],
    isBuiltIn: true,
  },
  {
    id: 'ollama_local',
    name: 'Ollama (本地自建大模型)',
    protocolType: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:14b',
    note: '在自己电脑本地运行的开源大模型，完全隐私与离线，无需消耗 API 费用',
    modelsPreset: ['qwen2.5:14b', 'deepseek-r1:14b', 'llama3.1:8b', 'mistral', 'gemma2:9b'],
    isBuiltIn: true,
  },
  {
    id: 'lmstudio_local',
    name: 'LM Studio (本地推理服务)',
    protocolType: 'openai',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    note: '通过 LM Studio 开启本地 Local Inference Server 的 OpenAI 兼容接口',
    modelsPreset: ['local-model'],
    isBuiltIn: true,
  },
  {
    id: 'oneapi_custom',
    name: 'OneAPI / NewAPI / 自建中转站',
    protocolType: 'openai',
    baseUrl: 'https://api.oneapi.pro/v1',
    defaultModel: 'gpt-4o-mini',
    note: '通用 OpenAI 兼容代理、第三方中转分发站或自建 API Gateway',
    modelsPreset: ['gpt-4o-mini', 'gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat'],
    isBuiltIn: true,
  },
];

/**
 * 智能规范化 OpenAI 兼容接口 Base URL (自动补充 /v1, 去除尾部斜杠，自动修复常见服务商地址)
 */
export function normalizeOpenAiBaseUrl(rawUrl: string): string {
  if (!rawUrl || !rawUrl.trim()) return 'https://api.openai.com/v1';
  let cleaned = rawUrl.trim().replace(/\/+$/, '');
  
  // If user pasted full endpoint ending with /chat/completions, strip it back to base URL
  if (cleaned.endsWith('/chat/completions')) {
    cleaned = cleaned.replace(/\/chat\/completions$/, '');
  }
  if (cleaned.endsWith('/messages')) {
    cleaned = cleaned.replace(/\/messages$/, '');
  }

  // Agnes AI intelligent URL correction (apihub.agnes-ai.com/v1 is the official gateway)
  if (cleaned.includes('agnes.ai') || cleaned.includes('agnes-ai.com')) {
    if (!cleaned.includes('apihub.agnes-ai.com')) {
      return 'https://apihub.agnes-ai.com/v1';
    }
  }

  // If already has /v1 or /v2 or /v4 or /v3 or compatible-mode/v1, return cleaned
  if (
    cleaned.endsWith('/v1') ||
    cleaned.endsWith('/v2') ||
    cleaned.endsWith('/v3') ||
    cleaned.endsWith('/v4') ||
    cleaned.includes('/v1/') ||
    cleaned.includes('generativelanguage.googleapis.com') ||
    cleaned.includes('dashscope.aliyuncs.com')
  ) {
    return cleaned;
  }

  // Otherwise append /v1 for standard OpenAI-compatible proxies
  return `${cleaned}/v1`;
}

/**
 * 获取初始的服务商列表 (合并内置服务商与用户已有自定义服务商)
 */
export function getInitialCustomProviders(existingCustom?: CustomAiProviderItem[]): CustomAiProviderItem[] {
  if (!existingCustom || existingCustom.length === 0) {
    return [...BUILTIN_AI_PROVIDERS];
  }

  // Preserve user custom providers and merge with builtin
  const result: CustomAiProviderItem[] = [];
  const existingMap = new Map<string, CustomAiProviderItem>();
  existingCustom.forEach((p) => existingMap.set(p.id, p));

  // Add all built-ins (keeping user overrides if customized, but auto-repair known broken legacy URLs)
  BUILTIN_AI_PROVIDERS.forEach((builtin) => {
    if (existingMap.has(builtin.id)) {
      const userCopy = existingMap.get(builtin.id)!;
      // Auto-repair legacy Agnes URL
      if (builtin.id === 'agnes' && (userCopy.baseUrl.includes('api.agnes.ai') || userCopy.baseUrl.includes('https://agnes.ai'))) {
        userCopy.baseUrl = 'https://apihub.agnes-ai.com/v1';
        if (userCopy.defaultModel === 'gpt-4o-mini' || !userCopy.defaultModel) {
          userCopy.defaultModel = 'agnes-2.5-flash';
        }
      }
      result.push({ ...builtin, ...userCopy });
      existingMap.delete(builtin.id);
    } else {
      result.push(builtin);
    }
  });

  // Add any pure custom providers added by user
  existingMap.forEach((userProv) => {
    result.push(userProv);
  });

  return result;
}

/**
 * 根据 ID 获取指定服务商配置
 */
export function findProviderById(
  providerId: string,
  customProviders?: CustomAiProviderItem[]
): CustomAiProviderItem | undefined {
  const list = customProviders && customProviders.length > 0 ? customProviders : BUILTIN_AI_PROVIDERS;
  return list.find((p) => p.id === providerId);
}
