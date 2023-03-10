![Hathora Logo](https://user-images.githubusercontent.com/7004280/223056895-c16419d2-2b91-4013-82f0-7616c84d31b7.svg)

# Hathora TypeScript Server SDK

<a href="https://www.npmjs.com/package/@hathora/client-sdk"><img src="https://badge.fury.io/js/@hathora%2Fserver-sdk.svg" alt="npm version"></a>

The Hathora TypeScript Server SDK provides a set of tools for handling connected users to your game server, and interfacing with their cooresponding clients.

- [Installation](#installation)
- [Getting an APP_ID and APP_SECRET](#getting-an-app_id-and-app_secret)
- [Defining Rooms](#defining-rooms)
- [Defining the Store](#defining-the-store)
- [Boot the Server](#boot-the-server)

## Installation

Run the following from your server app's directory to install the SDK as an NPM dependency:

```bash
npm install @hathora/server-sdk
```

## Getting an APP_ID and APP_SECRET

Visit [console.hathora.dev](https://console.hathora.dev/) and login if you haven't already done so.

You will be greeted with a project list screen, if you have already created an app the App ID and App Secret can be copied directly from the list...

![A screenshot of the Hathora console's project list](https://user-images.githubusercontent.com/7004280/223693106-b7660e2c-20bd-478d-9c68-a23440568526.png)

If you have not yet created an app, click the `Create Application` button. You will then be faced with the following screen...

![A screenshot of the Hathora console's Create Application screen](https://user-images.githubusercontent.com/7004280/223693567-9c24509f-c608-4525-be3d-4254c8e1b6d8.png)

After entering a valid name and creating your application, it's App ID and App Secret will be available to be copied.

## Defining Rooms

```ts
import { UserId, RoomId, Application, startServer, verifyJwt } from "@hathora/server-sdk";

// A type to define a player, internal to the server
type InternalPlayer = {
  id: UserId;
  x: number;
  y: number;
};

// A type to define the state of a single room, internal to the server
type InternalState = {
  players: InternalPlayer[];
};

// A map which the server uses to contain all rooms
const rooms: Map<RoomId, InternalState> = new Map();
```

## Defining the Store

```ts
// ...

const store: Application = {
  // A function called by Hathora to verify a connecting user's token
  verifyToken(token: string): UserId | undefined {
    const userId = verifyJwt(token, "YOUR_HATHORA_APP_SECRET");

    if (userId === undefined) {
      console.error("Failed to verify token", token);
    }

    return userId;
  },

  // Called when a new user connects to your server, this is a good place to init rooms and spawn players
  subscribeUser(roomId: RoomId, userId: string): void {
    // Make sure the room exists (or create one if not)
    if (!rooms.has(roomId)) {
      console.log("Creating new room...");

      rooms.set(roomId, {
        players: []
      });
    }

    const game = rooms.get(roomId)!;

    // Make sure the player hasn't already spawned, then spawn them
    if (!game.players.some((player) => player.id === userId)) {
      game.players.push({
        id: userId,
        x: 0,
        y: 0
      });
    }
  },

  // Called when a user disconnects from your server, this is a good place to cleanup data for that player
  unsubscribeUser(roomId: RoomId, userId: string): void {
    // Make sure the room exists
    if (!rooms.has(roomId)) {
      return;
    }
    
    const game = rooms.get(roomId)!;
    const idx = game.players.findIndex((player) => player.id === userId);
    
    // Remove the player from the room's state
    if (idx >= 0) {
      game.players.splice(idx, 1);
    }
  },

  // Called when a message is sent to the server for handling, much of your core logic will live here
  onMessage(roomId: RoomId, userId: string, data: ArrayBuffer): void {
    // Make sure the room exists
    if (!rooms.has(roomId)) {
      return;
    }

    // Get the player, or return out of the function if they don't exist
    const game = rooms.get(roomId)!;
    const player = game.players.find((player) => player.id === userId);
    if (player === undefined) {
      return;
    }

    // Parse out the data string being sent from the client
    const message = JSON.parse(Buffer.from(data).toString("utf8"));

    if (message.type === 'test-message') {
      if (message.value === 'Hello Hathora server!') {
        // Define a response message...
        const msg = {
          type: 'test-response',
          value: 'Hello Hathora clients!'
        };

        // Then broadcast it to all connected clients in this room
        server.broadcastMessage(roomId, Buffer.from(JSON.stringify(msg), "utf8"));
      }
    }
    // else if (message.type === 'some-other-action') {
    //   // (handle other message types)
    // }
  }
};
```

## Boot the Server

```ts
// ...

// Boot server
const port = 4000;
const server = await startServer(store, port);
console.log(`Server listening on port ${port}`);
```