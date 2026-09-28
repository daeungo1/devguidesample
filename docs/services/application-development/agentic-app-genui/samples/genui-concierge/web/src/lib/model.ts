import { createAzure } from "@ai-sdk/azure";
import {
  AzureCliCredential,
  ManagedIdentityCredential,
  getBearerTokenProvider,
  type TokenCredential,
} from "@azure/identity";

// Scope for Microsoft Entra ID tokens on Foundry resources.
const SCOPE = "https://ai.azure.com/.default";

let tokenProvider: (() => Promise<string>) | undefined;

/**
 * Deterministic credentials instead of DefaultAzureCredential: the
 * user-assigned managed identity in Container Apps, the Azure CLI login locally.
 */
function createCredential(): TokenCredential {
  const clientId = process.env.AZURE_CLIENT_ID;
  return clientId ? new ManagedIdentityCredential({ clientId }) : new AzureCliCredential();
}

function getTokenProvider() {
  tokenProvider ??= getBearerTokenProvider(createCredential(), SCOPE);
  return tokenProvider;
}

/** fetch wrapper that replaces the api-key header with a Microsoft Entra ID bearer token. */
export const entraFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  headers.delete("api-key");
  headers.set("Authorization", `Bearer ${await getTokenProvider()()}`);
  return fetch(input, { ...init, headers });
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

let azure: ReturnType<typeof createAzure> | undefined;

/**
 * GPT-5.6 cannot combine Chat Completions with function tools unless reasoning
 * is disabled, so every deployment is called through the Responses API.
 */
export function createAzureModel(deployment: string) {
  azure ??= createAzure({
    resourceName: requireEnv("AZURE_OPENAI_RESOURCE_NAME"),
    // The provider requires a key value; entraFetch strips it before sending.
    apiKey: "entra-id",
    fetch: entraFetch,
  });
  return azure.responses(deployment);
}
