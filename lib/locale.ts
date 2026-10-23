// Country → main language and currency, used to translate the site and show amounts in local money.
// Shared by the server (location lookup) and the browser.

/** ISO country code → [Google Translate language code, ISO currency code]. */
export const COUNTRIES: Record<string, [string, string]> = {
  US: ["en", "USD"], CA: ["en", "CAD"], GB: ["en", "GBP"], IE: ["en", "EUR"], AU: ["en", "AUD"], NZ: ["en", "NZD"],
  NG: ["en", "NGN"], GH: ["en", "GHS"], KE: ["en", "KES"], ZA: ["en", "ZAR"], UG: ["en", "UGX"], TZ: ["sw", "TZS"],
  RW: ["en", "RWF"], ZM: ["en", "ZMW"], ZW: ["en", "USD"], BW: ["en", "BWP"], LR: ["en", "LRD"], SL: ["en", "SLE"],
  GM: ["en", "GMD"], CM: ["fr", "XAF"], SN: ["fr", "XOF"], CI: ["fr", "XOF"], BJ: ["fr", "XOF"], TG: ["fr", "XOF"],
  ML: ["fr", "XOF"], BF: ["fr", "XOF"], CD: ["fr", "CDF"], ET: ["am", "ETB"], EG: ["ar", "EGP"], MA: ["ar", "MAD"],
  DZ: ["ar", "DZD"], TN: ["ar", "TND"], SA: ["ar", "SAR"], AE: ["ar", "AED"], QA: ["ar", "QAR"], KW: ["ar", "KWD"],
  BH: ["ar", "BHD"], OM: ["ar", "OMR"], JO: ["ar", "JOD"], LB: ["ar", "LBP"], IL: ["iw", "ILS"], TR: ["tr", "TRY"],
  IN: ["hi", "INR"], PK: ["ur", "PKR"], BD: ["bn", "BDT"], LK: ["si", "LKR"], NP: ["ne", "NPR"], CN: ["zh-CN", "CNY"],
  HK: ["zh-TW", "HKD"], TW: ["zh-TW", "TWD"], JP: ["ja", "JPY"], KR: ["ko", "KRW"], SG: ["en", "SGD"], MY: ["ms", "MYR"],
  ID: ["id", "IDR"], PH: ["tl", "PHP"], TH: ["th", "THB"], VN: ["vi", "VND"], DE: ["de", "EUR"], AT: ["de", "EUR"],
  CH: ["de", "CHF"], FR: ["fr", "EUR"], BE: ["fr", "EUR"], LU: ["fr", "EUR"], NL: ["nl", "EUR"], ES: ["es", "EUR"],
  PT: ["pt", "EUR"], IT: ["it", "EUR"], GR: ["el", "EUR"], FI: ["fi", "EUR"], SE: ["sv", "SEK"], NO: ["no", "NOK"],
  DK: ["da", "DKK"], IS: ["is", "ISK"], PL: ["pl", "PLN"], CZ: ["cs", "CZK"], SK: ["sk", "EUR"], HU: ["hu", "HUF"],
  RO: ["ro", "RON"], BG: ["bg", "BGN"], HR: ["hr", "EUR"], RS: ["sr", "RSD"], SI: ["sl", "EUR"], UA: ["uk", "UAH"],
  RU: ["ru", "RUB"], MX: ["es", "MXN"], GT: ["es", "GTQ"], CO: ["es", "COP"], AR: ["es", "ARS"], CL: ["es", "CLP"],
  PE: ["es", "PEN"], VE: ["es", "VES"], EC: ["es", "USD"], DO: ["es", "DOP"], CR: ["es", "CRC"], PA: ["es", "PAB"],
  UY: ["es", "UYU"], PY: ["es", "PYG"], BO: ["es", "BOB"], HN: ["es", "HNL"], SV: ["es", "USD"], NI: ["es", "NIO"],
  PR: ["es", "USD"], BR: ["pt", "BRL"], AO: ["pt", "AOA"], MZ: ["pt", "MZN"], JM: ["en", "JMD"], TT: ["en", "TTD"],
  HT: ["fr", "HTG"],
};

/** Languages customers can pick by hand in Profile. "auto" follows their location. */
export const LANGUAGES: [string, string][] = [
  ["auto", "Automatic (based on location)"], ["en", "English"], ["es", "Español"], ["fr", "Français"], ["pt", "Português"],
  ["de", "Deutsch"], ["it", "Italiano"], ["nl", "Nederlands"], ["ar", "العربية"], ["hi", "हिन्दी"], ["zh-CN", "中文 (简体)"],
  ["ja", "日本語"], ["ko", "한국어"], ["tr", "Türkçe"], ["ru", "Русский"], ["sw", "Kiswahili"],
];

export interface VisitorLocale {
  country: string | null; // ISO code, or null if unknown
  language: string; // Google Translate code
  currency: string; // ISO code
  rate: number; // units of currency per 1 USD
  ratesDate: string | null;
}

export const DEFAULT_LOCALE: VisitorLocale = { country: null, language: "en", currency: "USD", rate: 1, ratesDate: null };

/** Device choices, kept in this browser only. */
export const LANG_KEY = "anchor-lang";
export const CURRENCY_KEY = "anchor-currency"; // "auto" | "USD"
