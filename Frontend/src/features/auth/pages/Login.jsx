import React,{useState} from 'react'
import { useNavigate, Link, useLocation } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'

const Login = () => {

    const { loading, handleLogin } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")
    const [ errorMessage, setErrorMessage ] = useState("")
    const [ successMessage, setSuccessMessage ] = useState(location.state?.successMessage || "")

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrorMessage("")
        setSuccessMessage("")

        const trimmedEmail = email.trim()
        const trimmedPassword = password.trim()

        if (!trimmedEmail || !trimmedPassword) {
            setErrorMessage("Please enter both email and password.")
            return
        }

        if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
            setErrorMessage("Please enter a valid email address.")
            return
        }

        try {
            const user = await handleLogin({ email: trimmedEmail, password: trimmedPassword })

            if (user) {
                navigate('/')
            }
        } catch (err) {
            setErrorMessage(err.message || "Login failed. Please try again.")
        }
    }

    if(loading){
        return (
            <main className='loading-screen'>
                <div className='loading-card'>
                    <div className='loading-spinner' />
                    <div className='loading-dots'>
                        <span />
                        <span />
                        <span />
                    </div>
                    <h1>Signing you in...</h1>
                    <p>Please wait while we prepare your dashboard.</p>
                </div>
            </main>
        )
    }


    return (
        <main>
            <div className="form-container">
                <h1>Login</h1>
                {successMessage && <div className="form-message form-message--success">{successMessage}</div>}
                {errorMessage && <div className="form-message form-message--error">{errorMessage}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            value={email}
                            onChange={(e) => { setEmail(e.target.value) }}
                            type="email" id="email" name='email' placeholder='Enter email address' />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            value={password}
                            onChange={(e) => { setPassword(e.target.value) }}
                            type="password" id="password" name='password' placeholder='Enter password' />
                    </div>
                    <button className='button primary-button' >Login</button>
                </form>
                <p>Don't have an account? <Link to={"/register"} >Register</Link> </p>
            </div>
        </main>
    )
}

export default Login