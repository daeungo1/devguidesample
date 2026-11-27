"""Call Microsoft Foundry once using only a user-assigned managed identity."""

import os
import sys

from azure.core.exceptions import ClientAuthenticationError
from azure.identity import ManagedIdentityCredential, get_bearer_token_provider
from openai import APIConnectionError, APIStatusError, OpenAI

SCOPE = "https://ai.azure.com/.default"


def main() -> int:
    """Return a failing exit code unless the model completed with text."""
    try:
        endpoint = os.environ["FOUNDRY_ENDPOINT"].rstrip("/")
        deployment = os.environ["FOUNDRY_MODEL_DEPLOYMENT"]
        client_id = os.environ["AZURE_CLIENT_ID"]
    except KeyError as error:
        print(f"Missing environment variable: {error.args[0]}", file=sys.stderr)
        return 2

    try:
        with ManagedIdentityCredential(client_id=client_id) as credential:
            token_provider = get_bearer_token_provider(credential, SCOPE)
            with OpenAI(
                base_url=f"{endpoint}/openai/v1/",
                api_key=token_provider,
                timeout=30,
                max_retries=0,
            ) as client:
                raw = client.responses.with_raw_response.create(
                    model=deployment,
                    input="Say hello in one sentence.",
                    max_output_tokens=300,
                    store=False,
                )
                response = raw.parse()
    except ClientAuthenticationError:
        print("Managed identity could not obtain an access token.", file=sys.stderr)
        return 1
    except APIConnectionError:
        print("Could not connect to the Foundry endpoint.", file=sys.stderr)
        return 1
    except APIStatusError as error:
        print(f"Foundry rejected the request: HTTP {error.status_code}.", file=sys.stderr)
        return 1

    if raw.status_code != 200 or response.status != "completed" or not response.output_text.strip():
        print(f"No completed text response (HTTP {raw.status_code}, status={response.status}).", file=sys.stderr)
        return 1

    print("OK auth=managed_identity http=200 response=completed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
