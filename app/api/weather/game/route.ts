import { NextResponse } from 'next/server';
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

  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${process.env.OPENWEATHER_API_KEY}&units=imperial`
  );

  const data = await res.json();

  const gameWeather = {
    temp: data.list[0]?.main.temp,
    windSpeed: data.list[0]?.wind.speed,
    rain: data.list[0]?.rain?.['3h'] || 0,
    description: data.list[0]?.weather[0]?.description,
  };

  await prisma.sportsDataCache.upsert({
    where: { key: cacheKey },
    update: { data: gameWeather, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
    create: { key: cacheKey, data: gameWeather, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
  });

  return NextResponse.json(gameWeather);
}
