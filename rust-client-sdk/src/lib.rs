use std::net::TcpStream;

use reqwest::Url;

use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};

use serde::{Deserialize, Serialize};
use tungstenite::{connect, stream::MaybeTlsStream, Message, WebSocket};

use anyhow::{bail, Result};

pub struct HathoraClient {
    app_id: String,
    coordinator_host: String,
    client: Client,
}

impl HathoraClient {
    pub fn new(app_id: String, coordinator_host: Option<String>) -> Self {
        HathoraClient {
            app_id,
            coordinator_host: coordinator_host.unwrap_or("coordinator.hathora.dev".to_string()),
            client: Client::new(),
        }
    }

    pub fn login_anonymous(&self) -> Result<String> {
        let login_url = format!(
            "https://{}/{}/login/anonymous",
            self.coordinator_host, self.app_id
        );
        let resp: LoginResponse = self.client.post(login_url).send()?.json()?;
        Ok(resp.token)
    }

    pub fn login_nickname(&self) -> Result<String> {
        let login_url = format!(
            "https://{}/{}/login/nickname",
            self.coordinator_host, self.app_id
        );
        let resp: LoginResponse = self.client.post(login_url).send()?.json()?;
        Ok(resp.token)
    }

    pub fn login_google(&self) -> Result<String> {
        let login_url = format!(
            "https://{}/{}/login/google",
            self.coordinator_host, self.app_id
        );
        let resp: LoginResponse = self.client.post(login_url).send()?.json()?;
        Ok(resp.token)
    }

    pub fn create(&self, token: &str, body: Vec<u8>) -> Result<String> {
        let create_url = format!("https://{}/{}/create", self.coordinator_host, self.app_id);
        let response: CreateRoomResponse = self
            .client
            .post(create_url)
            .header(AUTHORIZATION, token)
            .header(CONTENT_TYPE, "application/octet-stream")
            .body(body)
            .send()?
            .json()?;
        Ok(response.stateId)
    }

    pub fn connect(
        &self,
        token: &str,
        state_id: &str,
    ) -> Result<WebSocket<MaybeTlsStream<TcpStream>>> {
        let websocket_url = format!("wss://{}/connect/{}", self.coordinator_host, self.app_id);
        let (mut socket, _response) =
            connect(Url::parse(&websocket_url).unwrap()).expect("Can't connect to websockets");
        let initial_state = InitialState {
            token: token.to_string(),
            stateId: state_id.to_string(),
        };
        let message = serde_json::to_vec(&initial_state).expect("Serialization should work");
        socket.write_message(Message::binary(message))?;
        match socket.get_mut() {
            MaybeTlsStream::Plain(tcp_stream) => {
                tcp_stream.set_nonblocking(true)?;
            }
            MaybeTlsStream::NativeTls(tls_stream) => {
                tls_stream.get_mut().set_nonblocking(true)?;
            }
            _ => {
                bail!("Unknown socket type.");
            }
        }
        Ok(socket)
    }

    pub fn get_user_from_token(token: &str) -> Result<String> {
        let segments: Vec<&str> = token.split('.').collect();
        let bytes = base64::decode_config(segments[1], base64::URL_SAFE_NO_PAD)?;
        let token: Token = serde_json::from_slice(&bytes)?;
        Ok(token.id)
    }
}

#[derive(Serialize, Debug)]
struct InitialState {
    token: String,
    stateId: String,
}

#[derive(Deserialize)]
struct CreateRoomResponse {
    stateId: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Token {
    id: String,
}
