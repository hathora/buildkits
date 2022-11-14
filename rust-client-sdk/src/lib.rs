use std::net::TcpStream;

use reqwest::Url;

use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};

use serde::{Deserialize, Serialize};
use tungstenite::{connect, stream::MaybeTlsStream, Message, WebSocket};

use anyhow::{anyhow, bail, Result};

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
        transport_type: HathoraTransportType,
    ) -> Result<Box<dyn HathoraTransport>> {
        match transport_type {
            HathoraTransportType::WebSocket => {
                let mut transport = WebsocketTransport::new(
                    self.app_id.clone(),
                    Some(self.coordinator_host.clone()),
                );
                transport.connect(state_id, token)?;
                Ok(Box::new(transport))
            }
        }
    }

    pub fn get_user_from_token(token: &str) -> Result<String> {
        let segments: Vec<&str> = token.split('.').collect();
        let bytes = base64::decode_config(segments[1], base64::URL_SAFE_NO_PAD)?;
        let token: Token = serde_json::from_slice(&bytes)?;
        Ok(token.id)
    }
}

pub enum HathoraTransportType {
    WebSocket,
}

pub trait HathoraTransport {
    fn connect(&mut self, state_id: &str, token: &str) -> Result<()>;

    fn write(&mut self, data: Vec<u8>) -> Result<()>;

    fn read(&mut self) -> Result<Vec<u8>>;

    fn is_ready(&self) -> bool;

    fn disconnect(&mut self, code: Option<i32>) -> Result<()>;
}

struct WebsocketTransport {
    web_socket: WebSocket<MaybeTlsStream<TcpStream>>,
}

impl WebsocketTransport {
    fn new(app_id: String, coordinator_host: Option<String>) -> WebsocketTransport {
        let coordinator_host = coordinator_host.unwrap_or("coordinator.hathora.dev".to_string());
        let websocket_url = format!("wss://{}/connect/{}", coordinator_host, app_id);
        let (web_socket, _response) =
            connect(Url::parse(&websocket_url).unwrap()).expect("Can't connect to websocket");
        return WebsocketTransport { web_socket };
    }
}

impl HathoraTransport for WebsocketTransport {
    fn connect(&mut self, state_id: &str, token: &str) -> Result<()> {
        let initial_state = InitialState {
            token: token.to_string(),
            stateId: state_id.to_string(),
        };
        let message = serde_json::to_vec(&initial_state).expect("Serialization should work");
        self.web_socket.write_message(Message::binary(message))?;
        match self.web_socket.get_mut() {
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
        Ok(())
    }

    fn write(&mut self, data: Vec<u8>) -> Result<()> {
        self.web_socket.write_message(Message::Binary(data))?;
        Ok(())
    }

    fn read(&mut self) -> Result<Vec<u8>> {
        let message = self.web_socket.read_message()?;

        match message {
            Message::Binary(data) => Ok(data),
            _ => Err(anyhow!("Message did not contain binary data.")),
        }
    }

    fn is_ready(&self) -> bool {
        self.web_socket.can_read() && self.web_socket.can_write()
    }

    fn disconnect(&mut self, code: Option<i32>) -> Result<()> {
        let close_code = code.map(|c| CloseFrame {
            code: CloseCode::from(c as u16),
            reason: std::borrow::Cow::Borrowed(""),
        });

        self.web_socket
            .close(close_code)
            .map_err(|e| anyhow!("Failed to close websocket"))
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
