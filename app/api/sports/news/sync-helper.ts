import { prisma } from '@/lib/prisma';
import { normalizeTeamAbbrev } from '@/lib/team-abbrev';
import { createHash } from 'crypto';

const NEWS_FRESHNESS_MS = 30 * 60 * 1000;

const ABBREV_TO_FULL_NAME: Record<string, string> = {
  'ARI': 'Arizona Cardinals', 'ATL': 'Atlanta Falcons', 'BAL': 'Baltimore Ravens',
  'BUF': 'Buffalo Bills', 'CAR': 'Carolina Panthers', 'CHI': 'Chicago Bears',
  'CIN': 'Cincinnati Bengals', 'CLE': 'Cleveland Browns', 'DAL': 'Dallas Cowboys',
  'DEN': 'Denver Broncos', 'DET': 'Detroit Lions', 'GB': 'Green Bay Packers',
  'HOU': 'Houston Texans', 'IND': 'Indianapolis Colts', 'JAX': 'Jacksonville Jaguars',
  'KC': 'Kansas City Chiefs', 'LV': 'Las Vegas Raiders', 'LAC': 'Los Angeles Chargers',
  'LAR': 'Los Angeles Rams', 'MIA': 'Miami Dolphins', 'MIN': 'Minnesota Vikings',
  'NE': 'New England Patriots', 'NO': 'New Orleans Saints', 'NYG': 'New York Giants',
  'NYJ': 'New York Jets', 'PHI': 'Philadelphia Eagles', 'PIT': 'Pittsburgh Steelers',
  'SEA': 'Seattle Seahawks', 'SF': 'San Francisco 49ers', 'TB': 'Tampa Bay Buccaneers',
  'TEN': 'Tennessee Titans', 'WAS': 'Washington Commanders',
};

function stableArticleId(url: string, fallback: string): string {
  const input = url || fallback;
  return createHash('sha256').update(input).digest('hex').slice(0, 40);
}

interface NewsArticle {
  id: string;
  title: string;
  content: string;
  url: string;
  published: string;
  team: string | null;
  source: string;
  categories?: string[];
}

const NFL_TEAM_KEYWORDS: Record<string, string> = {
  'cardinals': 'ARI', 'arizona': 'ARI',
  'falcons': 'ATL', 'atlanta': 'ATL',
  'ravens': 'BAL', 'baltimore': 'BAL',
  'bills': 'BUF', 'buffalo': 'BUF',
  'panthers': 'CAR', 'carolina': 'CAR',
  'bears': 'CHI', 'chicago bears': 'CHI',
  'bengals': 'CIN', 'cincinnati': 'CIN',
  'browns': 'CLE', 'cleveland': 'CLE',
  'cowboys': 'DAL', 'dallas': 'DAL',
  'broncos': 'DEN', 'denver': 'DEN',
  'lions': 'DET', 'detroit': 'DET',
  'packers': 'GB', 'green bay': 'GB',
  'texans': 'HOU', 'houston texans': 'HOU',
  'colts': 'IND', 'indianapolis': 'IND',
  'jaguars': 'JAX', 'jacksonville': 'JAX',
  'chiefs': 'KC', 'kansas city': 'KC',
  'raiders': 'LV', 'las vegas': 'LV',
  'chargers': 'LAC', 'los angeles chargers': 'LAC',
  'rams': 'LAR', 'los angeles rams': 'LAR',
  'dolphins': 'MIA', 'miami': 'MIA',
  'vikings': 'MIN', 'minnesota': 'MIN',
  'patriots': 'NE', 'new england': 'NE',
  'saints': 'NO', 'new orleans': 'NO',
  'giants': 'NYG', 'new york giants': 'NYG',
  'jets': 'NYJ', 'new york jets': 'NYJ',
  'eagles': 'PHI', 'philadelphia': 'PHI',
  'steelers': 'PIT', 'pittsburgh': 'PIT',
  'seahawks': 'SEA', 'seattle': 'SEA',
  '49ers': 'SF', 'san francisco': 'SF', 'niners': 'SF',
  'buccaneers': 'TB', 'tampa bay': 'TB', 'bucs': 'TB',
  'titans': 'TEN', 'tennessee': 'TEN',
  'commanders': 'WAS', 'washington': 'WAS',
};

function extractTeamFromText(text: string): string | null {
  const lower = text.toLowerCase();
  const sortedKeywords = Object.entries(NFL_TEAM_KEYWORDS)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [keyword, abbrev] of sortedKeywords) {
    if (lower.includes(keyword)) {
      return abbrev;
    }
  }
  return null;
}

