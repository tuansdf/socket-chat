import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { appendUint8Array, decryptToString, encryptString, generateId, generatePassword } from "../utils/crypto.js";
import { getOrSetCookie, openWebSocket, setCookie } from "../utils/utils.js";

const decoder = new TextDecoder();

const ROOM_ID_KEY = "roomId";
const USER_ID_KEY = "userId";
const FRIENDLY_USER_ID_LENGTH = 8;

const SERVER_METADATA_BYTES_LENGTH = 120;
const METADATA_STRING_LENGTH = 80;
const METADATA_BYTES_LENGTH = 120;

const EVENT_SEND_MESSAGE = 1;
const EVENT_USER_CONNECTED = 2;
const EVENT_USER_DISCONNECTED = 3;
const EVENT_UPDATE_NAME = 4;

type Metadata = {
  u?: string; // userId
  e?: number; // event
  m?: string; // message
  n?: string; // name
  s?: string; // sessionId
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
  if (!password) {
    password = generatePassword();
    navigate(`${location.pathname}#${password}`, { replace: true });
  }
  const roomId = params.roomId;
  setCookie(ROOM_ID_KEY, roomId);
  const userId = getOrSetCookie(USER_ID_KEY, generateId);
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
        return addMessage(
          `User ${serverMetadata.u?.substring(0, FRIENDLY_USER_ID_LENGTH)} (${serverMetadata.s?.substring(0, FRIENDLY_USER_ID_LENGTH)}) connected`,
        );
      }
      if (serverMetadata.e === EVENT_USER_DISCONNECTED) {
        return addMessage(
          `User ${serverMetadata.u?.substring(0, FRIENDLY_USER_ID_LENGTH)} (${serverMetadata.s?.substring(0, FRIENDLY_USER_ID_LENGTH)}) disconnected`,
        );
      }

      const metadataPm = decryptToString(
        msg.slice(-SERVER_METADATA_BYTES_LENGTH - METADATA_BYTES_LENGTH, -SERVER_METADATA_BYTES_LENGTH),
        password,
        false,
      );
      const contentPm = decryptToString(
        msg.slice(
          0,
          msg.length > METADATA_BYTES_LENGTH + SERVER_METADATA_BYTES_LENGTH
            ? msg.length - SERVER_METADATA_BYTES_LENGTH - METADATA_BYTES_LENGTH
            : 0,
        ),
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
        addMessage(`User ${userId.substring(0, FRIENDLY_USER_ID_LENGTH)} updated their name to: ${name}`);
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
      const metadata: Metadata = { u: userId, e: EVENT_SEND_MESSAGE };
      const contentPm = encryptString(message(), password, true);
      const metadataPm = encryptString(JSON.stringify(metadata).padEnd(METADATA_STRING_LENGTH, " "), password, false);
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
    addMessage(`User ${userId.substring(0, FRIENDLY_USER_ID_LENGTH)} updated their name to: ${targetName}`);
    setName("");
    nameInputEl.value = "";
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
                <div class="chat-user">
                  {names()[message.userId!] || message.userId?.substring(0, FRIENDLY_USER_ID_LENGTH)}
                </div>
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
