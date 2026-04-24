/**
 * Web-search provider adapter. Powers the `webSearch` agent tool so the
 * agent can fetch fresh links when the user asks ("find a photo of X",
 * "what's the latest news on Y").
 *
 * Env switches:
 *   SEARCH_PROVIDER=tavily          # or "serper" or "none"
 *   TAVILY_API_KEY=...              # https://tavily.com
 *   SERPER_API_KEY=...              # https://serper.dev
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  id: string;
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

class NoneProvider implements SearchProvider {
  id = "none";
  async search(): Promise<SearchResult[]> {
    throw new Error(
      "No SEARCH_PROVIDER configured. Set SEARCH_PROVIDER=tavily (+ TAVILY_API_KEY) or =serper (+ SERPER_API_KEY).",
    );
  }
}

class TavilyProvider implements SearchProvider {
  id = "tavily";
  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const key = process.env.TAVILY_API_KEY;
    if (!key) throw new Error("TAVILY_API_KEY not set");
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: Math.min(10, Math.max(1, limit)),
        search_depth: "basic",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`tavily ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      results?: Array<{ title: string; url: string; content: string }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
    }));
  }
}

class SerperProvider implements SearchProvider {
  id = "serper";
  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const key = process.env.SERPER_API_KEY;
    if (!key) throw new Error("SERPER_API_KEY not set");
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: Math.min(10, Math.max(1, limit)) }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`serper ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      organic?: Array<{ title: string; link: string; snippet: string }>;
    };
    return (data.organic ?? []).map((r) => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    }));
  }
}

export function getSearchProvider(): SearchProvider {
  const id = (process.env.SEARCH_PROVIDER ?? "none").toLowerCase();
  switch (id) {
    case "tavily":
      return new TavilyProvider();
    case "serper":
      return new SerperProvider();
    default:
      return new NoneProvider();
  }
}
