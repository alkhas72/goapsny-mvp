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
