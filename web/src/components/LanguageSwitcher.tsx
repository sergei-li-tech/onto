import { LANGS, setLang, useLang, useT } from "../i18n";

/**
 * English / Русский / 한국어 switcher. Labels are native language names and are
 * never translated; the selected language is applied instantly.
 */
export function LanguageSwitcher({ variant = "bar" }: { variant?: "bar" | "screen" }) {
  const lang = useLang();
  const t = useT();

  return (
    <div
      className={`lang-switch lang-switch-${variant}`}
      role="group"
      aria-label={t("lang.label")}
    >
      {LANGS.map((item) => (
        <button
          key={item.id}
          type="button"
          lang={item.id}
          aria-pressed={lang === item.id}
          onClick={() => setLang(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
