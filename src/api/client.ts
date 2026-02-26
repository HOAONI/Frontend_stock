import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/'
const timeout = Number(import.meta.env.VITE_API_TIMEOUT || '30000')

const client = axios.create({
  baseURL,
  timeout,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.response.use(
  response => response,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      const current = `${window.location.pathname}${window.location.search}`
      const redirect = encodeURIComponent(current)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign(`/login?redirect=${redirect}`)
      }
    }
    return Promise.reject(error)
  },
)

export default client
