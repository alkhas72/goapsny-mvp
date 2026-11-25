// Точка входа. На компьютере страница показывает витрину (корпус телефона, src/shell.js),
// а само приложение работает внутри неё; на телефоне и в прежних оболочках приложение запускается сразу.
// Режим мастера (?mode=wizard) запускает только «Новый замер», без конструктора: src/wizard.js.
if (document.documentElement.dataset.mode === "wizard") import("./wizard.js");
else if (document.documentElement.dataset.shell) import("./shell.js");
else import("./app.js");
