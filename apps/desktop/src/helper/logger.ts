type LogArgs = unknown[]

// Vite injects import.meta.env.DEV at build time. In production builds this is
// false, so debug/info logs (some of which serialize large objects / whole file
// contents) are stripped from the hot path entirely.
function isDev() {
  return import.meta.env.DEV
}

export const logger = {
  debug: (...args: LogArgs) => {
    if (isDev()) console.debug(...args)
  },
  info: (...args: LogArgs) => {
    if (isDev()) console.log(...args)
  },
  warn: (...args: LogArgs) => {
    console.warn(...args)
  },
  error: (...args: LogArgs) => {
    console.error(...args)
  },
}
