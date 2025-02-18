export type Metadata = {
  u?: string; // userId
  e?: number; // event
  m?: string; // message
  n?: string; // name
  s?: string; // sessionId
  t?: number; // timestamp
};

export type ChatEvent = {
  server?: Metadata;
  client?: Metadata;
  content?: string;
};
