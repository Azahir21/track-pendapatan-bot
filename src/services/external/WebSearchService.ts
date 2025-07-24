import { google } from 'googleapis';
import createDebug from 'debug';

const debug = createDebug('bot:web-search');

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
  displayLink: string;
}

export interface IWebSearchService {
  search(query: string, numResults?: number): Promise<SearchResult[]>;
  searchTrends(query: string): Promise<SearchResult[]>;
}

export class WebSearchService implements IWebSearchService {
  private customSearch: any;
  private searchEngineId: string;

  constructor() {
    this.customSearch = google.customsearch('v1');
    this.searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || '';
  }

  public async search(
    query: string,
    numResults: number = 5,
  ): Promise<SearchResult[]> {
    try {
      debug('Searching for:', query);

      const response = await this.customSearch.cse.list({
        auth: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        cx: this.searchEngineId,
        q: query,
        num: numResults,
      });

      const items = response.data.items || [];

      return items.map((item: any) => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link,
        displayLink: item.displayLink,
      }));
    } catch (error) {
      debug('Error searching:', error);
      return [];
    }
  }

  public async searchTrends(query: string): Promise<SearchResult[]> {
    const trendQueries = [
      `${query} market trends 2024 indonesia`,
      `${query} economic factors indonesia`,
      `${query} business trends southeast asia`,
      `indonesia automotive industry trends`,
      `garage business trends indonesia`,
    ];

    const allResults: SearchResult[] = [];

    for (const trendQuery of trendQueries) {
      const results = await this.search(trendQuery, 3);
      allResults.push(...results);
    }

    return allResults.slice(0, 10); // Return top 10 most relevant results
  }
}
