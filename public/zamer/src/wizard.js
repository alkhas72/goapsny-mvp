// Режим мастера: только «Новый замер», без конструктора (адрес ?mode=wizard).
// Этим путём мастер открывается внутри карты GoApsny (?embed=1): человек измеряет вход и отправляет заявку,
// рабочее место мастерской (3D, чертёж, раскрой) остаётся в обычном режиме приложения.
// three.js при старте не грузится: он нужен только показу «Как мерить» и подгружается по его открытию.
// Примерка в дополненной реальности открывается отдельной вкладкой (ar.html), как и раньше.
import { createIntake } from "./intake.js";
import { createExport } from "./export.js";
import { createRampsSource } from "./ramps-source.js";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js";
const d = document.documentElement;
const EMBED = d.dataset.embed === "1" && window.parent !== window;
const EXP = createExport(), GEO = createRampsSource();

// three.js одним запросом и один раз; при сбое показ сам скажет, что не открылся
let three = null;
export function loadThree(doc = document, win = window) {
  if (win.THREE) return Promise.resolve(win.THREE);
  if (three) return three;
  three = new Promise((resolve, reject) => {
    const s = doc.createElement("script");
    s.src = THREE_URL; s.async = true;
    s.onload = () => (win.THREE ? resolve(win.THREE) : reject(new Error("three")));
    s.onerror = () => { three = null; s.remove(); reject(new Error("three")); };
    doc.head.appendChild(s);
  });
  return three;
}

// Сообщения карте: только своему адресу. ready — мастер открыт; close — человек закрыл мастер.
const tell = (type, extra) => { if (EMBED) try { window.parent.postMessage({ stopgap: type, ...extra }, location.origin); } catch {} };

let pf = null;
try { pf = GEO.prefillFromQuery(location.search, { origin: location.origin }); } catch {}
const back = (() => { try { return GEO.safeReturn(pf && pf.returnUrl, location.origin); } catch { return null; } })();

const root = document.getElementById("app");
root.classList.add("is-wizard");
const intake = createIntake().mount(root, {
  exitTo: "map",
  save: (name, data) => EXP.save(name, data),
  loadThree: () => loadThree(),
  onOpen() { tell("ready"); },
  // Закрытие мастера: внутри карты — сказать карте; отдельной страницей — вернуться на карту
  onClose() {
    if (EMBED) return tell("close");
    try { location.assign(back || new URL("../", location.href).toString()); } catch {}
  },
});
intake.open(pf || undefined);
