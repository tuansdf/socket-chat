import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { QR } from "../components/qr.tsx";
import {
  EVENT_SEND_MESSAGE,
  ID_REGEX,
  METADATA_STRING_LENGTH,
  PASSWORD_REGEX,
  ROOM_ID_KEY,
  USER_ID_KEY,
} from "../constants/common.constant.ts";
import { ENV_WEBSOCKET_BASE_URL } from "../constants/env.ts";
import { ChatEvent, Metadata } from "../types/common.type.ts";
import { getOrSetStorage, setStorage, toShortId } from "../utils/common.util.ts";
import { appendUint8Array, encryptString, generateId, generatePassword } from "../utils/crypto.util.ts";
import { openChatSocket } from "../utils/socket.util.ts";

const encryptMetadata = async (metadata: Metadata, password: string) => {
  return encryptString(JSON.stringify(metadata).padEnd(METADATA_STRING_LENGTH, " "), password, false);
};

export default function ChatPage() {
  const [message, setMessage] = createSignal<string>("");
  const [messages, setMessages] = createSignal<{ userId?: string; content: string; timestamp: Date }[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ roomId: string }>();

  const [isDialogOpen, setIsDialogOpen] = createSignal<boolean>(true);
  const openDialog = () => setIsDialogOpen(true);
  const closeDialog = () => setIsDialogOpen(false);

  let messagesEl!: HTMLDivElement;
  let inputEl!: HTMLTextAreaElement;
  let formEl!: HTMLFormElement;

  let password = window.location.hash.substring(1);
  if (!password || !PASSWORD_REGEX.test(password)) {
    password = generatePassword();
    navigate(`${location.pathname}#${password}`, { replace: true });
  }
  const roomId = params.roomId;
  setStorage(ROOM_ID_KEY, roomId);
  const userId = getOrSetStorage(USER_ID_KEY, generateId);
  if (!ID_REGEX.test(roomId) || !ID_REGEX.test(userId)) {
    navigate("/", { replace: true });
    return <></>;
  }

  const handleSocketMessage = async (e: ChatEvent) => {
    try {
      if (e.content && e.server?.t) {
        addMessage(e.content, new Date(e.server.t), e.client?.e === EVENT_SEND_MESSAGE ? e.server?.u : undefined);
      }
    } catch (e) {
    } finally {
      scrollToBottom();
    }
  };

  const handleSocketOpen = () => {
    console.log("WebSocket Connected");
  };

  const socket = openChatSocket(
    `${ENV_WEBSOCKET_BASE_URL}?${ROOM_ID_KEY}=${roomId}&${USER_ID_KEY}=${userId}`,
    password,
    {
      onOpen: handleSocketOpen,
      onMessage: handleSocketMessage,
    },
  );

  const addMessage = (msg: string, timestamp: Date, userId?: string) => {
    setMessages((prev) => [...prev, { userId, content: msg, timestamp }]);
  };

  const handleSubmit = async () => {
    try {
      addMessage(message(), new Date(), userId);
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
    <>
      <main class="chat-container">
        <div class="chat-header">
          <A href="/">
            <h2>Messages</h2>
          </A>

          <button class="outline contrast" onClick={openDialog}>
            Invite
          </button>
        </div>
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
                    <Show when={message.timestamp}>
                      <span>{message.timestamp.toLocaleString()} - </span>
                    </Show>
                    <span>{toShortId(message.userId)}</span>
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
        </form>
      </main>

      <dialog open={isDialogOpen()} class="dialog">
        <article>
          <h2>Invite others</h2>
          <p class="chat-link">
            Share this link: <a href={inviteLink}>{inviteLink}</a>
          </p>
          <p class="qr-label">Or scan this QR:</p>
          <QR content={inviteLink} />
          <div class="buttons">
            <button type="button" onClick={closeDialog}>
              OK
            </button>
          </div>
        </article>
      </dialog>
    </>
  );
}
