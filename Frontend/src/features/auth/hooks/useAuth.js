import { useContext, useEffect } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe } from "../services/auth.api";



export const useAuth = () => {

    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading, token, setToken, syncToken } = context


    const handleLogin = async ({ email, password }) => {
        setLoading(true)
        try {
            const data = await login({ email, password })
            const userData = data?.user ?? null
            setUser(userData)
            syncToken()
            return userData
        } catch (error) {
            console.warn('Login failed:', error)
            setUser(null)
            return null
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async ({ username, email, password }) => {
        setLoading(true)
        try {
            const data = await register({ username, email, password })
            const userData = data?.user ?? null
            setUser(userData)
            syncToken()
            return userData
        } catch (error) {
            console.warn('Registration failed:', error)
            setUser(null)
            return null
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        setLoading(true)
        try {
            await logout()
            return true
        } catch (error) {
            console.warn('Logout failed:', error)
            return false
        } finally {
            setUser(null)
            localStorage.removeItem('auth_token')
            setToken(null)
            setLoading(false)
        }
    }

    useEffect(() => {

        const getAndSetUser = async () => {
            if (!token) {
                setUser(null)
                setLoading(false)
                return
            }

            try {
                const data = await getMe()
                if (data?.user) {
                    setUser(data.user)
                } else {
                    setUser(null)
                    localStorage.removeItem('auth_token')
                    setToken(null)
                }
            } catch (error) {
                console.warn('Unable to fetch current user:', error)
                setUser(null)
            } finally {
                setLoading(false)
            }
        }

        getAndSetUser()

    }, [token, setLoading, setToken, setUser])

    return { user, token, loading, handleRegister, handleLogin, handleLogout }
}