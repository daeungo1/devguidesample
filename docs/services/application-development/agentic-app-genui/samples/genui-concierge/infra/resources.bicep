@description('Primary Azure region')
param location string

param tags object

@description('Deploying user object ID for local development access. Empty skips the assignment.')
param principalId string

param principalType string

param webImageName string

param mcpImageName string

@description('GPT-5.6 models to deploy. Tool calling on GPT-5.6 uses the Responses API.')
param modelVersion string = '2026-07-09'

@minValue(1)
@description('GlobalStandard capacity in thousands of tokens per minute, per model')
param modelCapacity int = 50

var resourceToken = toLower(uniqueString(subscription().id, resourceGroup().id, location))
var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
var lunaDeployment = 'gpt-5.6-luna'
var terraDeployment = 'gpt-5.6-terra'

// Built-in role definition IDs
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
// Cognitive Services User: Entra ID inference access on a Foundry resource.
var inferenceRoleId = 'a97b65f3-24c7-4388-baec-2e87135dc908'

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${resourceToken}'
  location: location
  tags: tags
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'cr${resourceToken}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, acrPullRoleId)
  scope: registry
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

resource foundry 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: 'ai-${resourceToken}'
  location: location
  tags: tags
  kind: 'AIServices'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: 'ai-${resourceToken}'
    // Keyless only: every caller authenticates with Microsoft Entra ID.
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
  }
}

resource luna 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: foundry
  name: lunaDeployment
  sku: { name: 'GlobalStandard', capacity: modelCapacity }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-5.6-luna', version: modelVersion }
  }
}

// Deployments on the same account must be created one at a time.
resource terra 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: foundry
  name: terraDeployment
  sku: { name: 'GlobalStandard', capacity: modelCapacity }
  properties: {
    model: { format: 'OpenAI', name: 'gpt-5.6-terra', version: modelVersion }
  }
  dependsOn: [luna]
}

resource appInference 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(foundry.id, identity.id, inferenceRoleId)
  scope: foundry
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', inferenceRoleId)
  }
}

resource developerInference 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(principalId)) {
  name: guid(foundry.id, principalId, inferenceRoleId)
  scope: foundry
  properties: {
    principalId: principalId
    principalType: principalType
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', inferenceRoleId)
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${resourceToken}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource mcp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-mcp-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'mcp' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      // Internal only: the MCP server is reachable from the web app, not from browsers.
      ingress: { external: false, targetPort: 3001, transport: 'http' }
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
    }
    template: {
      containers: [
        {
          name: 'mcp'
          image: empty(mcpImageName) ? placeholderImage : mcpImageName
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          env: [
            { name: 'HOST', value: '0.0.0.0' }
            { name: 'PORT', value: '3001' }
            // DNS rebinding protection: accept only the internal ingress host name.
            { name: 'ALLOWED_HOSTS', value: 'ca-mcp-${resourceToken}.internal.${environment.properties.defaultDomain}' }
          ]
          probes: [
            { type: 'Liveness', httpGet: { path: '/healthz', port: 3001 }, periodSeconds: 30 }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 2 }
    }
  }
  dependsOn: [acrPull]
}

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-web-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: { external: true, targetPort: 3000, transport: 'http' }
      registries: [{ server: registry.properties.loginServer, identity: identity.id }]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: empty(webImageName) ? placeholderImage : webImageName
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'AZURE_CLIENT_ID', value: identity.properties.clientId }
            { name: 'AZURE_OPENAI_RESOURCE_NAME', value: foundry.name }
            { name: 'AZURE_OPENAI_LUNA_DEPLOYMENT', value: luna.name }
            { name: 'AZURE_OPENAI_TERRA_DEPLOYMENT', value: terra.name }
            { name: 'MCP_SERVER_URL', value: 'https://${mcp.properties.configuration.ingress.fqdn}/mcp' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 2 }
    }
  }
  dependsOn: [acrPull, appInference]
}

output registryLoginServer string = registry.properties.loginServer
output openAiResourceName string = foundry.name
output openAiEndpoint string = 'https://${foundry.properties.customSubDomainName}.openai.azure.com/'
output lunaDeployment string = luna.name
output terraDeployment string = terra.name
output webUrl string = 'https://${web.properties.configuration.ingress.fqdn}'
