export async function postJson<TResponse>(
  url: string,
  body: unknown,
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return response.json();
}
