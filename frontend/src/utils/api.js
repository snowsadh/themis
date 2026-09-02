export async function api(path, body, signal) {
  const timeout = AbortSignal.timeout(body ? 180000 : 12000);
  let response;
  try {
    response = await fetch(
      `${import.meta.env.VITE_API_BASE || "/api"}${path}`,
      {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted)
      throw new Error(
        body
          ? "The bench took too long to respond. Your argument is unchanged. Retry or check the model connection."
          : "The court office took too long to respond. Check the backend and retry.",
      );
    throw new Error(
      "The court could not connect. Check that the backend is running and try again. Your argument is safe.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server returned an unreadable response. Check the backend connection and retry.",
    );
  }
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "The request could not be completed. Please retry.",
    );
  return data;
}
