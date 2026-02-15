const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5';

export interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number | null;
  windDeg: number;
  description: string;
  icon: string;
  iconUrl: string;
  visibility: number;
  clouds: number;
  rain1h: number | null;
  snow1h: number | null;
  condition: string;
  fantasyImpact: string;
  fantasyImpactLevel: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
}

export interface GameWeather {
  venue: string;
  homeTeam: string;
  awayTeam: string;
  weather: WeatherData;
  gameTime: string;
  isDome: boolean;
}

const NFL_VENUE_COORDS: Record<string, { lat: number; lon: number; dome: boolean }> = {
  'State Farm Stadium': { lat: 33.5276, lon: -112.2626, dome: true },
  'Mercedes-Benz Stadium': { lat: 33.7554, lon: -84.4010, dome: true },
  'M&T Bank Stadium': { lat: 39.2780, lon: -76.6227, dome: false },
  'Highmark Stadium': { lat: 42.7738, lon: -78.7870, dome: false },
  'Bank of America Stadium': { lat: 35.2258, lon: -80.8528, dome: false },
  'Soldier Field': { lat: 41.8623, lon: -87.6167, dome: false },
  'Paycor Stadium': { lat: 39.0955, lon: -84.5160, dome: false },
  'Cleveland Browns Stadium': { lat: 41.5061, lon: -81.6995, dome: false },
  'AT&T Stadium': { lat: 32.7473, lon: -97.0945, dome: true },
  'Empower Field at Mile High': { lat: 39.7439, lon: -105.0201, dome: false },
  'Ford Field': { lat: 42.3400, lon: -83.0456, dome: true },
  'Lambeau Field': { lat: 44.5013, lon: -88.0622, dome: false },
  'NRG Stadium': { lat: 29.6847, lon: -95.4107, dome: true },
  'Lucas Oil Stadium': { lat: 39.7601, lon: -86.1639, dome: true },
  'EverBank Stadium': { lat: 30.3239, lon: -81.6373, dome: false },
  'GEHA Field at Arrowhead Stadium': { lat: 39.0489, lon: -94.4839, dome: false },
  'Arrowhead Stadium': { lat: 39.0489, lon: -94.4839, dome: false },
  'Allegiant Stadium': { lat: 36.0909, lon: -115.1833, dome: true },
  'SoFi Stadium': { lat: 33.9534, lon: -118.3390, dome: true },
  'Hard Rock Stadium': { lat: 25.9580, lon: -80.2389, dome: false },
  'U.S. Bank Stadium': { lat: 44.9736, lon: -93.2575, dome: true },
  'Gillette Stadium': { lat: 42.0909, lon: -71.2643, dome: false },
  'Caesars Superdome': { lat: 29.9511, lon: -90.0812, dome: true },
  'MetLife Stadium': { lat: 40.8128, lon: -74.0742, dome: false },
  'Lincoln Financial Field': { lat: 39.9008, lon: -75.1675, dome: false },
  'Acrisure Stadium': { lat: 40.4468, lon: -80.0158, dome: false },
  'Levi\'s Stadium': { lat: 37.4033, lon: -121.9694, dome: false },
  'Lumen Field': { lat: 47.5952, lon: -122.3316, dome: false },
  'Raymond James Stadium': { lat: 27.9759, lon: -82.5033, dome: false },
  'Nissan Stadium': { lat: 36.1665, lon: -86.7713, dome: false },
  'Northwest Stadium': { lat: 38.9076, lon: -76.8645, dome: false },
};

