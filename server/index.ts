import * as cookie from "cookie";

const EVENT_USER_CONNECTED = 2;
const EVENT_USER_DISCONNECTED = 3;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

type WebSocketData = {
  roomId?: string;
  userId?: string;
  sessionId?: string;
};

type Metadata = {
  u?: string; // userId
  e?: number; // event
  m?: string; // message
  s?: string; // sessionId
};

const padUint8Array = (arr: Uint8Array, size: number, pad: number) => {
  if (arr.length >= size) return arr;
  let padded = new Uint8Array(size);
  padded.set(arr);
  padded.fill(pad, arr.length);
  return padded;
};

const appendUint8Array = (original: Uint8Array, toAppend: Uint8Array) => {
  const combined = new Uint8Array(original.length + toAppend.length);
  combined.set(original, 0);
  combined.set(toAppend, original.length);
  return combined;
};

const SERVER_METADATA_BYTES_LENGTH = 120;
const PORT = process.env.PORT || 3000;
const SPACE_ASCII_CODE = 32;

const createMetadata = (userId: string, sessionId: string, event?: number, message?: string) => {
  return padUint8Array(
    encoder.encode(
      JSON.stringify({
        e: event,
        u: userId,
        s: sessionId,
        m: message,
      } as Metadata),
    ),
    SERVER_METADATA_BYTES_LENGTH,
    SPACE_ASCII_CODE,
  );
};

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
        server.publish(data.roomId, createMetadata(data.userId, data.sessionId, EVENT_USER_CONNECTED));
      } catch {}
    },
    message(ws, message) {
      try {
        const data = ws.data as WebSocketData;
        if (!data.roomId || !data.userId || !data.sessionId) return;
        if (message instanceof Buffer) {
          message = Buffer.from(appendUint8Array(message, createMetadata(data.userId, data.sessionId)));
        }
        ws.publish(data.roomId, message);
      } catch {}
    },
    close(ws) {
      try {
        const data = ws.data as WebSocketData;
        if (!data.roomId || !data.userId || !data.sessionId) return;
        server.publish(data.roomId, createMetadata(data.userId, data.sessionId, EVENT_USER_DISCONNECTED));
        ws.close();
      } catch {}
    },
  },
});

console.log(`Server ready at ${PORT}`);
