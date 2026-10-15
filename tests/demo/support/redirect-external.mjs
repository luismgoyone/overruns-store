// Preloaded into the demo app server with NODE_OPTIONS='--import <this file>'.
//
// Fails closed: every outgoing request to a host that isn't this machine is
// rewritten to the local mock server (DEMO_MOCK_URL) instead, so the demo run
// never reaches PayMongo, Resend or anything else outside this machine. The only
// exception is Google Fonts, which `next build` downloads for next/font.
//
// Two paths are covered: globalThis.fetch (the app, the Supabase and Resend clients)
// and http(s).request, in case a library uses it directly.

import http from 'node:http'
import https from 'node:https'

const MOCK = process.env.DEMO_MOCK_URL
if (!MOCK) throw new Error('redirect-external: DEMO_MOCK_URL is not set')
const mock = new URL(MOCK)

const LOCAL = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])
const PASS_THROUGH = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

const isExternal = (url) => !LOCAL.has(url.hostname) && !PASS_THROUGH.has(url.hostname)

// https://api.paymongo.com/v1/x → http://127.0.0.1:<port>/__ext/api.paymongo.com/v1/x
const toMock = (url) => new URL(`/__ext/${url.host}${url.pathname}${url.search}`, mock)

const originalFetch = globalThis.fetch
globalThis.fetch = function demoFetch(input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input))
  if (!isExternal(url)) return originalFetch(input, init)
  const target = toMock(url).toString()
  return input instanceof Request
    ? originalFetch(new Request(target, input), init)
    : originalFetch(target, init)
}

function wrap(mod, protocol) {
  const original = mod.request
  const redirected = function demoRequest(...args) {
    // Accepts (url, [options], [cb]) or (options, [cb]), like Node does.
    let url
    let options = {}
    if (typeof args[0] === 'string' || args[0] instanceof URL) {
      url = new URL(String(args[0]))
      if (args[1] && typeof args[1] === 'object') options = args[1]
    } else {
      options = args[0] ?? {}
      const host = options.hostname ?? options.host ?? 'localhost'
      url = new URL(`${protocol}//${host}${options.port ? `:${options.port}` : ''}${options.path ?? '/'}`)
    }
    if (!isExternal(url)) return original.apply(this, args)

    const cb = args.find((a) => typeof a === 'function')
    const path = options.path ?? `${url.pathname}${url.search}`
    const target = toMock(new URL(path, url))
    const rest = { ...options, path: `${target.pathname}${target.search}` }
    for (const key of ['agent', 'host', 'hostname', 'port', 'protocol']) delete rest[key]
    return http.request(target, rest, cb)
  }
  mod.request = redirected
  mod.get = (...args) => {
    const req = redirected(...args)
    req.end()
    return req
  }
}

wrap(https, 'https:')
wrap(http, 'http:')
