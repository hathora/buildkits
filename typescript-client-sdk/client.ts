import axios from "axios";
import jwtDecode from "jwt-decode";
import { HathoraTransport, TransportType, WebSocketHathoraTransport } from "./transport.js";

export class HathoraClient {
  public static getUserFromToken(token: string): object & { id: string } {
    return jwtDecode(token);
  }

  public constructor(private appId: string) {}

  public async loginAnonymous(): Promise<string> {
    const res = await axios.post(`https://hathora-api.fly.dev/v2/auth/${this.appId}/login/anonymous`);
    return res.data.token;
  }

  public async loginNickname(nickname: string): Promise<string> {
    const res = await axios.post(`https://hathora-api.fly.dev/v2/auth/${this.appId}/login/nickname`, { nickname });
    return res.data.token;
  }

  public async loginGoogle(idToken: string): Promise<string> {
    const res = await axios.post(`https://hathora-api.fly.dev/v2/auth/${this.appId}/login/google`, { idToken });
    return res.data.token;
  }

  public async create(token: string): Promise<string> {
    const res = await axios.post(`https://hathora-api.fly.dev/v2/lobby/${this.appId}/create/unlisted`, {}, {
      headers: { Authorization: token },
    });
    return res.data.roomId;
  }

  public async getServerUrlForRoomId(roomId: string, tls: boolean = true): Promise<string> {
    const res = await axios.get(`https://hathora-api.fly.dev/v2/rooms/${this.appId}/connectioninfo/${roomId}`);
    return `${tls ? "wss" : "ws"}://${res.data.host}:${res.data.port}`;
  }

  public async connect(
    token: string,
    roomId: string,
    serverUrl: string,
    onMessage: (data: ArrayBuffer) => void,
    onClose: (e: { code: number; reason: string }) => void,
    transportType: TransportType = TransportType.WebSocket
  ): Promise<HathoraTransport> {
    const connection = this.getConnectionForTransportType(serverUrl, transportType);
    await connection.connect(roomId, token, onMessage, onClose);
    return connection;
  }

  private getConnectionForTransportType(serverUrl: string, transportType: TransportType): HathoraTransport {
    if (transportType === TransportType.WebSocket) {
      return new WebSocketHathoraTransport(serverUrl);
    }
    throw new Error("Unsupported transport type: " + transportType);
  }
}
