import * as Sentry from "@sentry/react";

const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.captureConsoleIntegration({ levels: ["error"] }),
    ],
    tracesSampleRate: 0.2,
    environment: process.env.NODE_ENV || "development",
    release: process.env.REACT_APP_VERSION || "chess99@unknown",
    beforeSend(event) {
      // Drop events from browser extensions and non-chess99 origins
      if (event.request?.url && !event.request.url.includes("chess99.com") && !event.request.url.includes("localhost")) {
        return null;
      }
      return event;
    },
  });
}

export default Sentry;
