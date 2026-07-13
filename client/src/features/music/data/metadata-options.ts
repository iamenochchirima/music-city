const countryCodes = [
  "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BT", "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "CF", "TD", "CL", "CN", "CO", "KM", "CG", "CD", "CR", "CI", "HR", "CU", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FJ", "FI", "FR", "GA", "GM", "GE", "DE", "GH", "GR", "GD", "GT", "GN", "GW", "GY", "HT", "HN", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR", "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PL", "PT", "QA", "RO", "RU", "RW", "KN", "LC", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB", "SO", "ZA", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY", "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR", "TM", "TV", "UG", "UA", "AE", "GB", "US", "UY", "UZ", "VU", "VA", "VE", "VN", "YE", "ZM", "ZW",
] as const;

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

export const countries = countryCodes
  .map((code) => countryNames.of(code))
  .filter((name): name is string => Boolean(name))
  .sort((first, second) => first.localeCompare(second));

export const musicGenres = [
  "Afrobeats", "Afro-fusion", "Amapiano", "Ambient", "Alternative", "Americana", "Arabic Pop", "Bachata", "Baile Funk", "Blues", "Bongo Flava", "Celtic", "Christian & Gospel", "Classical", "Comedy", "Contemporary R&B", "Country", "Dance", "Dancehall", "Deep House", "Disco", "Drum & Bass", "Dub", "Dubstep", "EDM", "Electronic", "Folk", "Funk", "Gqom", "Grime", "Hip-Hop", "House", "Indie", "Instrumental", "Jazz", "K-Pop", "Kwaito", "Latin", "Lo-fi", "Metal", "New Age", "Other", "Piano", "Pop", "Progressive House", "Punk", "R&B", "Reggae", "Reggaeton", "Rock", "Salsa", "Singer-Songwriter", "Soul", "Soundtrack", "Spoken Word", "Techno", "Traditional", "Trap", "World",
] as const;
