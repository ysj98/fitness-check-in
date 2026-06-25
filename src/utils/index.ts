export type PageInstance = Page.PageInstance<AnyObject, object> & {
  $page: Page.PageInstance<AnyObject, object> & { fullPath: string }
}

export function getLastPage() {
  const pages = getCurrentPages()
  return pages[pages.length - 1] as PageInstance | undefined
}

export function currRoute() {
  const page = getLastPage()
  return page ? parseUrlToObj(page.$page.fullPath) : { path: '', query: {} }
}

export function parseUrlToObj(url: string) {
  const [path, queryString] = url.split('?')
  if (!queryString) {
    return { path, query: {} }
  }

  const query = Object.fromEntries(
    queryString.split('&').map((item) => {
      const [key, value = ''] = item.split('=')
      return [decodeURIComponent(key), decodeURIComponent(value)]
    }),
  )
  return { path, query }
}

export function getEnvBaseUrl() {
  const fallback = import.meta.env.VITE_SERVER_BASEURL
  try {
    const { envVersion } = uni.getAccountInfoSync().miniProgram
    const urls = {
      develop: import.meta.env.VITE_SERVER_BASEURL__WEIXIN_DEVELOP,
      trial: import.meta.env.VITE_SERVER_BASEURL__WEIXIN_TRIAL,
      release: import.meta.env.VITE_SERVER_BASEURL__WEIXIN_RELEASE,
    }
    return urls[envVersion] || fallback
  }
  catch {
    return fallback
  }
}
