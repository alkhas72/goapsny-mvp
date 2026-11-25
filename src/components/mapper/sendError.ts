import type { OutboxReason } from '../../services/mapper-outbox';
import { SubmitPlaceError, type SubmitPlaceErrorKind } from '../../services/submit-place';
import { FacadePhotoError } from '../../utils/photo';

/** Причина отказа человеческим языком; сырой текст сервера на экран не идёт. */
const SEND_ERROR: Partial<Record<SubmitPlaceErrorKind, string>> = {
  not_configured: 'Сервис недоступен. Попробуйте позже.',
  server_not_ready: 'Сервер пока не принимает объекты на проверку. Ничего не потеряно: оставьте экран открытым и повторите позже.',
  auth_required: 'Вход устарел. Закройте экран, войдите заново и отправьте ещё раз.',
  profile_required: 'Профиль не найден. Напишите администратору.',
  role_required: 'У этого профиля нет права добавлять объекты.',
  missing_photo: 'Не удалось загрузить фото. Проверьте связь и повторите.',
  photo_unreadable: 'Фото не сохранилось. Удалите объект и добавьте его заново.',
  facade_object_missing: 'Фото не дошло до сервера. Повторите отправку.',
  name_required: 'Вернитесь на шаг 2 и укажите название.',
  category_invalid: 'Вернитесь на шаг 2 и выберите категорию.',
  coordinates_invalid: 'Точка на карте не определилась. Поправьте пин и повторите.',
  card_invalid: 'Сервер не принял данные входа. Проверьте шаг 2 и повторите.',
};

const SEND_ERROR_DEFAULT = 'Не удалось отправить. Проверьте связь и повторите.';

export function sendErrorText(error: unknown): string {
  if (error instanceof FacadePhotoError) return error.message;
  if (error instanceof SubmitPlaceError) return SEND_ERROR[error.kind] ?? SEND_ERROR_DEFAULT;
  return SEND_ERROR_DEFAULT;
}

/** Почему объект ждёт отправки на устройстве и что будет дальше. */
export function keptText(reason: OutboxReason): string {
  if (reason === 'server_not_ready') {
    return 'Сервер пока не принимает объекты на проверку. Объект уйдёт сам, как только начнёт.';
  }
  if (reason === 'auth_required') {
    return 'Вход устарел. Войдите заново в кабинете, и объект уйдёт на проверку.';
  }
  if (reason === 'not_configured') {
    return 'Сервис сейчас недоступен. Объект уйдёт на проверку, когда он вернётся.';
  }
  if (reason === 'offline') {
    return 'Нет связи с сервером. Объект уйдёт на проверку сам, когда связь появится.';
  }
  if (reason === 'missing_photo' || reason === 'facade_object_missing') {
    return 'Фото не дошло до сервера. Объект уйдёт на проверку при следующей попытке.';
  }
  return 'Сервер не ответил. Объект уйдёт на проверку при следующей попытке.';
}

/** Короткая пометка в списке «Ждут отправки». */
export function waitingNote(reason: OutboxReason, blocked: boolean): string {
  if (blocked) return SEND_ERROR[reason as SubmitPlaceErrorKind] ?? 'Сервер не принял объект.';
  if (reason === 'server_not_ready') return 'сервер пока не принимает';
  if (reason === 'auth_required') return 'нужен вход';
  if (reason === 'missing_photo' || reason === 'facade_object_missing') return 'фото не дошло';
  if (reason === 'offline') return 'нет связи';
  return 'сервер не ответил';
}
