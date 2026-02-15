import { NextResponse } from 'next/server';

interface TestResult {
  service: string;
  status: 'success' | 'failed' | 'skipped';
  message: string;
}

async function testOpenAI(): Promise<TestResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (!apiKey) {
      return { service: 'OpenAI', status: 'skipped', message: 'No API key found' };
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "test successful" in 2 words' }],
        max_tokens: 10,
      }),
    });

    if (response.ok) {
      return { service: 'OpenAI (via Replit)', status: 'success', message: 'API key valid - chat completions working' };
    }
    const errorText = await response.text();
    return { service: 'OpenAI (via Replit)', status: 'failed', message: `API returned ${response.status}: ${errorText.slice(0, 100)}` };
  } catch (error) {
    return { service: 'OpenAI (via Replit)', status: 'failed', message: String(error) };
  }
}

async function testDirectOpenAI(): Promise<TestResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return { service: 'OpenAI (Direct)', status: 'skipped', message: 'No OPENAI_API_KEY found' };
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (response.ok) {
      return { service: 'OpenAI (Direct)', status: 'success', message: 'API key valid - models endpoint accessible' };
    }
    return { service: 'OpenAI (Direct)', status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: 'OpenAI (Direct)', status: 'failed', message: String(error) };
  }
}

async function testGrok(): Promise<TestResult> {
  try {
    const apiKey = process.env.GROK_API_KEY;
    
    if (!apiKey) {
      return { service: 'Grok (xAI)', status: 'skipped', message: 'No API key found' };
    }

    const response = await fetch('https://api.x.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (response.ok) {
      return { service: 'Grok (xAI)', status: 'success', message: 'API key valid - models endpoint accessible' };
    }
    return { service: 'Grok (xAI)', status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: 'Grok (xAI)', status: 'failed', message: String(error) };
  }
}

async function testTheSportsDB(): Promise<TestResult> {
  try {
    const apiKey = process.env.THESPORTSDB_API_KEY;
    
    if (!apiKey) {
      return { service: 'TheSportsDB', status: 'skipped', message: 'No API key found' };
    }

    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=Arsenal`);

    if (response.ok) {
      const data = await response.json();
      if (data.teams) {
        return { service: 'TheSportsDB', status: 'success', message: 'API key valid - returned team data' };
      }
    }
    return { service: 'TheSportsDB', status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: 'TheSportsDB', status: 'failed', message: String(error) };
  }
}

async function testTheSportsDBLeague(leagueId: string, label: string): Promise<TestResult> {
  try {
    const apiKey = process.env.THESPORTSDB_API_KEY;
    
    if (!apiKey) {
      return { service: `TheSportsDB (${label})`, status: 'skipped', message: 'No API key found' };
    }

    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${apiKey}/lookupleague.php?id=${leagueId}`);

    if (response.ok) {
      const data = await response.json();
      if (data.leagues && data.leagues.length > 0) {
        const league = data.leagues[0];
        return { 
          service: `TheSportsDB (${label})`, 
          status: 'success', 
          message: `Found: ${league.strLeague}` 
        };
      }
      return { service: `TheSportsDB (${label})`, status: 'failed', message: 'No league data found' };
    }
    return { service: `TheSportsDB (${label})`, status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: `TheSportsDB (${label})`, status: 'failed', message: String(error) };
  }
}

