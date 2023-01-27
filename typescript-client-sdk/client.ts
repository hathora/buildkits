import jwtDecode from "jwt-decode";
import { ConnectionInfo, HathoraConnection } from "./connection";

export class HathoraClient {
  public static getUserFromToken(token: string): object & { id: string } {
    return jwtDecode(token);
  }

  public constructor(private appId: string, private defaultConnectionInfo: ConnectionInfo) {}

  public async loginAnonymous(): Promise<string> {
    const res = await this.postJson(`https://hathora-api.fly.dev/v2/auth/${this.appId}/login/anonymous`, {});
    return res.token;
  }

  public async loginNickname(nickname: string): Promise<string> {
    const res = await this.postJson(`https://hathora-api.fly.dev/v2/auth/${this.appId}/login/nickname`, { nickname });
    return res.token;
  }

  public async loginGoogle(idToken: string): Promise<string> {
    const res = await this.postJson(`https://hathora-api.fly.dev/v2/auth/${this.appId}/login/google`, { idToken });
    return res.token;
  }

  public async createPrivateLobby(token: string): Promise<string> {
    return await this.postJson(
      `https://hathora-api.fly.dev/v2/lobby/${this.appId}/create/unlisted`,
      {},
      { Authorization: token }
    );
  }

  public async getConnectionInfoForRoomId(roomId: string, tls: boolean = true): Promise<ConnectionInfo> {
    const res = await fetch(`https://hathora-api.fly.dev/v2/rooms/${this.appId}/connectioninfo/${roomId}`);
    const data = await res.json();
    if (data.host === "") {
      return this.defaultConnectionInfo;
    }
    return { host: data.host, port: data.port, tls };
  }

  public async newConnection(roomId: string, tls: boolean = true): Promise<HathoraConnection> {
    const connectionInfo = await this.getConnectionInfoForRoomId(roomId, tls);
    return new HathoraConnection(roomId, connectionInfo);
  }

  private async postJson(url: string, body: any, headers: Record<string, string> = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  }
}
