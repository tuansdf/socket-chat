import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import {
  EVENT_SEND_MESSAGE,
  EVENT_UPDATE_NAME,
  EVENT_USER_CONNECTED,
  EVENT_USER_DISCONNECTED,
  FRIENDLY_ID_LENGTH,
  ID_REGEX,
  METADATA_STRING_LENGTH,
  NON_CONTENT_BYTES_LENGTH,
  PASSWORD_REGEX,
  ROOM_ID_KEY,
  SERVER_METADATA_BYTES_LENGTH,
  USER_ID_KEY,
} from "../constants/common.constant.ts";
import { appendUint8Array, decryptToString, encryptString, generateId, generatePassword } from "../utils/crypto.js";
import { getOrSetCookie, openWebSocket, setCookie } from "../utils/utils.js";

const decoder = new TextDecoder();

type Metadata = {
  u?: string; // userId
  e?: number; // event
  m?: string; // message
  n?: string; // name
  s?: string; // sessionId
};

const toShortId = (id: string | undefined) => {
  return id?.substring(0, FRIENDLY_ID_LENGTH) || "";
};

const encryptMetadata = async (metadata: Metadata, password: string) => {
  return encryptString(JSON.stringify(metadata).padEnd(METADATA_STRING_LENGTH, " "), password, false);
};

