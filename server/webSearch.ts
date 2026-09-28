export type SearchEngineId = 'google' | 'bing' | 'duckduckgo' | 'baidu' | 'sogou' | 'wikipedia';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  engine: SearchEngineId;
}

export interface WebSearchOptions {
  query: string;
  engine?: SearchEngineId;
  maxResults?: number;
  characterKeywords?: string;
  timeoutMs?: number;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

/**
 * Clean and normalize search query from user prompt
 */
export function extractCleanSearchQuery(userMessage: string, characterKeywords?: string): string {
  if (!userMessage) return '';
  let clean = userMessage
    .replace(/[“”"'`]/g, '')
    .replace(/^【.*?】/, '')
    .replace(/请问|你知道|查一下|搜索|能不能告诉我|了解|帮我查/g, '')
    .replace(/[吗呢吧呀？\?！!。]+$/g, '')
    .trim();

  if (characterKeywords && characterKeywords.trim()) {
    const kw = characterKeywords.trim();
    if (!clean.includes(kw)) {
      clean = `${kw} ${clean}`;
    }
  }

  // Cap length to reasonable query size
  if (clean.length > 80) {
    clean = clean.slice(0, 80).trim();
  }

  return clean || userMessage.slice(0, 50).trim();
}

/**
 * Safe HTML Entity Decoding without external dependencies
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
}

/**
 * Safe HTML Tag Stripping without external dependencies
 */
function stripHtmlTags(html: string): string {
  if (!html) return '';
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// Optional lazy loader for cheerio (if installed in node_modules, else null)
let _cachedCheerio: any = undefined;
async function getCheerio() {
  if (_cachedCheerio !== undefined) return _cachedCheerio;
  try {
    // Dynamic import to prevent startup crash if cheerio is not installed
    // @ts-ignore
    const mod: any = await import('cheerio');
    _cachedCheerio = mod?.load ? mod : (mod?.default || mod);
  } catch {
    _cachedCheerio = null;
  }
  return _cachedCheerio;
}

/**
 * Search Wikipedia (Chinese & Global) via Wikipedia OpenSearch JSON API
 */
async function searchWikipedia(query: string, maxResults = 3, timeoutMs = 8000): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const endpoint = `https://zh.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
      query
    )}&limit=${maxResults}&namespace=0&format=json`;

    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': 'UltrawomanInterrogationSimulator/1.0 (WebSearchService)',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const data = await res.json();
      // data format: [query, [titles], [descriptions], [urls]]
      const titles: string[] = data[1] || [];
      const descriptions: string[] = data[2] || [];
      const urls: string[] = data[3] || [];

      for (let i = 0; i < titles.length; i++) {
        if (titles[i] && (descriptions[i] || urls[i])) {
          results.push({
            title: titles[i],
            snippet: descriptions[i] || `${titles[i]} - 维基百科条目`,
            url: urls[i] || `https://zh.wikipedia.org/wiki/${encodeURIComponent(titles[i])}`,
            engine: 'wikipedia',
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[WebSearch Wikipedia error]:', err?.message);
  }
  return results.slice(0, maxResults);
}

/**
 * Search DuckDuckGo (HTML search & Instant Answer API)
 */
async function searchDuckDuckGo(query: string, maxResults = 3, timeoutMs = 8000): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Try HTML search endpoint
    const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const html = await res.text();
      const cheerio = await getCheerio();

      if (cheerio) {
        const $ = cheerio.load(html);
        $('.result').each((_: any, el: any) => {
          if (results.length >= maxResults) return;
          const titleEl = $(el).find('.result__title a');
          const snippetEl = $(el).find('.result__snippet');

          const title = titleEl.text().trim();
          let href = titleEl.attr('href') || '';
          if (href.includes('uddg=')) {
            try {
              const match = href.match(/uddg=([^&]+)/);
              if (match && match[1]) {
                href = decodeURIComponent(match[1]);
              }
            } catch {}
          }
          const snippet = snippetEl.text().trim();

          if (title && href) {
            results.push({
              title,
              url: href,
              snippet: snippet || title,
              engine: 'duckduckgo',
            });
          }
        });
      } else {
        // Zero-dependency pure Regex parsing
        const blockRegex = /<div[^>]*class="[^"]*result\b[^"]*"[^>]*>([\s\S]*?)<\/div\s*>\s*<\/div\s*>/gi;
        let match: RegExpExecArray | null;
        while ((match = blockRegex.exec(html)) !== null) {
          if (results.length >= maxResults) break;
          const block = match[1];
          const linkMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*href="([^"]*)"/i) ||
                            block.match(/<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]*)"/i) ||
                            block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
          const titleMatch = block.match(/<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
          const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
                               block.match(/<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

          if (linkMatch) {
            let href = linkMatch[1];
            if (href.includes('uddg=')) {
              try {
                const m = href.match(/uddg=([^&]+)/);
                if (m && m[1]) href = decodeURIComponent(m[1]);
              } catch {}
            }
            const title = stripHtmlTags(titleMatch ? titleMatch[1] : linkMatch[2] || '');
            const snippet = stripHtmlTags(snippetMatch ? snippetMatch[1] : '');
            if (title && href && !href.startsWith('/')) {
              results.push({
                title,
                url: href,
                snippet: snippet || title,
                engine: 'duckduckgo',
              });
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[WebSearch DuckDuckGo error]:', err?.message);
  }

  // If DuckDuckGo HTML had 0 results (e.g. rate limit), try instant answer API
  if (results.length === 0) {
    try {
      const instantRes = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      );
      if (instantRes.ok) {
        const data = await instantRes.json();
        if (data.AbstractText) {
          results.push({
            title: data.Heading || query,
            snippet: data.AbstractText,
            url: data.AbstractURL || 'https://duckduckgo.com/?q=' + encodeURIComponent(query),
            engine: 'duckduckgo',
          });
        }
        if (Array.isArray(data.RelatedTopics)) {
          for (const item of data.RelatedTopics) {
            if (results.length >= maxResults) break;
            if (item.Text && item.FirstURL) {
              results.push({
                title: item.Text.split(' - ')[0] || item.Text.slice(0, 30),
                snippet: item.Text,
                url: item.FirstURL,
                engine: 'duckduckgo',
              });
            }
          }
        }
      }
    } catch {}
  }

  return results.slice(0, maxResults);
}

/**
 * Search Bing
 */
async function searchBing(query: string, maxResults = 3, timeoutMs = 8000): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const endpoint = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-Hans`;
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const html = await res.text();
      const cheerio = await getCheerio();

      if (cheerio) {
        const $ = cheerio.load(html);
        $('li.b_algo').each((_: any, el: any) => {
          if (results.length >= maxResults) return;
          const titleEl = $(el).find('h2 a');
          const snippetEl = $(el).find('.b_caption p, .b_lineclamp2, .b_snippet');

          const title = titleEl.text().trim();
          const url = titleEl.attr('href') || '';
          const snippet = snippetEl.text().trim();

          if (title && url) {
            results.push({
              title,
              url,
              snippet: snippet || title,
              engine: 'bing',
            });
          }
        });
      } else {
        const blockRegex = /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
        let match: RegExpExecArray | null;
        while ((match = blockRegex.exec(html)) !== null) {
          if (results.length >= maxResults) break;
          const content = match[1];
          const titleMatch = content.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
          const snippetMatch = content.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          if (titleMatch) {
            const url = titleMatch[1];
            const title = stripHtmlTags(titleMatch[2]);
            const snippet = stripHtmlTags(snippetMatch ? snippetMatch[1] : '');
            if (title && url) {
              results.push({
                title,
                url,
                snippet: snippet || title,
                engine: 'bing',
              });
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[WebSearch Bing error]:', err?.message);
  }
  return results.slice(0, maxResults);
}

/**
 * Search Baidu
 */
async function searchBaidu(query: string, maxResults = 3, timeoutMs = 8000): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const endpoint = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=${maxResults + 2}`;
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const html = await res.text();
      const cheerio = await getCheerio();

      if (cheerio) {
        const $ = cheerio.load(html);
        $('.result, .c-container').each((_: any, el: any) => {
          if (results.length >= maxResults) return;
          const titleEl = $(el).find('h3 a, .c-title a');
          const snippetEl = $(el).find('.c-abstract, .c-font-normal, .content-right_8Zs40');

          const title = titleEl.text().trim();
          const url = titleEl.attr('href') || '';
          const snippet = snippetEl.text().trim();

          if (title && url) {
            results.push({
              title,
              url,
              snippet: snippet || title,
              engine: 'baidu',
            });
          }
        });
      } else {
        const regex = /<h3[^>]*class="[^"]*t[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(html)) !== null) {
          if (results.length >= maxResults) break;
          const url = match[1];
          const title = stripHtmlTags(match[2]);
          if (title && url) {
            results.push({
              title,
              url,
              snippet: title,
              engine: 'baidu',
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[WebSearch Baidu error]:', err?.message);
  }
  return results.slice(0, maxResults);
}

/**
 * Search Sogou
 */
async function searchSogou(query: string, maxResults = 3, timeoutMs = 8000): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const endpoint = `https://www.sogou.com/web?query=${encodeURIComponent(query)}`;
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const html = await res.text();
      const cheerio = await getCheerio();

      if (cheerio) {
        const $ = cheerio.load(html);
        $('.vrwrap, .rb').each((_: any, el: any) => {
          if (results.length >= maxResults) return;
          const titleEl = $(el).find('h3 a, .vr-title a');
          const snippetEl = $(el).find('.star-wiki, .space-txt, .text-layout');

          const title = titleEl.text().trim();
          let url = titleEl.attr('href') || '';
          if (url && url.startsWith('/')) {
            url = 'https://www.sogou.com' + url;
          }
          const snippet = snippetEl.text().trim();

          if (title && url) {
            results.push({
              title,
              url,
              snippet: snippet || title,
              engine: 'sogou',
            });
          }
        });
      } else {
        const regex = /<h3[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(html)) !== null) {
          if (results.length >= maxResults) break;
          let url = match[1];
          if (url && url.startsWith('/')) url = 'https://www.sogou.com' + url;
          const title = stripHtmlTags(match[2]);
          if (title && url) {
            results.push({
              title,
              url,
              snippet: title,
              engine: 'sogou',
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[WebSearch Sogou error]:', err?.message);
  }
  return results.slice(0, maxResults);
}

/**
 * Search Google
 */
async function searchGoogle(query: string, maxResults = 3, timeoutMs = 8000): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const endpoint = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=zh-CN`;
    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const html = await res.text();
      const cheerio = await getCheerio();

      if (cheerio) {
        const $ = cheerio.load(html);
        $('div.g, div[data-hveid]').each((_: any, el: any) => {
          if (results.length >= maxResults) return;
          const titleEl = $(el).find('h3');
          const linkEl = $(el).find('a');
          const snippetEl = $(el).find('.VwiC3b, .yXK7lf, span.aCOpRe');

          const title = titleEl.text().trim();
          const url = linkEl.attr('href') || '';
          const snippet = snippetEl.text().trim();

          if (title && url && url.startsWith('http')) {
            results.push({
              title,
              url,
              snippet: snippet || title,
              engine: 'google',
            });
          }
        });
      } else {
        const linkRegex = /<a[^>]*href="([^"]*https?:\/\/[^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
        let match: RegExpExecArray | null;
        while ((match = linkRegex.exec(html)) !== null) {
          if (results.length >= maxResults) break;
          const url = match[1];
          const title = stripHtmlTags(match[2]);
          if (title && url && !url.includes('google.com/search')) {
            results.push({
              title,
              url,
              snippet: title,
              engine: 'google',
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[WebSearch Google direct error]:', err?.message);
  }

  // If direct Google encountered captcha/block, seamlessly fallback to DuckDuckGo/Bing
  if (results.length === 0) {
    console.log('[WebSearch Google fallback] Direct Google yielded 0 results, querying DuckDuckGo...');
    const ddgResults = await searchDuckDuckGo(query, maxResults, timeoutMs);
    if (ddgResults.length > 0) {
      return ddgResults.map((r) => ({ ...r, engine: 'google' }));
    }
    const bingResults = await searchBing(query, maxResults, timeoutMs);
    if (bingResults.length > 0) {
      return bingResults.map((r) => ({ ...r, engine: 'google' }));
    }
  }

  return results.slice(0, maxResults);
}

/**
 * Universal Multi-Engine Search Dispatcher
 */
export async function performWebSearch(options: WebSearchOptions): Promise<{
  success: boolean;
  engine: SearchEngineId;
  query: string;
  results: WebSearchResult[];
  error?: string;
}> {
  const engine = options.engine || 'google';
  const query = options.query?.trim() || '';
  const maxResults = Math.min(Math.max(options.maxResults || 3, 1), 6);
  const timeoutMs = options.timeoutMs || 9000;

  if (!query) {
    return {
      success: false,
      engine,
      query: '',
      results: [],
      error: '搜索关键词不能为空',
    };
  }

  console.log(`[WebSearch] Executing search | Engine: ${engine} | Query: "${query}" | Max: ${maxResults}`);

  let results: WebSearchResult[] = [];
  try {
    switch (engine) {
      case 'google':
        results = await searchGoogle(query, maxResults, timeoutMs);
        break;
      case 'bing':
        results = await searchBing(query, maxResults, timeoutMs);
        break;
      case 'duckduckgo':
        results = await searchDuckDuckGo(query, maxResults, timeoutMs);
        break;
      case 'baidu':
        results = await searchBaidu(query, maxResults, timeoutMs);
        break;
      case 'sogou':
        results = await searchSogou(query, maxResults, timeoutMs);
        break;
      case 'wikipedia':
        results = await searchWikipedia(query, maxResults, timeoutMs);
        break;
      default:
        results = await searchGoogle(query, maxResults, timeoutMs);
        break;
    }

    // Graceful fallback if primary engine returned 0 results
    if (results.length === 0) {
      console.warn(`[WebSearch] Engine ${engine} returned 0 results for "${query}", falling back to Wikipedia/DuckDuckGo...`);
      if (engine !== 'duckduckgo') {
        results = await searchDuckDuckGo(query, maxResults, timeoutMs);
      }
      if (results.length === 0 && engine !== 'wikipedia') {
        results = await searchWikipedia(query, maxResults, timeoutMs);
      }
    }

    return {
      success: results.length > 0,
      engine,
      query,
      results,
      error: results.length === 0 ? '未检索到相关条目' : undefined,
    };
  } catch (err: any) {
    console.error(`[WebSearch Critical Error (${engine})]:`, err?.message);
    return {
      success: false,
      engine,
      query,
      results: [],
      error: err?.message || '搜索服务异常',
    };
  }
}

/**
 * Format search results into a clean prompt context block for AI
 */
export function formatSearchPromptSection(
  engine: SearchEngineId,
  query: string,
  results: WebSearchResult[]
): string {
  if (!results || results.length === 0) return '';

  const engineNames: Record<SearchEngineId, string> = {
    google: 'Google 谷歌搜索',
    bing: 'Bing 微软必应',
    duckduckgo: 'DuckDuckGo 隐私检索',
    baidu: '百度搜索 (Baidu)',
    sogou: '搜狗搜索 (Sogou)',
    wikipedia: '维基百科知识库 (Wikipedia)',
  };

  const displayName = engineNames[engine] || engine;

  let prompt = `\n\n=== 🌐【实时互联网多源情报与最新事实检索 (WEB SEARCH GROUNDING)】===`;
  prompt += `\n* 搜索引擎: ${displayName}`;
  prompt += `\n* 核心检索关键词: "${query}"`;
  prompt += `\n* 即时抓取到的最新参考资料 (共 ${results.length} 条):\n`;

  results.forEach((item, idx) => {
    prompt += `\n[${idx + 1}] 📌 《${item.title}》\n    链接: ${item.url}\n    摘要内容: "${item.snippet}"\n`;
  });

  prompt += `\n【角色对白与认知指令（务必遵守）】:\n`;
  prompt += `- 只有当这些资料与【用户当前这句话】和【当前剧情场景】真正相关时，才可以把其中一点自然融进角色口吻的**一句话**里；\n`;
  prompt += `- 如果这些资料与剧情/问题无关（例如同名词条、无关新闻、搜索引擎噪声结果），请【直接忽略】，绝对不要为了"用上资料"而跑题；\n`;
  prompt += `- 严禁在台词里罗列或朗读搜索结果、链接、书名、版本号、百科条目，严禁展开科普讲解；联网只是让角色"恰好知道"某个事实，不是让角色变成解说员；\n`;
  prompt += `- 台词必须以角色身份、结合当前关系与情绪自然说出，长度遵守本次回复风格要求。\n`;

  return prompt;
}

export { performWebSearch as executeWebSearch };
