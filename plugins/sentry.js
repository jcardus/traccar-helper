import Vue from 'vue'
import * as Sentry from '@sentry/vue'

Sentry.init({
  Vue,
  dsn: 'https://788eef3b9f1b6cb9dd992cb55af6408b@o4506332630810624.ingest.sentry.io/4506332665741312',
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of the transactions
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0 // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
})
