# Hathora Typescript Client SDK

## Usage

```ts
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// sha256 hash of app secret
const APP_ID = "...";
// create client
const client = new HathoraClient(APP_ID);

// login
const token = await client.loginAnonymous();
// create new room
const roomId = await client.create(token, new Uint8Array());
// connect to room and subscribe to messages
const connection = client.connect(token, roomId, onMessage, onError);

// send message to backend
connection.write(encoder.encode(JSON.stringify({ message: "Hello world" })));

// process message from backend
function onMessage(msg) {
  console.log(JSON.parse(decoder.decode(data)));
}

// process error from backend
function onError(error) {
  console.error(error);
}
```
