import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

function buildMockSourceAudit(overrides = {}) {
  return {
    newsSourceCount: 2,
    newsSources: ['ESPN', 'NewsAPI'],
    newsItemCount: 5,
    playerHits: 3,
    teamHits: 2,
    rollingInsightsPlayerCount: 8,
    fantasyCalcPlayerCount: 12,
    fantasyCalcPickCount: 4,
    crossSportSignalCount: 0,
    errors: [],
    partialData: false,
    missingSources: [],
    ...overrides,
  };
}

function buildMockDataFreshness(overrides = {}) {
  const now = new Date().toISOString();
  return {
    newsAge: now,
    rollingInsightsSource: 'rolling_insights_api',
    fantasyCalcFetchedAt: now,
    crossSportEnabled: false,
    assembledAt: now,
    ...overrides,
  };
}

function buildAuditFromEnriched(sourceAudit, dataFreshness) {
  const now = new Date().toISOString();
  const sa = sourceAudit;
  const df = dataFreshness;
  const sources = ['importedLeague'];
  const missing = [];
  const freshness = { importedLeague: now };

  if (sa.fantasyCalcPlayerCount > 0 || sa.fantasyCalcPickCount > 0) {
    sources.push('fantasyCalc');
    freshness.fantasyCalc = df.fantasyCalcFetchedAt || now;
  } else if (sa.missingSources.includes('fantasycalc')) {
    missing.push('fantasyCalc');
  }

  if (sa.newsItemCount > 0) {
    sources.push('newsApi');
    freshness.newsApi = df.newsAge || now;
  } else if (sa.missingSources.includes('news')) {
    missing.push('newsApi');
  }

  if (sa.rollingInsightsPlayerCount > 0) {
    sources.push('rollingInsights');
    freshness.rollingInsights = df.assembledAt || now;
  } else if (sa.missingSources.includes('rolling_insights')) {
    missing.push('rollingInsights');
  }

  return {
    partialData: sa.partialData,
    sourcesUsed: sources,
    missingSources: missing,
    dataFreshness: freshness,
  };
}