const NFL_TEAM_VENUES: Record<string, string> = {
  'ARI': 'State Farm Stadium', 'ATL': 'Mercedes-Benz Stadium',
  'BAL': 'M&T Bank Stadium', 'BUF': 'Highmark Stadium',
  'CAR': 'Bank of America Stadium', 'CHI': 'Soldier Field',
  'CIN': 'Paycor Stadium', 'CLE': 'Cleveland Browns Stadium',
  'DAL': 'AT&T Stadium', 'DEN': 'Empower Field at Mile High',
  'DET': 'Ford Field', 'GB': 'Lambeau Field',
  'HOU': 'NRG Stadium', 'IND': 'Lucas Oil Stadium',
  'JAX': 'EverBank Stadium', 'KC': 'Arrowhead Stadium',
  'LV': 'Allegiant Stadium', 'LAC': 'SoFi Stadium',
  'LAR': 'SoFi Stadium', 'MIA': 'Hard Rock Stadium',
  'MIN': 'U.S. Bank Stadium', 'NE': 'Gillette Stadium',
  'NO': 'Caesars Superdome', 'NYG': 'MetLife Stadium',
  'NYJ': 'MetLife Stadium', 'PHI': 'Lincoln Financial Field',
  'PIT': 'Acrisure Stadium', 'SF': 'Levi\'s Stadium',
  'SEA': 'Lumen Field', 'TB': 'Raymond James Stadium',
  'TEN': 'Nissan Stadium', 'WAS': 'Northwest Stadium',
};

function assessFantasyImpact(weather: {
  windSpeed: number;
  windGust: number | null;
  temp: number;
  rain1h: number | null;
  snow1h: number | null;
  visibility: number;
  condition: string;
}): { impact: string; level: 'none' | 'low' | 'moderate' | 'high' | 'extreme' } {
  const dominated = [];
  let level: 'none' | 'low' | 'moderate' | 'high' | 'extreme' = 'none';

  const effectiveWind = weather.windGust || weather.windSpeed;

  const SEVERITY_ORDER = ['none', 'low', 'moderate', 'high', 'extreme'] as const;
  const upgrade = (newLevel: typeof level) => {
    if (SEVERITY_ORDER.indexOf(newLevel) > SEVERITY_ORDER.indexOf(level)) {
      level = newLevel;
    }
  };

  if (effectiveWind >= 25) {
    dominated.push('Severe wind — major passing/kicking downgrade');
    upgrade('extreme');
  } else if (effectiveWind >= 20) {
    dominated.push('Strong wind — passing/kicking downgrade');
    upgrade('high');
  } else if (effectiveWind >= 15) {
    dominated.push('Moderate wind — slight passing concern');
    upgrade('low');
  }

  if (weather.temp <= 20) {
    dominated.push('Extreme cold — fumble risk, reduced grip');
    upgrade('high');
  } else if (weather.temp <= 32) {
    dominated.push('Cold conditions — minor fumble risk');
    upgrade('low');
  } else if (weather.temp >= 95) {
    dominated.push('Extreme heat — fatigue/cramping risk');
    upgrade('moderate');
  }

  if (weather.snow1h && weather.snow1h > 0) {
    dominated.push('Snow — favors run game, reduces passing');
    upgrade('high');
  }

  if (weather.rain1h && weather.rain1h > 5) {
    dominated.push('Heavy rain — fumble/interception risk, reduced passing');
    upgrade('high');
  } else if (weather.rain1h && weather.rain1h > 0) {
    dominated.push('Light rain — minor grip concern');
    upgrade('low');
  }

  if (weather.visibility < 1000) {
    dominated.push('Low visibility — deep ball risk');
    upgrade('moderate');
  }

  if (dominated.length === 0) {
    return { impact: 'No significant weather impact expected', level: 'none' };
  }

  return { impact: dominated.join('. '), level };
}

export async function fetchWeatherByCoords(lat: number, lon: number): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    console.warn('[Weather] OPENWEATHERMAP_API_KEY not set');
    return null;
  }

  try {
    const url = `${OWM_BASE_URL}/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      console.error('[Weather] API error:', response.status);
      return null;
    }

    const data = await response.json();

    const windSpeed = data.wind?.speed || 0;
    const windGust = data.wind?.gust || null;
    const temp = data.main?.temp || 0;
    const rain1h = data.rain?.['1h'] || null;
    const snow1h = data.snow?.['1h'] || null;
    const visibility = data.visibility || 10000;
    const condition = data.weather?.[0]?.main || 'Clear';

    const { impact, level } = assessFantasyImpact({
      windSpeed, windGust, temp, rain1h, snow1h, visibility, condition,
    });

    return {
      city: data.name || '',
      temp,
      feelsLike: data.main?.feels_like || 0,
      tempMin: data.main?.temp_min || 0,
      tempMax: data.main?.temp_max || 0,
      humidity: data.main?.humidity || 0,
      pressure: data.main?.pressure || 0,
      windSpeed,
      windGust,
      windDeg: data.wind?.deg || 0,
      description: data.weather?.[0]?.description || '',
      icon: data.weather?.[0]?.icon || '',
      iconUrl: data.weather?.[0]?.icon
        ? `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
        : '',
      visibility,
      clouds: data.clouds?.all || 0,
      rain1h,
      snow1h,
      condition,
      fantasyImpact: impact,
      fantasyImpactLevel: level,
    };
  } catch (error) {
    console.error('[Weather] Fetch failed:', error);
    return null;
  }
}

