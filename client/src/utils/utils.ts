import * as cookie from "cookie";
import { Env } from "../constants/env.ts";

export const setCookie = (key: string, value: string) => {
  document.cookie = cookie.serialize(key, value, {
    sameSite: true,
    secure: true,
    domain: Env.WEBSOCKET_DOMAIN,
  });
};

export const getCookie = (key: string): string | undefined => {
  return cookie.parse(document.cookie)[key];
};

export const getOrSetCookie = (key: string, valueFn: () => string): string => {
  const result = getCookie(key);
  if (result) return result;
  const value = valueFn();
  setCookie(key, value);
  return value;
};

export const openWebSocket = (
  url: string | URL,
  opts: {
    onOpen?: (e: Event) => any;
    onMessage?: (e: MessageEvent) => any;
    onError?: (e: Event) => any;
    onClose?: (e: CloseEvent) => any;
  } = {},
) => {
  const socket = new WebSocket(url);
  if (opts.onOpen) {
    socket.addEventListener("open", opts.onOpen);
  }
  if (opts.onMessage) {
    socket.addEventListener("message", opts.onMessage);
  }
  if (opts.onError) {
    socket.addEventListener("error", opts.onError);
  }
  if (opts.onClose) {
    socket.addEventListener("close", opts.onClose);
  }
  return socket;
};
