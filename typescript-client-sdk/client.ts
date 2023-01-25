import axios from "axios";
import jwtDecode from "jwt-decode";
import { ConnectionInfo, HathoraConnection } from "./connection";

export class HathoraClient {
  public static getUserFromToken(token: string): object & { id: string } {
    return jwtDecode(token);
  }

  public constructor(private appId: string, private defaultConnectionInfo: ConnectionInfo) {}

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

  public async createUnlistedLobby(token: string): Promise<string> {
    const res = await axios.post(
      `https://hathora-api.fly.dev/v2/lobby/${this.appId}/create/unlisted`,
      {},
      { headers: { Authorization: token } }
    );
    return res.data;
  }

  public async getConnectionInfoForRoomId(roomId: string, tls: boolean = true): Promise<ConnectionInfo> {
    const res = await axios.get(`https://hathora-api.fly.dev/v2/rooms/${this.appId}/connectioninfo/${roomId}`);
    if (res.data.host === "") {
      return this.defaultConnectionInfo;
    }
    return { host: res.data.host, port: res.data.port, tls };
  }

  public async newConnection(roomId: string, tls: boolean = true): Promise<HathoraConnection> {
    const connectionInfo = await this.getConnectionInfoForRoomId(roomId, tls);
    return new HathoraConnection(roomId, connectionInfo);
  }
}
