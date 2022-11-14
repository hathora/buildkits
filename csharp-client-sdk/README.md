# Hathora C# Client  SDK

[![openupm](https://img.shields.io/npm/v/com.hathora.client?label=openupm&registry_uri=https://package.openupm.com)](https://openupm.com/packages/com.hathora.client/)
[![NuGet version (Hathora.ClientSdk)](https://img.shields.io/nuget/v/Hathora.ClientSdk.svg?style=flat-square)](https://www.nuget.org/packages/Hathora.ClientSdk/)

## Installation

### OpenUPM

```bash
openupm add com.hathora.client
```

### Nuget
```bash
dotnet add package Hathora.ClientSdk --version 2.0.0
```

## Usage 

```csharp
string appId = "...";
Hathora.Client client = new Hathora.Client(appId);
string token = await client.LoginAnonymous();
string roomId = await client.Create(token, new byte[] { });
Hathora.Transport webSocket = await client.Connect(token, roomId, Hathora.Client.TransportType.WebSocket);

if (webSocket.IsReady())
{
    byte[] readResult = await webSocket.ReadMessage();
    Console.WriteLine(Encoding.UTF8.GetString(readResult));
    await webSocket.WriteMessage(Encoding.UTF8.GetBytes("{ message: \"Hello world\" }"));
}
```

## Publishing Instructions

### OpenUPM

Update `package.json` version to $VERSION; commit this change.
```bash
git tag $VERSION
git push origin $VERSION
```
Then openUPM will trigger a build pipeline; see https://openupm.com/packages/com.hathora.client/?subPage=pipelines

### Nuget

Update the `client-sdk-csharp.csproj` `Version` property to `$VERSION`.
```bash
dotnet pack --configuration Release
nuget push ./bin/Release/Hathora.ClientSdk.$RELEASE.nupkg -Source https://api.nuget.org/v3/index.json
```
