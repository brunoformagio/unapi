export async function executeApiCall(
  method: string,
  endpoint: string,
  baseUrl: string,
  payload: Record<string, unknown>,
  apiKey: string
): Promise<{
  status: number;
  statusText: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  response: any;
}> {
  const url = `${baseUrl}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const options: RequestInit = {
    method,
    headers,
  };

  if (["POST", "PUT", "PATCH"].includes(method)) {
    options.body = JSON.stringify(payload);
  }

  const res = await fetch(url, options);

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let responseBody: any = null;
  try {
    responseBody = await res.json();
  } catch {
    responseBody = await res.text();
  }

  // Interpreta erros 422 ou semelhantes com mensagens de campos obrigatórios
  if (
    res.status >= 400 &&
    typeof responseBody === "object" &&
    Array.isArray(responseBody.detail)
  ) {
    const missing = responseBody.detail
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      .filter((d: any) => d.msg?.toLowerCase().includes("required"))
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      .map((d: any) => d.loc?.[d.loc.length - 1])
      .filter(Boolean);

    if (missing.length > 0) {
      return {
        status: 422,
        statusText: "Missing required fields",
        response: `❌ O seguinte campo ou campos são obrigatórios: ${missing.join(", ")}. Por favor, forneça esses valores e tente novamente.`,
      };
    }
  }

  return {
    status: res.status,
    statusText: res.statusText,
    response: responseBody,
  };
}
