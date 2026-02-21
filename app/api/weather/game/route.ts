import { NextResponse } from 'next/server';
import { fetchWeatherByCity } from '@/lib/openweathermap';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const gameDate = searchParams.get('date');

  if (!city || !gameDate) return NextResponse.json({ error: 'city & date required' }, { status: 400 });

  const cacheKey = `weather-${city}-${gameDate}`;

  const cached = await prisma.sportsDataCache.findUnique({ where: { key: cacheKey } });
  if (cached && new Date(cached.expiresAt) > new Date()) {
    return NextResponse.json(cached.data);
  }

  const weather = await fetchWeatherByCity(city);
  if (!weather) {
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 502 });
  }

  const gameWeather = {
    temp: weather.temp,
    windSpeed: weather.windSpeed,
    rain: weather.rain1h || 0,
    description: weather.description,
    feelsLike: weather.feelsLike,
    humidity: weather.humidity,
    windGust: weather.windGust,
    condition: weather.condition,
    fantasyImpact: weather.fantasyImpact,
    fantasyImpactLevel: weather.fantasyImpactLevel,
  };

  await prisma.sportsDataCache.upsert({
    where: { key: cacheKey },
    update: { data: gameWeather, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
    create: { key: cacheKey, data: gameWeather, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
  });

  return NextResponse.json(gameWeather);
}
