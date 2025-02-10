import * as cookie from "cookie";

const EVENT_USER_CONNECTED = 2;
const EVENT_USER_DISCONNECTED = 3;

type WebSocketData = {
  roomId?: string;
  userId?: string;
  sessionId?: string;
  handshake?: string;
};

type Metadata = {
  u?: string; // userId
  e?: number; // event
  m?: string; // message
  s?: string; // sessionId
  x?: string; // handshake
};

const PORT = process.env.PORT || 3000;

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const cookies = cookie.parse(req.headers.get("Cookie") || "");
    const roomId = cookies.roomId;
    const userId = cookies.userId;
    const handshake = cookies.handshake;
    if (!roomId || !userId || !handshake) {
      return new Response("Something Went Wrong", { status: 500 });
    }
    const sessionId = crypto.randomUUID();
    if (server.upgrade(req, { data: { roomId, userId, sessionId, handshake } })) {
      return;
    }
    return new Response("Something Went Wrong", { status: 500 });
  },
  websocket: {
    idleTimeout: 300,
    maxPayloadLength: 1024 * 1024,
    open(ws) {
      try {
        const data = ws.data as WebSocketData;
        if (!data.roomId || !data.userId || !data.sessionId || !data.handshake) return;
        ws.subscribe(data.roomId);
        server.publish(
          data.roomId,
          JSON.stringify({
            e: EVENT_USER_CONNECTED,
            u: data.userId,
            s: data.sessionId,
            x: data.handshake,
          } as Metadata),
        );
      } catch {}
    },
    message(ws, message) {
      try {
        const data = ws.data as WebSocketData;
        if (!data.roomId || !data.userId || !data.sessionId || !data.handshake) return;
        ws.publish(data.roomId, message);
      } catch {}
    },
    close(ws) {
      try {
        const data = ws.data as WebSocketData;
        if (!data.roomId || !data.userId || !data.sessionId || !data.handshake) return;
        server.publish(
          data.roomId,
          JSON.stringify({
            e: EVENT_USER_DISCONNECTED,
            u: data.userId,
            s: data.sessionId,
            x: data.handshake,
          } as Metadata),
        );
      } catch {}
    },
  },
});

console.log(`Server ready at ${PORT}`);
