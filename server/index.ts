import * as cookie from "cookie";

const FRIENDLY_USER_ID_LENGTH = 8;

type WebSocketData = {
  roomId?: string;
  userId?: string;
  sessionId?: string;
};

const PORT = process.env.PORT || 3000;

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const cookies = cookie.parse(req.headers.get("Cookie") || "");
    const roomId = cookies.roomId;
    const userId = cookies.userId;
    if (!roomId || !userId) {
      return new Response("Something Went Wrong", { status: 500 });
    }
    const sessionId = crypto.randomUUID();
    if (server.upgrade(req, { data: { roomId, userId, sessionId } })) {
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
        if (!data.roomId || !data.userId || !data.sessionId) return;
        ws.subscribe(data.roomId);
        server.publish(
          data.roomId,
          `User ${data.userId.substring(0, FRIENDLY_USER_ID_LENGTH)} (${data.sessionId.substring(0, FRIENDLY_USER_ID_LENGTH)}) connected`,
        );
      } catch {}
    },
    message(ws, message) {
      try {
        const data = ws.data as WebSocketData;
        if (!data.roomId || !data.userId || !data.sessionId) return;
        ws.publish(data.roomId, message);
      } catch {}
    },
    close(ws) {
      try {
        const data = ws.data as WebSocketData;
        if (!data.roomId || !data.userId || !data.sessionId) return;
        server.publish(
          data.roomId,
          `User ${data.userId.substring(0, FRIENDLY_USER_ID_LENGTH)} (${data.sessionId.substring(0, FRIENDLY_USER_ID_LENGTH)}) disconnected`,
        );
      } catch {}
    },
  },
});

console.log(`Server ready at ${PORT}`);
