import { DEFAULT_LANGUAGE } from './languages';
import { buildLanguageMessages } from './utils';

const messages = buildLanguageMessages();

type Language = keyof typeof messages;

const mainI18n = {
  global: {
    currentLocale: DEFAULT_LANGUAGE as Language,
    get locale() {
      return this.currentLocale;
    },
    set locale(value: Language) {
      this.currentLocale = value;
    },
    t(key: string) {
      const keys = key.split('.');
      let current: any = messages[this.currentLocale] ?? messages[DEFAULT_LANGUAGE as Language];
      if (current == null) {
        return key;
      }
      for (const k of keys) {
        if (current == null || current[k] === undefined) {
          return key;
        }
        current = current[k];
      }
      return current;
    },
    messages
  }
};

export type { Language };
export default mainI18n;
