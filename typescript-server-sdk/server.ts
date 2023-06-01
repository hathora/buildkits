import uWS from "uWebSockets.js";
import jwt from "jsonwebtoken";

export type RoomId = string;

export type UserId = string;

export interface Application {
  verifyToken(token: string, roomId: RoomId): UserId | undefined;
  subscribeUser(roomId: RoomId, userId: UserId): void;
  unsubscribeUser(roomId: RoomId, userId: UserId): void;
  onMessage(roomId: RoomId, userId: UserId, data: ArrayBuffer): Promise<void>;
}

export interface Server {
  broadcastMessage(roomId: RoomId, data: ArrayBuffer): void;
  sendMessage(roomId: RoomId, userId: UserId, data: ArrayBuffer): void;
  closeConnection(roomId: RoomId, userId: UserId, error: string): void;
}

type ConnectionData = {
  roomId: RoomId;
  userId: UserId;
};

const socketsMap: Map<string, uWS.WebSocket<ConnectionData>> = new Map();

export function startServer(app: Application, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = uWS
      .App()
      .ws<ConnectionData>("/:roomId", {
        upgrade: (res, req, context) => {
          const roomId = req.getParameter(0);
          const queryParts = req.getQuery().split("token=");
          if (queryParts.length !== 2) {
            res.writeStatus("401").end();
            return;
          }
          const token = queryParts[1];
          const userId = app.verifyToken(token, roomId);
          if (userId === undefined) {
            res.writeStatus("401").end();
            return;
          }
          if (socketsMap.has(roomId + userId)) {
            res.writeStatus("400").end();
            return;
          }
          res.upgrade(
            { roomId, userId },
            req.getHeader("sec-websocket-key"),
            req.getHeader("sec-websocket-protocol"),
            req.getHeader("sec-websocket-extensions"),
            context
          );
        },
        open: (ws) => {
          const { roomId, userId } = ws.getUserData();
          ws.subscribe(roomId);
          socketsMap.set(roomId + userId, ws);
          app.subscribeUser(roomId, userId);
        },
        message: (ws, message) => {
          const { roomId, userId } = ws.getUserData();
          app.onMessage(roomId, userId, message);
        },
        close: (ws) => {
          const { roomId, userId } = ws.getUserData();
          socketsMap.delete(roomId + userId);
          app.unsubscribeUser(roomId, userId);
        },
      })
      .listen(port, (listenSocket) => {
        if (listenSocket) {
          resolve({
            sendMessage: (roomId: RoomId, userId: UserId, data: ArrayBuffer) => {
              socketsMap.get(roomId + userId)?.send(data, true);
            },
            broadcastMessage: (roomId: RoomId, data: ArrayBuffer) => {
              server.publish(roomId, data, true);
            },
            closeConnection: (roomId: RoomId, userId: UserId, error: string) => {
              socketsMap.get(roomId + userId)?.end(4000, error);
            },
          });
        } else {
          reject(`Server failed to start, is the port ${port} already in use?`);
        }
      });
  });
}

export function verifyJwt(token: string, secret: string, userIdField: string = "id"): UserId | undefined {
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === "object" && typeof payload.id === "string") {
      return payload[userIdField];
    }
  } catch (e) {}
}
