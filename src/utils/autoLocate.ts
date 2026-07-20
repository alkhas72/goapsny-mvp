/**
 * Нужно ли показывать местоположение сразу при открытии карты.
 *
 * Требование Арбитра (20.07): свою точку должен видеть любой посетитель,
 * независимо от роли — просто смотрящий, автор серой метки или картограф.
 * Это первое, что человек ищет, открыв карту.
 *
 * Единственное исключение — тот, кто уже отказал в доступе: повторно
 * донимать его системным диалогом нельзя.
 */
export async function shouldAutoLocate(nav: Navigator = navigator): Promise<boolean> {
  const permissions = nav.permissions;
  if (!permissions?.query) {
    // Браузер не умеет сообщать состояние доступа (долго так вёл себя Safari) —
    // пробуем определить; при отказе просто ничего не покажем.
    return true;
  }

  try {
    const status = await permissions.query({ name: 'geolocation' as PermissionName });
    return status.state !== 'denied';
  } catch {
    // Состояние недоступно — ведём себя так же, как без Permissions API.
    return true;
  }
}