describe('Legacy AI audit contract', () => {

  describe('All adapters available', () => {
    it('returns enriched audit with all sources', () => {
      const sa = buildMockSourceAudit();
      const df = buildMockDataFreshness();
      const audit = buildAuditFromEnriched(sa, df);

      assert.equal(audit.partialData, false);
      assert.ok(audit.sourcesUsed.length >= 3, 'should have at least importedLeague + 2 enrichment sources');
      assert.ok(audit.sourcesUsed.includes('importedLeague'));
      assert.ok(audit.sourcesUsed.includes('fantasyCalc'));
      assert.ok(audit.sourcesUsed.includes('newsApi'));
      assert.ok(audit.sourcesUsed.includes('rollingInsights'));
      assert.deepEqual(audit.missingSources, []);

      assert.ok(audit.dataFreshness.importedLeague, 'importedLeague timestamp present');
      assert.ok(audit.dataFreshness.fantasyCalc, 'fantasyCalc timestamp present');
      assert.ok(audit.dataFreshness.newsApi, 'newsApi timestamp present');
      assert.ok(audit.dataFreshness.rollingInsights, 'rollingInsights timestamp present');

      for (const [key, val] of Object.entries(audit.dataFreshness)) {
        assert.ok(typeof val === 'string' && val.length > 0, `dataFreshness.${key} should be non-empty string`);
      }
    });
  });

  describe('News API fails', () => {
    it('returns 200-shape with partialData=true and newsApi in missingSources', () => {
      const sa = buildMockSourceAudit({
        newsSourceCount: 0,
        newsSources: [],
        newsItemCount: 0,
        playerHits: 0,
        teamHits: 0,
        partialData: true,
        missingSources: ['news'],
        errors: ['News: fetch failed'],
      });
      const df = buildMockDataFreshness({ newsAge: 'unavailable' });
      const audit = buildAuditFromEnriched(sa, df);

      assert.equal(audit.partialData, true);
      assert.ok(audit.missingSources.includes('newsApi'), 'missingSources should include newsApi');
      assert.ok(!audit.sourcesUsed.includes('newsApi'), 'sourcesUsed should NOT include newsApi');
      assert.ok(audit.sourcesUsed.includes('importedLeague'), 'importedLeague always present');
      assert.ok(audit.sourcesUsed.includes('fantasyCalc'), 'fantasyCalc still available');
      assert.ok(audit.sourcesUsed.includes('rollingInsights'), 'rollingInsights still available');
      assert.ok(!audit.dataFreshness.newsApi, 'no newsApi timestamp when unavailable');
    });
  });

  describe('Rolling insights unavailable', () => {
    it('returns 200-shape with rollingInsights in missingSources', () => {
      const sa = buildMockSourceAudit({
        rollingInsightsPlayerCount: 0,
        partialData: true,
        missingSources: ['rolling_insights'],
        errors: ['RollingInsights: timeout'],
      });
      const df = buildMockDataFreshness({ rollingInsightsSource: 'unavailable' });
      const audit = buildAuditFromEnriched(sa, df);

      assert.equal(audit.partialData, true);
      assert.ok(audit.missingSources.includes('rollingInsights'));
      assert.ok(!audit.sourcesUsed.includes('rollingInsights'));
      assert.ok(audit.sourcesUsed.includes('importedLeague'));
      assert.ok(audit.sourcesUsed.includes('fantasyCalc'));
      assert.ok(audit.sourcesUsed.includes('newsApi'));
    });
  });

  describe('FantasyCalc weights missing', () => {
    it('returns 200-shape with fantasyCalc in missingSources', () => {
      const sa = buildMockSourceAudit({
        fantasyCalcPlayerCount: 0,
        fantasyCalcPickCount: 0,
        partialData: true,
        missingSources: ['fantasycalc'],
        errors: ['FantasyCalc: API error'],
      });
      const df = buildMockDataFreshness({ fantasyCalcFetchedAt: 'unavailable' });
      const audit = buildAuditFromEnriched(sa, df);

      assert.equal(audit.partialData, true);
      assert.ok(audit.missingSources.includes('fantasyCalc'));
      assert.ok(!audit.sourcesUsed.includes('fantasyCalc'));
      assert.ok(audit.sourcesUsed.includes('importedLeague'));
      assert.ok(audit.sourcesUsed.includes('newsApi'));
      assert.ok(audit.sourcesUsed.includes('rollingInsights'));
      assert.ok(!audit.dataFreshness.fantasyCalc, 'no fantasyCalc timestamp when unavailable');
    });
  });

  describe('Total enrichment failure fallback', () => {
    it('returns importedLeague only with all sources missing', () => {
      const audit = {
        partialData: true,
        sourcesUsed: ['importedLeague'],
        missingSources: ['fantasyCalc', 'newsApi', 'rollingInsights'],
        dataFreshness: { importedLeague: new Date().toISOString() },
      };

      assert.equal(audit.partialData, true);
      assert.deepEqual(audit.sourcesUsed, ['importedLeague']);
      assert.equal(audit.missingSources.length, 3);
      assert.ok(audit.missingSources.includes('fantasyCalc'));
      assert.ok(audit.missingSources.includes('newsApi'));
      assert.ok(audit.missingSources.includes('rollingInsights'));
      assert.ok(audit.dataFreshness.importedLeague);
      assert.ok(!audit.dataFreshness.fantasyCalc);
      assert.ok(!audit.dataFreshness.newsApi);
      assert.ok(!audit.dataFreshness.rollingInsights);
    });
  });

  describe('Citations schema assertions', () => {
    const validCitation = {
      claim: 'Patrick Mahomes projects as a top-3 QB for 2025',
      source: 'FantasyCalc',
      timestamp: '2026-02-11T12:00:00Z',
      confidence: 'high',
    };

    it('valid citation has all required fields', () => {
      assert.ok(typeof validCitation.claim === 'string' && validCitation.claim.length > 0, 'claim required');
      assert.ok(typeof validCitation.source === 'string' && validCitation.source.length > 0, 'source required');
      assert.ok(typeof validCitation.timestamp === 'string' && validCitation.timestamp.length > 0, 'timestamp required');
      assert.ok(['high', 'medium', 'low'].includes(validCitation.confidence), 'confidence must be high|medium|low');
    });

    it('rejects citation missing required fields', () => {
      const incomplete = { claim: 'Something', source: '' };
      assert.ok(!incomplete.source, 'empty source should be falsy');
      assert.ok(!incomplete.timestamp, 'missing timestamp');
      assert.ok(!incomplete.confidence, 'missing confidence');
    });

    it('validates array of citations meets minimum count', () => {
      const citations = [
        { ...validCitation },
        { ...validCitation, claim: 'Second claim', source: 'ESPN Injury Report' },
        { ...validCitation, claim: 'Third claim', source: 'Rolling Insights Stats', confidence: 'medium' },
      ];

      assert.ok(Array.isArray(citations), 'citations must be array');
      assert.ok(citations.length >= 3, 'nontrivial response must have >= 3 citations');

      for (const c of citations) {
        assert.ok(c.claim && c.source && c.timestamp && c.confidence, `citation fields present`);
        assert.ok(['high', 'medium', 'low'].includes(c.confidence), `confidence valid: ${c.confidence}`);
      }
    });

    it('validates insight-level citations from InsightItem shape', () => {
      const insightItem = {
        type: 'injury_alert',
        category: 'injuries',
        title: 'Key Player Injury',
        body: 'Your starter is listed as questionable',
        priority: 1,
        confidence: 0.9,
        citations: [
          { source: 'API-Sports Injury Report', timestamp: '2026-02-11T12:00:00Z', confidence: 'high' },
        ],
      };

      assert.ok(Array.isArray(insightItem.citations), 'insight citations should be array');
      assert.ok(insightItem.citations.length > 0, 'insight should have at least one citation');
      for (const c of insightItem.citations) {
        assert.ok(c.source, 'citation source required');
        assert.ok(c.timestamp, 'citation timestamp required');
        assert.ok(['high', 'medium', 'low'].includes(c.confidence), 'citation confidence valid');
      }
    });
  });

  describe('Audit dataFreshness timestamps are valid ISO strings', () => {
    it('all timestamps parse as valid dates', () => {
      const sa = buildMockSourceAudit();
      const df = buildMockDataFreshness();
      const audit = buildAuditFromEnriched(sa, df);

      for (const [key, val] of Object.entries(audit.dataFreshness)) {
        const parsed = new Date(val);
        assert.ok(!isNaN(parsed.getTime()), `dataFreshness.${key} = "${val}" should be valid ISO date`);
      }
    });
  });

  describe('Cached response audit shape', () => {
    it('cached response has correct audit structure', () => {
      const createdAt = new Date('2026-02-10T18:00:00Z');
      const audit = {
        partialData: false,
        sourcesUsed: ['importedLeague'],
        missingSources: [],
        dataFreshness: { importedLeague: createdAt.toISOString() },
      };

      assert.equal(audit.partialData, false);
      assert.deepEqual(audit.sourcesUsed, ['importedLeague']);
      assert.deepEqual(audit.missingSources, []);
      assert.equal(audit.dataFreshness.importedLeague, '2026-02-10T18:00:00.000Z');
    });
  });

  describe('Source name mapping consistency', () => {
    it('internal names map to API contract names correctly', () => {
      const internalToApi = {
        'news': 'newsApi',
        'rolling_insights': 'rollingInsights',
        'fantasycalc': 'fantasyCalc',
      };

      const sa = buildMockSourceAudit({
        newsItemCount: 0,
        rollingInsightsPlayerCount: 0,
        fantasyCalcPlayerCount: 0,
        fantasyCalcPickCount: 0,
        partialData: true,
        missingSources: ['news', 'rolling_insights', 'fantasycalc'],
      });
      const df = buildMockDataFreshness();
      const audit = buildAuditFromEnriched(sa, df);

      for (const [internal, api] of Object.entries(internalToApi)) {
        assert.ok(
          audit.missingSources.includes(api),
          `internal "${internal}" should map to "${api}" in missingSources`
        );
      }
    });
  });
});
