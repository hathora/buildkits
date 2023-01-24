import WebSocket from "isomorphic-ws";
import { ConnectionInfo } from "./client";

export enum TransportType {
  WebSocket,
  TCP,
  UDP,
}

export interface HathoraTransport {
  connect(
    stateId: string,
    token: string,
    onData: (data: ArrayBuffer) => void,
    onClose: (e: { code: number; reason: string }) => void
  ): Promise<void>;
  disconnect(code?: number): void;
  pong(): void;
  isReady(): boolean;
  write(data: Uint8Array): void;
}

export class WebSocketHathoraTransport implements HathoraTransport {
  private socket!: WebSocket;

  constructor(private connectionInfo: ConnectionInfo) {}

  public connect(
    roomId: string,
    token: string,
    onData: (data: ArrayBuffer) => void,
    onClose: (e: { code: number; reason: string }) => void
  ): Promise<void> {
    const { host, port, tls } = this.connectionInfo;
    this.socket = new WebSocket(`${tls ? "wss" : "ws"}://${host}:${port}/${roomId}?token=${token}`);
    this.socket.binaryType = "arraybuffer";
    return new Promise((resolve, reject) => {
      this.socket.onclose = (e) => {
        reject(e.reason);
        onClose(e);
      };
      this.socket.onopen = () => {
        resolve();
      };
      this.socket.onmessage = ({ data }) => {
        if (!(data instanceof ArrayBuffer)) {
          throw new Error("Unexpected data type: " + typeof data);
        }
        onData(data);
      };
    });
  }

  public disconnect(code?: number | undefined): void {
    if (code === undefined) {
      this.socket.onclose = () => {};
    }
    this.socket.close(code);
  }

  public isReady(): boolean {
    return this.socket.readyState === this.socket.OPEN;
  }

  public write(data: Uint8Array): void {
    this.socket.send(data);
  }

  public pong() {
    this.socket.ping();
  }
}
