import { FRIENDLY_ID_LENGTH } from "../constants/common.constant.ts";

export const toShortId = (id: string | undefined) => {
  return id?.substring(0, FRIENDLY_ID_LENGTH) || "";
};

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
