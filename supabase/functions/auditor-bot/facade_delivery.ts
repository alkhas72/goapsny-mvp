import type { PlacesStore, StorageClient } from "./places.ts";
import type { TelegramClient } from "./types.ts";

export async function deliverGrayFacadePreview(
  places: PlacesStore,
  storage: StorageClient,
  telegram: TelegramClient,
  chatId: number,
  placeId: string,
  placeName: string,
): Promise<"sent" | "missing"> {
  const photo = await places.getFacadePhoto(placeId);
  if (!photo) return "missing";

  const signedUrl = await storage.getFacadeSignedUrl(photo.storage_path);
  if (!signedUrl) return "missing";

  await telegram.sendPhoto({
    chat_id: chatId,
    photo: signedUrl,
    caption: `Фасад: ${placeName}`,
  });
  return "sent";
}
