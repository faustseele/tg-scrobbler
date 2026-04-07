import en from "./en.js";
import ru from "./ru.js";
import ptBr from "./pt-br.js";

export type SupportedLanguage = "en" | "ru" | "pt-br";

/** maps a Telegram language_code to the closest supported dictionary */
function resolveDict(language: string): Record<string, string> {
  const normalized = language.toLowerCase();
  if (normalized === "ru") return ru;
  if (normalized === "pt" || normalized === "pt-br") return ptBr;
  return en;
}

/**
 * looks up `key` in the dictionary for `language`, falls back to English,
 * then substitutes `{variable}` placeholders with values from `vars`.
 * returns the key itself when it's missing from all dictionaries.
 */
export function t(
  key: string,
  language: string,
  vars?: Record<string, string>,
): string {
  const dict = resolveDict(language);
  let raw = dict[key] ?? en[key];

  if (raw === undefined) {
    console.warn(`i18n: missing key "${key}" in all dictionaries`);
    return key;
  }

  if (vars) {
    for (const [placeholder, value] of Object.entries(vars)) {
      raw = raw.replaceAll(`{${placeholder}}`, value);
    }
  }

  return raw;
}