export default function ChatPage() {
  const [names, setNames] = createSignal<Record<string, string>>({});
  const [name, setName] = createSignal<string>("");
  const [message, setMessage] = createSignal<string>("");
  const [messages, setMessages] = createSignal<{ userId?: string; content: string }[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ roomId: string }>();

  let messagesEl!: HTMLDivElement;
  let inputEl!: HTMLTextAreaElement;
  let formEl!: HTMLFormElement;
  let nameInputEl!: HTMLInputElement;

  let password = window.location.hash.substring(1);
  if (!password || !PASSWORD_REGEX.test(password)) {
    password = generatePassword();
    navigate(`${location.pathname}#${password}`, { replace: true });
  }
  const roomId = params.roomId;
  setCookie(ROOM_ID_KEY, roomId);
  const userId = getOrSetCookie(USER_ID_KEY, generateId);
  if (!ID_REGEX.test(roomId) || !ID_REGEX.test(userId)) {
    return navigate("/", { replace: true });
  }
  const socket = openWebSocket("ws://localhost:3000", {
    onOpen: () => handleSocketOpen(),
    onMessage: async (e) => {
      if (e.data instanceof Blob) {
        const temp = new Uint8Array(await e.data.arrayBuffer());
        await handleSocketMessage(temp);
      }
    },
  });

  const handleSocketOpen = () => {
    console.log("WebSocket Connected");
  };

  const handleSocketMessage = async (msg: Uint8Array) => {
    try {
      let metadata: Metadata = {};
      let content: string = "";
      const serverMetadata = JSON.parse(decoder.decode(msg.slice(-SERVER_METADATA_BYTES_LENGTH)).trim()) as Metadata;
      if (serverMetadata.e === EVENT_USER_CONNECTED) {
        return addMessage(`User ${toShortId(serverMetadata.u)} (${toShortId(serverMetadata.s)}) connected`);
      }
      if (serverMetadata.e === EVENT_USER_DISCONNECTED) {
        return addMessage(`User ${toShortId(serverMetadata.u)} (${toShortId(serverMetadata.s)}) disconnected`);
      }

      const metadataPm = decryptToString(
        msg.slice(-NON_CONTENT_BYTES_LENGTH, -SERVER_METADATA_BYTES_LENGTH),
        password,
        false,
      );
      const contentPm = decryptToString(
        msg.slice(0, msg.length > NON_CONTENT_BYTES_LENGTH ? msg.length - NON_CONTENT_BYTES_LENGTH : 0),
        password,
        true,
      );
      const promises = await Promise.all([metadataPm, contentPm]);
      if (!promises[0]) return;
      metadata = JSON.parse(promises[0]) as Metadata;
      content = promises[1];

      if (metadata.e === EVENT_UPDATE_NAME) {
        const userId = serverMetadata.u;
        const name = metadata.n;
        if (!userId || !name) return;
        setNames((prev) => ({ ...prev, [userId]: name }));
        addMessage(`User ${toShortId(userId)} updated their name to: ${name}`);
      }
      if (metadata.e === EVENT_SEND_MESSAGE) {
        return addMessage(content, serverMetadata.u);
      }
    } catch (e) {
    } finally {
      scrollToBottom();
    }
  };

  const addMessage = (msg: string, userId?: string) => {
    setMessages((prev) => [...prev, { userId, content: msg }]);
  };

  const handleSubmit = async () => {
    try {
      addMessage(message(), userId);
      const metadata: Metadata = { e: EVENT_SEND_MESSAGE };
      const contentPm = encryptString(message(), password, true);
      const metadataPm = encryptMetadata(metadata, password);
      const [encryptedContent, encryptedMetadata] = await Promise.all([contentPm, metadataPm]);
      if (encryptedContent.length && encryptedMetadata.length) {
        const combined = appendUint8Array(encryptedContent, encryptedMetadata);
        socket.send(combined);
        scrollToBottom();
      }
    } finally {
      setMessage("");
      inputEl.value = "";
    }
  };

  const handleNameSubmit = async () => {
    const targetName = name().trim();
    if (!targetName) return;
    const metadata: Metadata = { e: EVENT_UPDATE_NAME, n: targetName };
    const encryptedMetadata = await encryptMetadata(metadata, password);
    socket.send(encryptedMetadata);
    setNames((prev) => ({ ...prev, [userId]: targetName }));
    addMessage(`User ${toShortId(userId)} updated their name to: ${targetName}`);
    scrollToBottom();
  };

  const scrollToBottom = () => {
    messagesEl.scrollTo(0, messagesEl.scrollHeight);
  };

  const inviteLink = `${window.location.origin}/chat/${roomId}#${password}`;

  const handleInputKeyPress = async (event: KeyboardEvent) => {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      if (formEl.reportValidity()) {
        await handleSubmit();
      }
    }
  };
  onMount(() => {
    inputEl.addEventListener("keydown", handleInputKeyPress);
    const name = toShortId(userId);
    nameInputEl.value = name;
    setName(name);
  });
  onCleanup(() => {
    inputEl.removeEventListener("keydown", handleInputKeyPress);
  });

  return (
    <main class="chat-container">
      <A href="/" class="chat-header">
        <h2>Messages</h2>
      </A>
      <div class="chat-messages" ref={messagesEl}>
        <For each={messages()}>
          {(message) => (
            <div
              class="chat-message"
              style={{
                "align-items": !message.userId ? "center" : userId === message.userId ? "flex-end" : "flex-start",
              }}
            >
              <Show when={message.userId}>
                <div class="chat-user">{names()[message.userId!] || toShortId(message.userId)}</div>
              </Show>
              <div class={message.userId ? "chat-message-bubble" : undefined}>{message.content}</div>
            </div>
          )}
        </For>
      </div>

      <form
        ref={formEl}
        on:submit={async (e) => {
          e.preventDefault();
          await handleSubmit();
        }}
        class="chat-form"
      >
        <textarea
          ref={inputEl}
          rows={2}
          class="chat-input"
          required
          maxLength={5_000_000}
          value={message()}
          onInput={(e) => {
            setMessage(e.target.value || "");
          }}
        />
        <button type="submit" class="chat-submit">
          Submit
        </button>

        <div class="chat-link">
          <span>
            Invite other using this <a href={inviteLink}>link</a>
          </span>
        </div>
      </form>

      <div class="chat-sidebar">
        <h2>Update name</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await handleNameSubmit();
          }}
        >
          <input required onInput={(e) => setName(e.target.value)} ref={nameInputEl} />
          <button>Submit</button>
        </form>
      </div>
    </main>
  );
}
