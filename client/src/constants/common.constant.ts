export const ROOM_ID_KEY = "roomId";
export const USER_ID_KEY = "userId";
export const FRIENDLY_ID_LENGTH = 8;

export const SERVER_METADATA_BYTES_LENGTH = 120;
export const METADATA_STRING_LENGTH = 80;
export const METADATA_BYTES_LENGTH = 120;
export const NON_CONTENT_BYTES_LENGTH = METADATA_BYTES_LENGTH + SERVER_METADATA_BYTES_LENGTH;

export const EVENT_SEND_MESSAGE = 1;
export const EVENT_USER_CONNECTED = 2;
export const EVENT_USER_DISCONNECTED = 3;
export const EVENT_UPDATE_NAME = 4;

export const ID_BYTES_LENGTH = 16;
export const ID_STRING_LENGTH = 32;
export const PASSWORD_BYTES_LENGTH = 32;
export const PASSWORD_STRING_LENGTH = 64;

export const ID_REGEX = /^[a-fA-F0-9]{32}$/;
export const PASSWORD_REGEX = /^[a-fA-F0-9]{64}$/;
