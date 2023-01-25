import WebSocket from "isomorphic-ws";

export type ConnectionInfo = {
  host: string;
  port: number;
  tls: boolean;
};

export class HathoraConnection {
  private socket!: WebSocket;
  private messageListeners: ((data: ArrayBuffer) => void)[] = [];
  private closeListeners: ((e: { code: number; reason: string }) => void)[] = [];

  public constructor(private roomId: string, private connectionInfo: ConnectionInfo) {}

  public onMessage(listener: (data: ArrayBuffer) => void) {
    this.messageListeners.push(listener);
  }

  public onClose(listener: (e: { code: number; reason: string }) => void) {
    this.closeListeners.push(listener);
  }

  public async connect(token: string): Promise<void> {
    const { host, port, tls } = this.connectionInfo;
    this.socket = new WebSocket(`${tls ? "wss" : "ws"}://${host}:${port}/${this.roomId}?token=${token}`);
    this.socket.binaryType = "arraybuffer";
    return new Promise((resolve, reject) => {
      this.socket.onopen = () => {
        resolve();
      };
      this.socket.onclose = (e) => {
        reject(e.reason);
        this._onClose(e);
      };
      this.socket.onmessage = ({ data }) => {
        if (!(data instanceof ArrayBuffer)) {
          throw new Error("Unexpected data type: " + typeof data);
        }
        this._onMessage(data);
      };
    });
  }

  public write(data: ArrayBuffer) {
    this.socket?.send(data);
  }

  public disconnect(code?: number | undefined): void {
    if (code === undefined) {
      this.socket.onclose = () => {};
    }
    this.socket.close(code);
  }

  private _onMessage(data: ArrayBuffer) {
    this.messageListeners.forEach((listener) => listener(data));
  }

  private _onClose(e: { code: number; reason: string }) {
    this.closeListeners.forEach((listener) => listener(e));
  }
}
