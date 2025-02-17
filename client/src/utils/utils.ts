export const setStorage = (key: string, value: string) => {
  sessionStorage.setItem(key, value);
};

export const getStorage = (key: string): string | undefined | null => {
  return sessionStorage.getItem(key);
};

export const getOrSetStorage = (key: string, valueFn: () => string): string => {
  const result = getStorage(key);
  if (result) return result;
  const value = valueFn();
  setStorage(key, value);
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
