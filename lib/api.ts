export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    method: "GET",
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json"
    },
    cache: "no-store"
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`GET ${url} failed (${res.status}): ${text}`)
  }

  return (await res.json()) as T
}

export async function apiPost<T>(url: string, body: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    method: "POST",
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`POST ${url} failed (${res.status}): ${text}`)
  }

  return (await res.json()) as T
}
