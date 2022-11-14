import net from "net";
import { v4 as uuidv4 } from "uuid";
import { Reader, Writer } from "bin-serde";

const NEW_STATE = 0;
const SUBSCRIBE_USER = 1;
const UNSUBSCRIBE_USER = 2;
const MESSAGE = 3;

enum STORE_MESSAGES {
  SEND_MESSAGE = 0,
  CLOSE_CONNECTION = 1,
  PING = 2,
}

const PING_INTERVAL_MS = 10000;

export type RoomId = bigint;
export type UserId = string;
export type AppId = string;
export type StoreId = string;

function readData(socket: net.Socket, onData: (data: Buffer) => void) {
  let buf = Buffer.alloc(0);
  socket.on("data", (data) => {
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

export type AuthInfo = {
  anonymous?: { separator: string };
  nickname?: {};
  google?: { clientId: string };
  email?: { secretApiKey: string };
};

export interface Store {
  newState(roomId: RoomId, userId: UserId, data: ArrayBufferView): void;
  subscribeUser(roomId: RoomId, userId: UserId): void;
  unsubscribeUser(roomId: RoomId, userId: UserId): void;
  onMessage(roomId: RoomId, userId: UserId, data: ArrayBufferView): void;
}

export type RegisterConfig = {
  coordinatorHost?: string;
  appSecret: string;
  storeId?: StoreId;
  authInfo: AuthInfo;
  store: Store;
};

export function register(config: RegisterConfig): Promise<CoordinatorClient> {
  const coordinatorHost = config.coordinatorHost ?? "coordinator.hathora.dev";
  const storeId = config.storeId ?? uuidv4();
  const { appSecret, authInfo, store } = config;
  const subscribers: Map<RoomId, Set<UserId>> = new Map();
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let pingTimer: NodeJS.Timer;
    socket.connect(7147, coordinatorHost).setKeepAlive(true);
    socket.on("connect", () => {
      socket.write(JSON.stringify({ appSecret, storeId, authInfo }));
      const coordinatorClient = new CoordinatorClient(socket, coordinatorHost, storeId, subscribers);
      if (pingTimer !== undefined) {
        console.log(`Reconnected to coordinator`);
      }
      pingTimer = setInterval(() => coordinatorClient._ping(), PING_INTERVAL_MS);
      resolve(coordinatorClient);
    });
    socket.on("error", (err) => {
      console.error("Coordinator connection error", err);
      if (pingTimer !== undefined) {
        clearInterval(pingTimer);
      }
      reject(err.message);
    });
    socket.on("close", () => {
      console.error("Coordinator connection closed, retrying...");
      subscribers.forEach((userIds, roomId) => {
        userIds.forEach((userId) => {
          store.unsubscribeUser(roomId, userId);
        });
      });
      if (pingTimer !== undefined) {
        clearInterval(pingTimer);
      }
      setTimeout(() => socket.connect(7147, coordinatorHost), 1000 + Math.random() * 1000);
    });
    readData(socket, (data) => {
      const reader = new Reader(data);
      const type = reader.readUInt8();
      if (type === NEW_STATE) {
        const [roomId, userId, data] = [
          reader.readUInt64(),
          reader.readString(),
          reader.readBuffer(reader.remaining()),
        ];
        subscribers.set(roomId, new Set());
        store.newState(roomId, userId, data);
      } else if (type === SUBSCRIBE_USER) {
        const [roomId, userId] = [reader.readUInt64(), reader.readString()];
        if (!subscribers.has(roomId)) {
          subscribers.set(roomId, new Set());
        }
        subscribers.get(roomId)!.add(userId);
        store.subscribeUser(roomId, userId);
      } else if (type === UNSUBSCRIBE_USER) {
        const [roomId, userId] = [reader.readUInt64(), reader.readString()];
        const subs = subscribers.get(roomId);
        if (subs !== undefined) {
          subs.delete(userId);
          if (subs.size === 0) {
            subscribers.delete(roomId);
          }
        }
        store.unsubscribeUser(roomId, userId);
      } else if (type === MESSAGE) {
        const [roomId, userId, data] = [
          reader.readUInt64(),
          reader.readString(),
          reader.readBuffer(reader.remaining()),
        ];
        store.onMessage(roomId, userId, data);
      } else {
        console.error("Unknown type: " + type);
      }
    });
  });
}

export class CoordinatorClient {
  constructor(
    private socket: net.Socket,
    public host: string,
    public storeId: StoreId,
    private subscribers: Map<RoomId, Set<UserId>>
  ) {}

  public sendMessage(roomId: RoomId, userId: UserId, data: Buffer): void {
    const userIdBuf = new Writer().writeString(userId).toBuffer();
    this.socket.write(
      new Writer()
        .writeUInt32(9 + userIdBuf.length + data.length)
        .writeUInt8(STORE_MESSAGES.SEND_MESSAGE)
        .writeUInt64(roomId)
        .writeBuffer(userIdBuf)
        .writeBuffer(data)
        .toBuffer()
    );
  }

  public broadcastMessage(roomId: RoomId, data: Buffer): void {
    this.getSubscribers(roomId).forEach((userId) => {
      this.sendMessage(roomId, userId, data);
    });
  }

  public closeConnection(roomId: RoomId, userId: UserId, error: string): void {
    const userIdBuf = new Writer().writeString(userId).toBuffer();
    this.socket.write(
      new Writer()
        .writeUInt32(9 + userIdBuf.length)
        .writeUInt8(STORE_MESSAGES.CLOSE_CONNECTION)
        .writeUInt64(roomId)
        .writeBuffer(userIdBuf)
        .toBuffer()
    );
  }

  public getSubscribers(roomId: RoomId): UserId[] {
    const subs = this.subscribers.get(roomId);
    if (subs === undefined) {
      return [];
    }
    return [...subs];
  }

  _ping() {
    this.socket.write(new Writer().writeUInt32(1).writeUInt8(STORE_MESSAGES.PING).toBuffer());
  }
}
