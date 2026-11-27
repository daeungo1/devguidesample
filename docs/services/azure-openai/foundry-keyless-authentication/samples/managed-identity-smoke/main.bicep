metadata description = 'Run the Microsoft Foundry keyless smoke test in Azure Container Instances.'

@description('Name of the container group for this smoke test run.')
param runName string

@description('Name of the existing user-assigned managed identity in the same resource group.')
param identityName string

@description('Microsoft Foundry resource endpoint without the OpenAI v1 path.')
param endpoint string

@description('Name of the model deployment on the Microsoft Foundry resource.')
param modelDeployment string

@description('Azure region for the container group.')
param location string = resourceGroup().location

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: identityName
}

resource runner 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: runName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    osType: 'Linux'
    restartPolicy: 'Never'
    containers: [
      {
        name: 'smoke'
        properties: {
          image: 'mcr.microsoft.com/devcontainers/python:1-3.11-bookworm'
          command: [
            '/bin/sh'
            '-c'
            'printf "%s\\n" "$SMOKE_REQUIREMENTS" > /tmp/requirements.txt && python -m pip install --disable-pip-version-check --no-cache-dir --quiet -r /tmp/requirements.txt && exec python -c "$SMOKE_SOURCE"'
          ]
          environmentVariables: [
            { name: 'SMOKE_REQUIREMENTS', value: loadTextContent('requirements.txt') }
            { name: 'SMOKE_SOURCE', value: loadTextContent('smoke.py') }
            { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
            { name: 'FOUNDRY_ENDPOINT', value: endpoint }
            { name: 'FOUNDRY_MODEL_DEPLOYMENT', value: modelDeployment }
          ]
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 1
            }
          }
        }
      }
    ]
  }
}
