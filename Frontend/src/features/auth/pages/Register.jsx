import React,{useState} from 'react'
import { useNavigate, Link } from 'react-router'
import { useAuth } from '../hooks/useAuth'

const Register = () => {

    const navigate = useNavigate()
    const [ username, setUsername ] = useState("")
    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")
    const [ errorMessage, setErrorMessage ] = useState("")

    const {loading,handleRegister} = useAuth()
    
    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrorMessage("")

        const trimmedUsername = username.trim()
        const trimmedEmail = email.trim()
        const trimmedPassword = password.trim()

        if (!trimmedUsername || !trimmedEmail || !trimmedPassword) {
            setErrorMessage("Please fill in username, email, and password.")
            return
        }

        if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
            setErrorMessage("Please enter a valid email address.")
            return
        }

        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

        if (!strongPasswordRegex.test(trimmedPassword)) {
            setErrorMessage("Password must be at least 8 characters, include uppercase, lowercase, number, and special character.")
            return
        }

        try {
            const user = await handleRegister({ username: trimmedUsername, email: trimmedEmail, password: trimmedPassword })

            if (user) {
                navigate("/login", {
                    state: {
                        successMessage: "Registration successful! Please log in with your new account."
                    }
                })
            }
        } catch (err) {
            setErrorMessage(err.message || "Registration failed. Please try again.")
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
                    <h1>Creating your account...</h1>
                    <p>Please wait while we set up your profile.</p>
                </div>
            </main>
        )
    }

    return (
        <main>
            <div className="form-container">
                <h1>Register</h1>

                {errorMessage && <div className="form-message form-message--error">{errorMessage}</div>}

                <form onSubmit={handleSubmit}>

                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            value={username}
                            onChange={(e) => { setUsername(e.target.value) }}
                            type="text" id="username" name='username' placeholder='Enter username' />
                    </div>
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

                    <button className='button primary-button' >Register</button>

                </form>

                <p>Already have an account? <Link to={"/login"} >Login</Link> </p>
            </div>
        </main>
    )
}

export default Register