async function testGiphy(): Promise<TestResult> {
  try {
    const apiKey = process.env.GIPHY_API_KEY;
    
    if (!apiKey) {
      return { service: 'Giphy', status: 'skipped', message: 'No API key found' };
    }

    const response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=1`);

    if (response.ok) {
      const data = await response.json();
      if (data.data) {
        return { service: 'Giphy', status: 'success', message: 'API key valid - trending GIFs accessible' };
      }
    }
    return { service: 'Giphy', status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: 'Giphy', status: 'failed', message: String(error) };
  }
}

async function testTwilio(): Promise<TestResult> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      return { service: 'Twilio', status: 'skipped', message: 'Missing account SID or auth token' };
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: { 'Authorization': `Basic ${credentials}` },
    });

    if (response.ok) {
      const data = await response.json();
      return { service: 'Twilio', status: 'success', message: `API key valid - account: ${data.friendly_name || accountSid}` };
    }
    return { service: 'Twilio', status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: 'Twilio', status: 'failed', message: String(error) };
  }
}

async function testResend(): Promise<TestResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      return { service: 'Resend', status: 'skipped', message: 'No API key found' };
    }

    const response = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (response.ok) {
      return { service: 'Resend', status: 'success', message: 'API key valid - domains endpoint accessible' };
    }
    return { service: 'Resend', status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: 'Resend', status: 'failed', message: String(error) };
  }
}

async function testGoogleAnalytics(): Promise<TestResult> {
  try {
    const credentials = process.env.GOOGLE_ANALYTICS_CREDENTIALS;
    
    if (!credentials) {
      return { service: 'Google Analytics', status: 'skipped', message: 'No credentials found' };
    }

    try {
      const parsed = JSON.parse(credentials);
      if (parsed.client_email && parsed.private_key) {
        return { service: 'Google Analytics', status: 'success', message: `Credentials valid JSON - service account: ${parsed.client_email}` };
      }
      return { service: 'Google Analytics', status: 'failed', message: 'Invalid credentials format - missing client_email or private_key' };
    } catch {
      return { service: 'Google Analytics', status: 'failed', message: 'Credentials are not valid JSON' };
    }
  } catch (error) {
    return { service: 'Google Analytics', status: 'failed', message: String(error) };
  }
}

async function testCFBD(): Promise<TestResult> {
  try {
    const apiKey = process.env.CFBD_KEY;
    
    if (!apiKey) {
      return { service: 'College Football Data (CFBD)', status: 'skipped', message: 'No CFBD_KEY found' };
    }

    const response = await fetch('https://api.collegefootballdata.com/teams', {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const teamCount = Array.isArray(data) ? data.length : 0;
      return { 
        service: 'College Football Data (CFBD)', 
        status: 'success', 
        message: `API key valid - ${teamCount} college football teams found` 
      };
    }
    return { service: 'College Football Data (CFBD)', status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: 'College Football Data (CFBD)', status: 'failed', message: String(error) };
  }
}

async function testSleeperSport(sport: string): Promise<TestResult> {
  try {
    const response = await fetch(`https://api.sleeper.app/v1/state/${sport}`);

    if (response.ok) {
      const data = await response.json();
      if (data && data.season) {
        return { 
          service: `Sleeper (${sport.toUpperCase()})`, 
          status: 'success', 
          message: `Season: ${data.season}, week: ${data.week || 'N/A'}` 
        };
      }
      return { 
        service: `Sleeper (${sport.toUpperCase()})`, 
        status: 'failed', 
        message: 'No season data returned' 
      };
    }
    return { service: `Sleeper (${sport.toUpperCase()})`, status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: `Sleeper (${sport.toUpperCase()})`, status: 'failed', message: String(error) };
  }
}

async function testESPNSport(sportPath: string, label: string): Promise<TestResult> {
  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard`);

    if (response.ok) {
      const data = await response.json();
      const eventCount = data.events?.length || 0;
      return { 
        service: `ESPN (${label})`, 
        status: 'success', 
        message: `Connected - ${eventCount} events found` 
      };
    }
    return { service: `ESPN (${label})`, status: 'failed', message: `API returned ${response.status}` };
  } catch (error) {
    return { service: `ESPN (${label})`, status: 'failed', message: String(error) };
  }
}

export async function GET() {
  const results = await Promise.all([
    testOpenAI(),
    testDirectOpenAI(),
    testGrok(),
    testTheSportsDB(),
    testTheSportsDBLeague('4391', 'NFL'),
    testTheSportsDBLeague('4387', 'NBA'),
    testTheSportsDBLeague('4424', 'MLB'),
    testTheSportsDBLeague('4380', 'NHL'),
    testTheSportsDBLeague('4346', 'Soccer/MLS'),
    testTheSportsDBLeague('4607', 'NCAAB'),
    testCFBD(),
    testGiphy(),
    testTwilio(),
    testResend(),
    testGoogleAnalytics(),
    testSleeperSport('nfl'),
    testSleeperSport('nba'),
    testSleeperSport('mlb'),
    testSleeperSport('nhl'),
    testESPNSport('football/nfl', 'NFL'),
    testESPNSport('baseball/mlb', 'MLB'),
    testESPNSport('hockey/nhl', 'NHL'),
    testESPNSport('basketball/nba', 'NBA'),
    testESPNSport('soccer/usa.1', 'Soccer/MLS'),
    testESPNSport('basketball/mens-college-basketball', 'College Basketball'),
    testESPNSport('baseball/college-baseball', 'College Baseball'),
  ]);

  const summary = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
  };

  return NextResponse.json({
    summary,
    results,
    testedAt: new Date().toISOString(),
  });
}
