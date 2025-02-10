import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { appendUint8Array, decryptToString, encryptString, generateId, generatePassword } from "../utils/crypto.js";
import { getCookie, openWebSocket, setCookie } from "../utils/utils.js";

const ROOM_ID_KEY = "roomId";
const USER_ID_KEY = "userId";
const FRIENDLY_USER_ID_LENGTH = 8;

const METADATA_STRING_LENGTH = 80;
const METADATA_BYTES_LENGTH = 120;

const EVENT_SEND_MESSAGE = "01";

type Metadata = {
  u?: string;
  e?: string;
};

export default function ChatPage() {
  const [message, setMessage] = createSignal<string>("");
  const [messages, setMessages] = createSignal<{ userId?: string; content: string }[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ roomId: string }>();

  let messagesEl!: HTMLDivElement;
  let inputEl!: HTMLTextAreaElement;
  let formEl!: HTMLFormElement;

  let password = window.location.hash.substring(1);
  if (!password) {
    password = generatePassword();
    navigate(`${location.pathname}#${password}`, { replace: true });
  }
  let roomId = params.roomId;
  setCookie(ROOM_ID_KEY, roomId);
  let userId = getCookie(USER_ID_KEY);
  if (!userId) {
    userId = generateId();
    setCookie(USER_ID_KEY, userId);
  }
  const socket = openWebSocket("ws://localhost:3000", {
    onOpen: () => handleSocketOpen(),
    onMessage: async (e) => {
      if (typeof e.data === "string") {
        await handleSocketMessage(e.data);
      } else if (e.data instanceof Blob) {
        const temp = new Uint8Array(await e.data.arrayBuffer());
        await handleSocketMessage(temp);
      }
    },
  });

  const handleSocketOpen = () => {
    console.log("WebSocket Connected");
  };

  const handleSocketMessage = async (msg: string | Uint8Array) => {
    try {
      if (typeof msg === "string") {
        return addMessage(msg);
      }
      const metadataPm = decryptToString(msg.slice(-METADATA_BYTES_LENGTH), password, false);
      const contentPm = decryptToString(msg.slice(0, msg.length - METADATA_BYTES_LENGTH), password, true);
      const [metadataStr, content] = await Promise.all([metadataPm, contentPm]);
      if (!content || !metadataStr) return;
      const metadata = JSON.parse(metadataStr) as Metadata;
      if (metadata.e === EVENT_SEND_MESSAGE) {
        addMessage(content, metadata.u);
      }
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

  const scrollToBottom = () => {
    messagesEl.scrollTo(0, messagesEl.scrollHeight);
  };

  const inviteLink = `${window.location.origin}?roomId=${roomId}#${password}`;

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
      <A href="/">
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
                <div class="chat-user">{message.userId?.substring(0, FRIENDLY_USER_ID_LENGTH)}</div>
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
    </main>
  );
}
