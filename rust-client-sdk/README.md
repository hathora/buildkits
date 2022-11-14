# Hathora Rust Client SDK

<a href="https://crates.io/crates/hathora-client-sdk"><img src="https://img.shields.io/crates/v/hathora-client-sdk.svg" alt="crate version"></a>

See this client in action here: https://github.com/hathora/topdown-shooter-bevy-client

## Usage

```rs
let app_id = "...".to_string();
let client = HathoraClient::new(app_id, None);
let token = client
    .login_anonymous()
    .expect("Logging in should succeed.");
let roomId = client
    .create(&token, vec![])
    .expect("Creating a room should succeed");
let mut connection = client
    .connect(&token, &roomId)
    .expect("Creating a websocket should succeed.");

match connection
    .read_message()
    .expect("Reading from websocket should succeed")
{
    Message::Binary(b) => println!("Got message: {:?}", b),
    _ => {}
}
connection
    .write_message(Message::Binary(b"{ message: \"Hello world\" }".to_vec()))
    .expect("Writing to socket should suceed");
```

## Publishing

```bash
cargo publish
```
