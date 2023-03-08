![Hathora Logo](https://user-images.githubusercontent.com/7004280/223056895-c16419d2-2b91-4013-82f0-7616c84d31b7.svg)

# Hathora TypeScript Client SDK

<a href="https://www.npmjs.com/package/@hathora/client-sdk"><img src="https://badge.fury.io/js/@hathora%2Fclient-sdk.svg" alt="npm version"></a>

The Hathora TypeScript Client SDK is used to connect your game or application to your Hathora server, and send / receive messages between the two.

## Installation

Run the following from your client app's directory to install the SDK as an NPM dependency:

```bash
npm install @hathora/client-sdk
```

## Getting an APP_ID and APP_SECRET

Visit [console.hathora.dev](https://console.hathora.dev/) and login if you haven't already done so.

You will be greeted with a project list screen, if you have already created an app the App ID and App Secret can be copied directly from the list...

![A screenshot of the Hathora console's project list](https://user-images.githubusercontent.com/7004280/223693106-b7660e2c-20bd-478d-9c68-a23440568526.png)

If you have not yet created an app, click the `Create Application` button. You will then be faced with the following screen...

![A screenshot of the Hathora console's Create Application screen](https://user-images.githubusercontent.com/7004280/223693567-9c24509f-c608-4525-be3d-4254c8e1b6d8.png)

After entering a valid name and creating your application, it's App ID and App Secret will be available to be copied.

## Establishing a connection

```ts
import { HathoraClient } from "@hathora/client-sdk";

async function establishConnection() {
  return new Promise((resolve) => {
    // Instantiate an object which represents our local connection info...
    const connectionInfo = { host: "localhost", port: 4000, transportType: "tcp" as const };

    // Or pass undefined if working in a production Hathora environment
    // const connectionInfo = undefined;
  
    // Instantiate our client object (this is where you provide a valid Hathora APP_ID, which here is being passed via an environment variable)
    const client = new HathoraClient("YOUR_HATHORA_APP_ID", connectionInfo);
  
    // Use the client to get a token for the user
    const token = await client.loginAnonymous();
  
    // You can now create a new public room
    const newPublicRoomId = await client.createPublicLobby(token);
  
    // Or a new private room
    const newPrivateRoomId = await client.createPrivateLobby(token);
  
    // And query for existing public rooms
    const existingPublicRoomIds = await client.getPublicLobbies(token);
  
    // Create a HathoraConnection instance
    const connection = client.newConnection(newPublicRoomId);

    // Handle connection closing how you like
    connection.onClose((error) => {
      console.error("Connection closed", error);
    });

    // Initiate the connection
    connection.connect(token);

    // And resolve our promise, passing our connection to be used later...
    resolve(connection);
  });
}
```

## Using the connection

```ts
// ...

async function example() {
  // Establish a Hathora connection (see above)
  const connection = await establishConnection();

  // Write JSON messages to the server
  connection.writeJson({
    type: 'test-message',
    value: 'Hello Hathora server!'
  });

  // Listen for JSON messages from the server
  connection.onMessageJson((json) => {
    // Handle the message in your app...
    console.log(json);
  });
}
```