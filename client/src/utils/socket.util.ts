import {
  EVENT_SEND_MESSAGE,
  EVENT_USER_CONNECTED,
  EVENT_USER_DISCONNECTED,
  NON_CONTENT_BYTES_LENGTH,
  SERVER_METADATA_BYTES_LENGTH,
} from "../constants/common.constant.ts";
import { ChatEvent, Metadata } from "../types/common.type.ts";
import { decryptToString } from "../utils/crypto.util.ts";
import { toShortId } from "./common.util.ts";

const decoder = new TextDecoder();

export const openChatSocket = (
  url: string,
  password: string,
  opts: {
    onOpen?: (e: Event) => any;
    onMessage?: (e: ChatEvent) => any;
    onError?: (e: Event) => any;
    onClose?: (e: CloseEvent) => any;
  } = {},
) => {
  const socket = new WebSocket(url);
  if (opts.onOpen) {
    socket.addEventListener("open", opts.onOpen);
  }
  if (opts.onMessage) {
    socket.addEventListener("message", async (e) => {
      try {
        const isBlob = e.data instanceof Blob;
        if (!isBlob) return;
        const data = new Uint8Array(await e.data.arrayBuffer());
        const event = await handleChatSocketMessage(data, password);
        await opts.onMessage?.(event);
      } catch (e) {}
    });
  }
  if (opts.onError) {
    socket.addEventListener("error", opts.onError);
  }
  if (opts.onClose) {
    socket.addEventListener("close", opts.onClose);
  }
  return socket;
};

export const handleChatSocketMessage = async (msg: Uint8Array, password: string): Promise<ChatEvent> => {
  try {
    const server = JSON.parse(decoder.decode(msg.slice(-SERVER_METADATA_BYTES_LENGTH)).trim()) as Metadata;
    if (server.e === EVENT_USER_CONNECTED) {
      return { server, content: `User ${toShortId(server.u)} (${toShortId(server.s)}) connected` };
    }
    if (server.e === EVENT_USER_DISCONNECTED) {
      return { server, content: `User ${toShortId(server.u)} (${toShortId(server.s)}) disconnected` };
    }

    const client = JSON.parse(
      await decryptToString(msg.slice(-NON_CONTENT_BYTES_LENGTH, -SERVER_METADATA_BYTES_LENGTH), password, false),
    ) as Metadata;
    if (client.e === EVENT_SEND_MESSAGE) {
      const content = await decryptToString(
        msg.slice(0, msg.length > NON_CONTENT_BYTES_LENGTH ? msg.length - NON_CONTENT_BYTES_LENGTH : 0),
        password,
        true,
      );
      if (!client) return {};
      return { server, client, content };
    }
    return {};
  } catch (e) {
    return {};
  }
};
