// Wrapper for the Telegram WebApp API

declare global {
  interface Window {
    Telegram?: {
      WebApp: any;
    };
  }
}

const isTelegram = () => typeof window !== "undefined" && !!window.Telegram?.WebApp?.initData;
const getWebApp = () => window.Telegram?.WebApp;

export const telegram = {
  isTelegram,

  // Get initData string for authentication
  getInitData(): string {
    if (isTelegram()) {
      return getWebApp().initData || "";
    }
    // Development mock initData
    return "query_id=AAH0...&user=%7B%22id%22%3A215263723%2C%22first_name%22%3A%22Alkhas%22%2C%22last_name%22%3A%22Thagushev%22%2C%22username%22%3A%22alkhas_abaza%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=1716942000&hash=mocked_hash";
  },

  // Get theme parameters
  getThemeParams() {
    if (isTelegram()) {
      return getWebApp().themeParams || {};
    }
    return {};
  },

  // Synchronize system colors / theme
  getTelegramTheme(): "dark" | "light" {
    if (isTelegram()) {
      return getWebApp().colorScheme === "dark" ? "dark" : "light";
    }
    // Browser fallback: check system prefers-color-scheme
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark"; // Default fallback
  },

  // Ready event
  ready() {
    if (isTelegram()) {
      getWebApp().ready();
    }
  },

  // Expand the app
  expand() {
    if (isTelegram()) {
      getWebApp().expand();
    }
  },

  // Haptics notification
  hapticNotify(type: "success" | "warning" | "error") {
    if (isTelegram()) {
      const wa = getWebApp();
      if (wa.HapticFeedback) {
        wa.HapticFeedback.notificationOccurred(type);
      }
    } else {
      console.log(`[Haptic Mock] Notification: ${type}`);
    }
  },

  // Haptics selection impact
  hapticSelection() {
    if (isTelegram()) {
      const wa = getWebApp();
      if (wa.HapticFeedback) {
        wa.HapticFeedback.selectionChanged();
      }
    }
  },

  // Native MainButton configuration
  setupMainButton(options: { text: string; color: string; textColor: string; isVisible: boolean; isActive: boolean }, onClick: () => void) {
    if (isTelegram()) {
      const wa = getWebApp();
      const mb = wa.MainButton;
      mb.setText(options.text);
      mb.setParams({
        color: options.color,
        text_color: options.textColor,
        is_visible: options.isVisible,
        is_active: options.isActive,
      });

      // Clear any previous listeners by recreating the handler
      mb.offClick();
      if (options.isVisible && options.isActive) {
        mb.onClick(onClick);
      }
    }
  },

  hideMainButton() {
    if (isTelegram()) {
      getWebApp().MainButton.hide();
    }
  },

  // Native BackButton configuration
  setupBackButton(isVisible: boolean, onClick: () => void) {
    if (isTelegram()) {
      const wa = getWebApp();
      const bb = wa.BackButton;
      if (isVisible) {
        bb.show();
        bb.offClick();
        bb.onClick(onClick);
      } else {
        bb.hide();
      }
    }
  },

  hideBackButton() {
    if (isTelegram()) {
      getWebApp().BackButton.hide();
    }
  },

  // Location Manager Wrapper
  async getUserLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolveRaw, rejectRaw) => {
      // Settle-once guard: Telegram may invoke a callback late (after we have
      // already fallen back) or not at all. Never resolve/reject twice.
      let settled = false;
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const resolve = (pos: { lat: number; lng: number }) => {
        if (settled) return;
        settled = true;
        if (watchdog) clearTimeout(watchdog);
        resolveRaw(pos);
      };
      const reject = (err: any) => {
        if (settled) return;
        settled = true;
        if (watchdog) clearTimeout(watchdog);
        rejectRaw(err);
      };
      const goFallback = () => this.fallbackHtml5Location(resolve, reject);

      // 1. Try Telegram LocationManager API (Mini Apps 2.0+)
      if (isTelegram()) {
        const wa = getWebApp();
        const lm = wa?.LocationManager;
        if (lm) {
          // Known iOS issue: LocationManager.init/getLocation can hang and
          // never invoke any callback, leaving the wizard stuck on
          // "Определение позиции...". The watchdog forces the HTML5 fallback.
          watchdog = setTimeout(() => {
            console.warn("Telegram LocationManager timed out; using HTML5 fallback");
            goFallback();
          }, 4500);

          const retrieveLocation = () => {
            try {
              lm.getLocation(
                { AllowHighAccuracy: true },
                (data: any) => {
                  if (data && data.Latitude && data.Longitude) {
                    resolve({ lat: data.Latitude, lng: data.Longitude });
                  } else {
                    goFallback();
                  }
                },
                (err: any) => {
                  console.error("Telegram LocationManager error", err);
                  goFallback();
                }
              );
            } catch (e) {
              console.error("Telegram LocationManager threw", e);
              goFallback();
            }
          };

          try {
            if (!lm.isInited) {
              lm.init((success: boolean) => {
                if (success && lm.isLocationAvailable) {
                  retrieveLocation();
                } else {
                  goFallback();
                }
              });
            } else if (lm.isLocationAvailable) {
              retrieveLocation();
            } else {
              goFallback();
            }
          } catch (e) {
            console.error("Telegram LocationManager init threw", e);
            goFallback();
          }
          return;
        }
      }

      // 2. Browser Fallback (PWA mode or Dev environment)
      goFallback();
    });
  },

  fallbackHtml5Location(resolve: (pos: { lat: number; lng: number }) => void, reject: (err: any) => void) {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
    } else {
      reject(new Error("Geolocation not supported by device/browser"));
    }
  },

  // Telegram alert utility
  alert(message: string, callback?: () => void) {
    if (isTelegram()) {
      getWebApp().showAlert(message, callback);
    } else {
      window.alert(message);
      if (callback) callback();
    }
  }
};
