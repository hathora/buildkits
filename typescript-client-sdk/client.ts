import jwtDecode from "jwt-decode";
import { ConnectionInfo, HathoraConnection } from "./connection";

export class HathoraClient {
  public static getUserFromToken(token: string): object & { id: string } {
    return jwtDecode(token);
  }

  public constructor(private appId: string, private localConnectionInfo?: ConnectionInfo) {}

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
      `https://hathora-api.fly.dev/v2/lobby/${this.appId}/create/unlisted?local=${
        this.localConnectionInfo === undefined ? "false" : "true"
      }`,
      {},
      { Authorization: token }
    );
  }

  public async getConnectionInfoForRoomId(roomId: string): Promise<ConnectionInfo> {
    if (this.localConnectionInfo !== undefined) {
      return this.localConnectionInfo;
    }
    const res = await fetch(`https://hathora-api.fly.dev/v2/rooms/${this.appId}/connectioninfo/${roomId}`);
    return await res.json();
  }

  public async newConnection(roomId: string): Promise<HathoraConnection> {
    const connectionInfo = await this.getConnectionInfoForRoomId(roomId);
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
