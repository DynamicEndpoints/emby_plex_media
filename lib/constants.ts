// Setting keys - shared between client and server
export const SETTINGS_KEYS = {
  PLEX_URL: "plex_url",
  PLEX_TOKEN: "plex_token",
  EMBY_URL: "emby_url",
  EMBY_API_KEY: "emby_api_key",
  XTREME_UI_URL: "xtreme_ui_url",
  XTREME_UI_API_KEY: "xtreme_ui_api_key",
  XTREME_UI_STREAM_BASE_URL: "xtreme_ui_stream_base_url", // Added for generating M3U links
  WEBHOOK_URL: "webhook_url",
  WEBHOOK_SECRET: "webhook_secret",
  SMTP_HOST: "smtp_host",
  SMTP_PORT: "smtp_port",
  SMTP_SECURE: "smtp_secure",
  SMTP_USER: "smtp_user",
  SMTP_PASS: "smtp_pass",
  EMAIL_FROM: "email_from",
  EMAIL_FROM_NAME: "email_from_name",
  DEFAULT_SERVER_TYPE: "default_server_type",
  DEFAULT_MAX_USES: "default_max_uses",
  REQUIRE_EMAIL_VERIFICATION: "require_email_verification",
  // Friend code settings
  FRIEND_CODES_ENABLED: "friend_codes_enabled",
  MAX_FRIEND_CODES_PER_USER: "max_friend_codes_per_user",
  REQUIRE_FRIEND_CODE_FOR_SIGNUP: "require_friend_code_for_signup",
  AUTO_LINK_ACCOUNTS: "auto_link_accounts", // Admin setting to enable/disable auto-linking
} as const;

export type SettingKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];
