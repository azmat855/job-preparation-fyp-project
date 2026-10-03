import axios from "axios"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001"

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true
})

let getMeRequest = null

api.interceptors.request.use((config) => {
    const cookieToken = typeof document === "undefined"
        ? null
        : document.cookie
            .split(";")
            .map((entry) => entry.trim())
            .find((entry) => entry.startsWith("token="))
            ?.slice("token=".length)

    const token = cookieToken
        ? decodeURIComponent(cookieToken)
        : localStorage.getItem("auth_token")

    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }

    return config
})

export async function register({ username, email, password }) {
    try {
        const response = await api.post('/api/auth/register', {
            username, email, password
        })
        return response.data
    } catch (err) {
        // Throw error so frontend component can catch and show error message
        throw err.response?.data || err
    }
}

export async function login({ email, password }) {
    try {
        const response = await api.post("/api/auth/login", {
            email, password
        })
        return response.data
    } catch (err) {
        throw err.response?.data || err
    }
}

export async function logout() {
    try {
        const response = await api.get("/api/auth/logout")
        return response.data
    } catch (err) {
        throw err.response?.data || err
    }
}

export function getMe() {
    if (!getMeRequest) {
        getMeRequest = api.get("/api/auth/get-me")
            .then((response) => response.data)
            .catch((err) => {
                if (err.response?.status === 401) {
                    return null
                }
                throw err.response?.data || err
            })
            .finally(() => {
                getMeRequest = null
            })
    }

    return getMeRequest
}