export async function fetchWeatherByCity(city: string): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    console.warn('[Weather] OPENWEATHERMAP_API_KEY not set');
    return null;
  }

  try {
    const url = `${OWM_BASE_URL}/weather?q=${encodeURIComponent(city)},US&units=imperial&appid=${apiKey}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      console.error('[Weather] API error:', response.status);
      return null;
    }

    const data = await response.json();

    const windSpeed = data.wind?.speed || 0;
    const windGust = data.wind?.gust || null;
    const temp = data.main?.temp || 0;
    const rain1h = data.rain?.['1h'] || null;
    const snow1h = data.snow?.['1h'] || null;
    const visibility = data.visibility || 10000;
    const condition = data.weather?.[0]?.main || 'Clear';

    const { impact, level } = assessFantasyImpact({
      windSpeed, windGust, temp, rain1h, snow1h, visibility, condition,
    });

    return {
      city: data.name || city,
      temp,
      feelsLike: data.main?.feels_like || 0,
      tempMin: data.main?.temp_min || 0,
      tempMax: data.main?.temp_max || 0,
      humidity: data.main?.humidity || 0,
      pressure: data.main?.pressure || 0,
      windSpeed,
      windGust,
      windDeg: data.wind?.deg || 0,
      description: data.weather?.[0]?.description || '',
      icon: data.weather?.[0]?.icon || '',
      iconUrl: data.weather?.[0]?.icon
        ? `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
        : '',
      visibility,
      clouds: data.clouds?.all || 0,
      rain1h,
      snow1h,
      condition,
      fantasyImpact: impact,
      fantasyImpactLevel: level,
    };
  } catch (error) {
    console.error('[Weather] Fetch failed:', error);
    return null;
  }
}

export async function fetchGameWeather(homeTeam: string): Promise<GameWeather | null> {
  const venueName = NFL_TEAM_VENUES[homeTeam];
  if (!venueName) {
    console.warn(`[Weather] No venue mapping for team: ${homeTeam}`);
    return null;
  }

  const venueData = NFL_VENUE_COORDS[venueName];
  if (!venueData) {
    console.warn(`[Weather] No coordinates for venue: ${venueName}`);
    return null;
  }

  if (venueData.dome) {
    return {
      venue: venueName,
      homeTeam,
      awayTeam: '',
      weather: {
        city: venueName,
        temp: 72,
        feelsLike: 72,
        tempMin: 72,
        tempMax: 72,
        humidity: 50,
        pressure: 1013,
        windSpeed: 0,
        windGust: null,
        windDeg: 0,
        description: 'Indoor stadium — climate controlled',
        icon: '01d',
        iconUrl: 'https://openweathermap.org/img/wn/01d@2x.png',
        visibility: 10000,
        clouds: 0,
        rain1h: null,
        snow1h: null,
        condition: 'Dome',
        fantasyImpact: 'Indoor stadium — no weather impact',
        fantasyImpactLevel: 'none',
      },
      gameTime: '',
      isDome: true,
    };
  }

  const weather = await fetchWeatherByCoords(venueData.lat, venueData.lon);
  if (!weather) return null;

  return {
    venue: venueName,
    homeTeam,
    awayTeam: '',
    weather,
    gameTime: '',
    isDome: false,
  };
}

export function getVenueForTeam(teamAbbrev: string): string | null {
  return NFL_TEAM_VENUES[teamAbbrev] || null;
}

export function isTeamDome(teamAbbrev: string): boolean {
  const venue = NFL_TEAM_VENUES[teamAbbrev];
  if (!venue) return false;
  return NFL_VENUE_COORDS[venue]?.dome || false;
}