export async function fetchESPNNews(team?: string): Promise<NewsArticle[]> {
  try {
    const url = team
      ? `https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?team=${team}&limit=50`
      : 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50';

    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) return [];

    const data = await response.json();
    const articles = data.articles || [];

    return articles.map((a: Record<string, unknown>) => {
      const categories = ((a as { categories?: Array<{ description?: string; type?: string; teamId?: string }> }).categories || []);
      const teamCategory = categories.find((c: { type?: string }) => c.type === 'team');
      const teamAbbrev = teamCategory ? normalizeTeamAbbrev((teamCategory as { description?: string }).description || '') : null;

      return {
        id: String((a as { id?: unknown }).id || ''),
        title: String((a as { headline?: unknown }).headline || ''),
        content: String((a as { description?: unknown }).description || ''),
        url: (a as { links?: { web?: { href?: string } } }).links?.web?.href || '',
        published: String((a as { published?: unknown }).published || ''),
        team: teamAbbrev || (team ? normalizeTeamAbbrev(team) : null),
        source: 'espn',
        categories: categories.map((c: { description?: string }) => c.description || ''),
      };
    });
  } catch (error) {
    console.error('[News] ESPN fetch failed:', error);
    return [];
  }
}

export async function fetchNewsAPIArticles(query?: string): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.warn('[News] NEWSAPI_KEY not set, skipping NewsAPI fetch');
    return [];
  }

  try {
    const searchQuery = query || 'NFL football';
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const params = new URLSearchParams({
      q: searchQuery,
      language: 'en',
      sortBy: 'publishedAt',
      from: fromDate,
      pageSize: '50',
      apiKey,
    });

    const response = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[News] NewsAPI fetch failed:', response.status, errorData);
      return [];
    }

    const data = await response.json();
    const articles = data.articles || [];

    return articles.map((a: Record<string, unknown>) => {
      const title = String((a as { title?: unknown }).title || '');
      const description = String((a as { description?: unknown }).description || '');
      const articleUrl = String((a as { url?: unknown }).url || '');
      const publishedAt = String((a as { publishedAt?: unknown }).publishedAt || '');

      const teamFromTitle = extractTeamFromText(title);
      const teamFromDesc = teamFromTitle || extractTeamFromText(description);

      const sourceObj = (a as { source?: { name?: string } }).source;
      const sourceName = sourceObj?.name || 'NewsAPI';

      const articleId = stableArticleId(articleUrl, `${title}-${publishedAt}`);

      return {
        id: articleId,
        title,
        content: description,
        url: articleUrl,
        published: publishedAt,
        team: teamFromDesc,
        source: 'newsapi',
        categories: [sourceName, 'football'],
      };
    }).filter((a: NewsArticle) => a.title && a.title !== '[Removed]');
  } catch (error) {
    console.error('[News] NewsAPI fetch failed:', error);
    return [];
  }
}

async function upsertArticles(articles: NewsArticle[], sourceName: string): Promise<number> {
  let synced = 0;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + NEWS_FRESHNESS_MS);

  for (const article of articles) {
    if (!article.id) continue;

    try {
      await prisma.sportsNews.upsert({
        where: {
          sport_externalId_source: {
            sport: 'NFL',
            externalId: article.id,
            source: sourceName,
          },
        },
        update: {
          title: article.title,
          content: article.content,
          sourceUrl: article.url,
          team: article.team,
          publishedAt: article.published ? new Date(article.published) : null,
          category: article.categories?.join(', ') || null,
          fetchedAt: now,
          expiresAt,
        },
        create: {
          sport: 'NFL',
          externalId: article.id,
          title: article.title,
          content: article.content,
          source: sourceName,
          sourceUrl: article.url,
          team: article.team,
          publishedAt: article.published ? new Date(article.published) : null,
          category: article.categories?.join(', ') || null,
          fetchedAt: now,
          expiresAt,
        },
      });
      synced++;
    } catch (err) {
      console.error(`[News] Failed to sync article ${article.id}:`, err);
    }
  }

  return synced;
}

export async function syncNewsToDb(team?: string): Promise<number> {
  const normalizedTeam = team ? normalizeTeamAbbrev(team) : undefined;
  const fullTeamName = normalizedTeam ? ABBREV_TO_FULL_NAME[normalizedTeam] : undefined;
  const newsApiQuery = fullTeamName ? `NFL ${fullTeamName}` : undefined;

  const [espnArticles, newsApiArticles] = await Promise.all([
    fetchESPNNews(team),
    fetchNewsAPIArticles(newsApiQuery),
  ]);

  const [espnSynced, newsApiSynced] = await Promise.all([
    upsertArticles(espnArticles, 'espn'),
    upsertArticles(newsApiArticles, 'newsapi'),
  ]);

  console.log(`[News] Synced ${espnSynced} ESPN + ${newsApiSynced} NewsAPI articles`);
  return espnSynced + newsApiSynced;
}

export async function syncNewsAPIOnly(query?: string): Promise<number> {
  const articles = await fetchNewsAPIArticles(query);
  return upsertArticles(articles, 'newsapi');
}
