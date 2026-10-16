targetScope = 'subscription'

@description('The Azure Developer CLI environment name.')
param environmentName string

@description('The Azure region for all resources.')
param location string

@description('The name of the resource group.')
param resourceGroupName string = 'rg-fretboard-lab-prod'

var uniqueSuffix = uniqueString(subscription().id, environmentName, location)
var staticWebAppName = 'swa-fretboard-lab-prod-${uniqueSuffix}'
var commonTags = {
  'azd-env-name': environmentName
}

module resourceGroupDeployment 'br/public:avm/res/resources/resource-group:0.4.4' = {
  name: 'resource-group-${uniqueSuffix}'
  params: {
    name: resourceGroupName
    location: location
    tags: commonTags
  }
}

module staticWebApp 'br/public:avm/res/web/static-site:0.9.3' = {
  name: 'static-web-app-${uniqueSuffix}'
  scope: resourceGroup(resourceGroupName)
  dependsOn: [
    resourceGroupDeployment
  ]
  params: {
    name: staticWebAppName
    location: location
    publicNetworkAccess: 'Enabled'
    sku: 'Free'
    stagingEnvironmentPolicy: 'Enabled'
    tags: union(commonTags, {
      'azd-service-name': 'web'
    })
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = resourceGroupDeployment.outputs.name
output STATIC_WEB_APP_NAME string = staticWebApp.outputs.name
output STATIC_WEB_APP_HOSTNAME string = staticWebApp.outputs.defaultHostname
output SERVICE_WEB_URI string = 'https://${staticWebApp.outputs.defaultHostname}'
