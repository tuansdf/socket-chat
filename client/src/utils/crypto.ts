import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from "@noble/ciphers/utils";
import { managedNonce, randomBytes } from "@noble/ciphers/webcrypto";
import Pako from "pako";
import { ID_BYTES_LENGTH, PASSWORD_BYTES_LENGTH } from "../constants/common.constant.ts";

const getEncryptionFn = managedNonce(xchacha20poly1305);

export const encryptString = async (
  contentStr: string,
  passwordHex: string,
  withCompress: boolean = true,
): Promise<Uint8Array> => {
  try {
    let content = utf8ToBytes(contentStr);
    if (withCompress) {
      const temp = compress(content);
      if (temp) content = temp;
    }
    return encrypt(content, passwordHex);
  } catch (e) {
    return new Uint8Array(0);
  }
};

export const decryptToString = async (
  contentBytes: Uint8Array,
  passwordHex: string,
  withCompress: boolean = true,
): Promise<string> => {
  try {
    const decrypted = await decrypt(contentBytes, passwordHex);
    if (!decrypted) return "";
    if (withCompress) {
      return decompressToString(decrypted);
    }
    return bytesToUtf8(decrypted);
  } catch (e) {
    return "";
  }
};

export const encrypt = async (contentBytes: Uint8Array, passwordHex: string): Promise<Uint8Array> => {
  try {
    if (contentBytes.length === 0) return new Uint8Array(0);
    const password = hexToBytes(passwordHex);
    const cipher = getEncryptionFn(password);
    return cipher.encrypt(contentBytes);
  } catch (e) {
    return new Uint8Array(0);
  }
};

export const decrypt = async (contentBytes: Uint8Array, passwordHex: string): Promise<Uint8Array> => {
  try {
    if (contentBytes.length === 0) return new Uint8Array(0);
    const password = hexToBytes(passwordHex);
    const cipher = getEncryptionFn(password);
    return cipher.decrypt(contentBytes);
  } catch (e) {
    return new Uint8Array(0);
  }
};

export const compress = (data: Uint8Array): Uint8Array => {
  try {
    return Pako.deflate(data);
  } catch {
    return new Uint8Array(0);
  }
};

export const decompress = (data: Uint8Array): Uint8Array => {
  try {
    return Pako.inflate(data);
  } catch {
    return new Uint8Array(0);
  }
};

export const decompressToString = (data: Uint8Array) => {
  try {
    return Pako.inflate(data, { to: "string" });
  } catch {
    return "";
  }
};

export const generatePassword = () => {
  return bytesToHex(randomBytes(PASSWORD_BYTES_LENGTH));
};

export const generateId = () => {
  return bytesToHex(randomBytes(ID_BYTES_LENGTH));
};

export const appendUint8Array = (originalArray: Uint8Array, appendArray: Uint8Array) => {
  const combined = new Uint8Array(originalArray.length + appendArray.length);
  combined.set(originalArray, 0);
  combined.set(appendArray, originalArray.length);
  return combined;
};
