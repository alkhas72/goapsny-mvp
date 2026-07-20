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

  // Get initData string for authentication.
  // Вне Telegram initData нет — возвращаем пустую строку. Поддельный
  // initData удалён (DG-3): auth-telegram обязан отклонять фальшивку,
  // а не пропускать её за реальный вход.
  getInitData(): string {
    if (isTelegram()) {
      return getWebApp().initData || "";
    }
    return "";
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
    return new Promise((resolve, reject) => {
      // 1. Try Telegram LocationManager API (Mini Apps 2.0+)
      if (isTelegram()) {
        const wa = getWebApp();
        const lm = wa.LocationManager;
        if (lm) {
          const retrieveLocation = () => {
            lm.getLocation(
              { AllowHighAccuracy: true },
              (data: any) => {
                if (data && data.Latitude && data.Longitude) {
                  resolve({ lat: data.Latitude, lng: data.Longitude });
                } else {
                  // Fallback to HTML5 Geolocation inside Telegram
                  this.fallbackHtml5Location(resolve, reject);
                }
              },
              (err: any) => {
                console.error("Telegram LocationManager error", err);
                this.fallbackHtml5Location(resolve, reject);
              }
            );
          };

          if (!lm.isInited) {
            lm.init((success: boolean) => {
              if (success && lm.isLocationAvailable) {
                retrieveLocation();
              } else {
                this.fallbackHtml5Location(resolve, reject);
              }
            });
          } else if (lm.isLocationAvailable) {
            retrieveLocation();
          } else {
            this.fallbackHtml5Location(resolve, reject);
          }
          return;
        }
      }

      // 2. Browser Fallback (PWA mode or Dev environment)
      this.fallbackHtml5Location(resolve, reject);
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
