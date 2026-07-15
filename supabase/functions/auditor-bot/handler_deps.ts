import type { PlacesStore, StorageClient } from "./places.ts";
import type { SessionStore } from "./session.ts";
import type { TelegramClient } from "./types.ts";

export type HandlerDeps = {
  places: PlacesStore;
  sessions: SessionStore;
  storage: StorageClient;
  telegram: TelegramClient;
  now?: () => Date;
};
