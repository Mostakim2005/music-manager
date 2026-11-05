const allLangModules = import.meta.glob('./lang/**/*.ts', { eager: true });

export const buildLanguageMessages = () => {
  const messages: Record<string, Record<string, any>> = {};

  Object.entries(allLangModules).forEach(([path, module]) => {
    const match = path.match(/\.\/lang\/([^/]+)\/([^/]+)\.ts$/);
    if (match) {
      const [, langCode, moduleName] = match;

      if (moduleName !== 'index') {
        if (!messages[langCode]) {
          messages[langCode] = {};
        }
        messages[langCode][moduleName] = (module as any).default;
      }
    }
  });

  return messages;
};

export const getSupportedLanguages = (): string[] => {
  const messages = buildLanguageMessages();
  return Object.keys(messages);
};

export const isLanguageSupported = (lang: string): boolean => {
  return getSupportedLanguages().includes(lang);
};

import { LANGUAGE_DISPLAY_NAMES, LANGUAGE_PRIORITY } from './languages';

export const getLanguageDisplayNames = (): Record<string, string> => {
  return LANGUAGE_DISPLAY_NAMES;
};

export const getLanguageOptions = () => {
  const supportedLanguages = getSupportedLanguages();
  const displayNames = getLanguageDisplayNames();

  const sortedLanguages = supportedLanguages.sort((a, b) => {
    const priorityA = LANGUAGE_PRIORITY[a] || 999;
    const priorityB = LANGUAGE_PRIORITY[b] || 999;
    return priorityA - priorityB;
  });

  return sortedLanguages.map((lang) => ({
    label: displayNames[lang] || lang,
    value: lang
  }));
};
