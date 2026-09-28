targetScope = 'subscription'

@minLength(1)
@maxLength(40)
@description('azd environment name, used to name the resource group and derive resource names')
param environmentName string

@minLength(1)
@description('Primary Azure region for all resources')
param location string

@description('Object ID of the deploying user. Grants local development access to the models. Leave empty to skip.')
param principalId string = ''

@allowed(['User', 'ServicePrincipal'])
param principalType string = 'User'

@description('Image for the web service. azd fills this after the first deploy.')
param webImageName string = ''

@description('Image for the mcp service. azd fills this after the first deploy.')
param mcpImageName string = ''

var tags = { 'azd-env-name': environmentName }

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
    principalId: principalId
    principalType: principalType
    webImageName: webImageName
    mcpImageName: mcpImageName
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.registryLoginServer
output AZURE_OPENAI_RESOURCE_NAME string = resources.outputs.openAiResourceName
output AZURE_OPENAI_ENDPOINT string = resources.outputs.openAiEndpoint
output AZURE_OPENAI_LUNA_DEPLOYMENT string = resources.outputs.lunaDeployment
output AZURE_OPENAI_TERRA_DEPLOYMENT string = resources.outputs.terraDeployment
output WEB_URL string = resources.outputs.webUrl
