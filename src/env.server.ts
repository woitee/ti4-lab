import { DISCORD_OAUTH_URLS } from "./discord/oauthUrls";
import { configuredPublicBaseUrl } from "./utils/publicBaseUrl.server";

declare global {
  var env: Env;
}

type Env = {
  baseUrl: string;
  discordOauthUrl: string;
};

export function initEnv() {
  global.env = {
    // PUBLIC_BASE_URL, or localhost when unset (see README).
    baseUrl: configuredPublicBaseUrl(),
    discordOauthUrl:
      process.env.NODE_ENV === "production"
        ? DISCORD_OAUTH_URLS.production
        : DISCORD_OAUTH_URLS.local,
  };
}
