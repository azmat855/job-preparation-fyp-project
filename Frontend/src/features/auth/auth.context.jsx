/* eslint-disable react-refresh/only-export-components */
import { createContext, useState } from "react";

const readStoredAuthToken = () => {
    if (typeof document === 'undefined') return null

    const cookieToken = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith('token='))

    if (cookieToken) {
        return decodeURIComponent(cookieToken.split('=').slice(1).join('='))
    }

    return localStorage.getItem('auth_token') || null
}

export const AuthContext = createContext()

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [token, setToken] = useState(() => readStoredAuthToken())

    const syncToken = () => {
        const nextToken = readStoredAuthToken()
        setToken(nextToken)

        if (nextToken) {
            localStorage.setItem('auth_token', nextToken)
        } else {
            localStorage.removeItem('auth_token')
        }
    }

    return (
        <AuthContext.Provider value={{ user, setUser, loading, setLoading, token, setToken, syncToken }} >
            {children}
        </AuthContext.Provider>
    )
}