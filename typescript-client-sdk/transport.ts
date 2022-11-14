import net from "net";
import WebSocket from "isomorphic-ws";
import { Reader, Writer } from "bin-serde";

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
  private socket: WebSocket;

  constructor(appId: string, coordinatorHost: string) {
    this.socket = new WebSocket(`wss://${coordinatorHost}/connect/${appId}`);
  }

  public connect(
    stateId: string,
    token: string,
    onData: (data: ArrayBuffer) => void,
    onClose: (e: { code: number; reason: string }) => void
  ): Promise<void> {
    let connected = false;
    return new Promise((resolve, reject) => {
      this.socket.binaryType = "arraybuffer";
      this.socket.onclose = (e) => {
        reject(e.reason);
        onClose(e);
      };
      this.socket.onopen = () => {
        this.socket.send(new TextEncoder().encode(JSON.stringify({ stateId, token })));
      };
      this.socket.onmessage = ({ data }) => {
        if (!(data instanceof ArrayBuffer)) {
          throw new Error("Unexpected data type: " + typeof data);
        }
        if (!connected) {
          connected = true;
          resolve();
        } else {
          onData(data);
        }
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

export class TCPHathoraTransport implements HathoraTransport {
  private socket: net.Socket;

  constructor(private appId: string, private coordinatorHost: string) {
    this.socket = new net.Socket();
  }

  public connect(
    stateId: string,
    token: string,
    onData: (data: ArrayBuffer) => void,
    onClose: (e: { code: number; reason: string }) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.connect(7148, this.coordinatorHost);
      this.socket.on("connect", () =>
        this.socket.write(
          new Writer()
            .writeString(token)
            .writeString(this.appId)
            .writeUInt64([...stateId].reduce((r, v) => r * 36n + BigInt(parseInt(v, 36)), 0n))
            .toBuffer()
        )
      );
      this.socket.once("data", (data) => {
        const reader = new Reader(new Uint8Array(data as ArrayBuffer));
        const type = reader.readUInt8();
        if (type === 0) {
          this.readTCPData(onData);
          this.socket.on("close", onClose);
          onData(data as Buffer);
          resolve();
        } else {
          reject("Unknown message type: " + type);
        }
      });
    });
  }

  public write(data: Uint8Array) {
    this.socket.write(
      new Writer()
        .writeUInt32(data.length + 1)
        .writeUInt8(0)
        .writeBuffer(data)
        .toBuffer()
    );
  }

  public disconnect(code?: number | undefined): void {
    this.socket.destroy();
  }

  public isReady(): boolean {
    return this.socket.readyState === "open";
  }

  public pong(): void {
    this.socket.write(new Writer().writeUInt32(1).writeUInt8(1).toBuffer());
  }

  private readTCPData(onData: (data: Buffer) => void) {
    let buf = Buffer.alloc(0);
    this.socket.on("data", (data) => {
      buf = Buffer.concat([buf, data]);
      while (buf.length >= 4) {
        const bufLen = buf.readUInt32BE();
        if (buf.length < 4 + bufLen) {
          return;
        }
        onData(buf.subarray(4, 4 + bufLen));
        buf = buf.subarray(4 + bufLen);
      }
    });
  }
}
