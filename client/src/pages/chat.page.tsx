import { Modal } from "@/components/modal.tsx";
import { cn } from "@/utils/classnames.ts";
import { A, useLocation, useNavigate, useParams } from "@solidjs/router";
import dayjs from "dayjs";
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
import { getOrSetStorage, toShortId } from "../utils/common.util.ts";
import { appendUint8Array, encryptString, generateId, generatePassword } from "../utils/crypto.util.ts";
import { openChatSocket } from "../utils/socket.util.ts";

const FORMAT_DATE = "DD/MM/YYYY HH:mm:ss";
const MAX_CONTENT_LENGTH = 5_000_000;

const encryptMetadata = async (metadata: Metadata, password: string) => {
  return encryptString(JSON.stringify(metadata).padEnd(METADATA_STRING_LENGTH, " "), password, false);
};

export default function ChatPage() {
  const [isModalOpen, setIsModalOpen] = createSignal<boolean>(true);
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const [isConnected, setIsConnected] = createSignal<boolean>(false);
  const [message, setMessage] = createSignal<string>("");
  const [messages, setMessages] = createSignal<{ userId?: string; content: string; timestamp: Date }[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ roomId: string }>();

  let messagesEl!: HTMLDivElement;
  let inputEl!: HTMLTextAreaElement;
  let formEl!: HTMLFormElement;

  let password = window.location.hash.substring(1);
  if (!password || !PASSWORD_REGEX.test(password)) {
    password = generatePassword();
    navigate(`${location.pathname}#${password}`, { replace: true });
  }
  const roomId = params.roomId;
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
    setIsConnected(true);
  };

  const handleSocketClose = () => {
    console.log("WebSocket Disconnected");
    setIsConnected(false);
  };

  const openSocket = () => {
    return openChatSocket(`${ENV_WEBSOCKET_BASE_URL}?${ROOM_ID_KEY}=${roomId}&${USER_ID_KEY}=${userId}`, password, {
      onOpen: handleSocketOpen,
      onClose: handleSocketClose,
      onMessage: handleSocketMessage,
    });
  };

  let socket = openSocket();

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
      <main class="d-flex flex-column h-100 py-3">
        <div class="d-flex justify-content-between align-items-center px-3">
          <A href="/">
            <h1 class="fs-3 fw-bold">Messages</h1>
          </A>

          <div class="d-flex align-items-center gap-2">
            <Show when={!isConnected()}>
              <div>You are disconnected</div>
              <button class="btn btn-outline-light" onClick={() => (socket = openSocket())}>
                Reconnect
              </button>
            </Show>
            <Show when={isConnected()}>
              <button class="btn btn-outline-light" onClick={openModal}>
                Invite
              </button>
            </Show>
          </div>
        </div>
        <div class="flex-grow-1 overflow-y-auto overflow-x-hidden px-3" ref={messagesEl}>
          <For each={messages()}>
            {(message) => (
              <div
                class={cn(
                  "d-flex flex-column mt-3 text-secondary-emphasis",
                  !message.userId
                    ? "align-items-center"
                    : userId === message.userId
                      ? "align-items-end"
                      : "align-items-start",
                )}
              >
                <Show when={message.userId}>
                  <div class="mb-2 fs-small">
                    <Show when={userId !== message.userId}>
                      <span>{toShortId(message.userId)} - </span>
                    </Show>
                    <Show when={message.timestamp}>
                      <span>{dayjs(message.timestamp).format(FORMAT_DATE)}</span>
                    </Show>
                  </div>
                </Show>
                <div class={message.userId ? "chat-message-bubble text-break-all" : undefined}>{message.content}</div>
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
          class="px-3"
        >
          <textarea
            ref={inputEl}
            rows={2}
            class="form-control mb-3 mt-3"
            required
            maxLength={MAX_CONTENT_LENGTH}
            value={message()}
            onInput={(e) => {
              setMessage(e.target.value || "");
            }}
          />
          <button type="submit" class="btn btn-primary w-100">
            Submit
          </button>
        </form>
      </main>

      <Modal isOpen={isModalOpen()} onClose={closeModal} title="Invite others">
        <p>
          <span class="d-block mb-1">Share this link:</span>
          <a class="text-break-all" href={inviteLink}>
            {inviteLink}
          </a>
        </p>
        <p class="mb-2">Or scan this QR:</p>
        <QR content={inviteLink} />
      </Modal>
    </>
  );
}
