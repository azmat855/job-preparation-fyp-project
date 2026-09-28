import { useEffect, useState } from "react"
import { RouterProvider } from "react-router"
import { router } from "./app.routes.jsx"
import { AuthProvider } from "./features/auth/auth.context.jsx"
import { InterviewProvider } from "./features/interview/interview.context.jsx"

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme")
    return savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark"
  })

  useEffect(() => {
    document.body.dataset.theme = theme
    localStorage.setItem("theme", theme)
  }, [theme])

  return (
    <AuthProvider>
      <InterviewProvider>
        <button
          type="button"
          className="global-theme-toggle"
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀️ White" : "🌙 Black"}
        </button>
        <RouterProvider router={router} />
      </InterviewProvider>
    </AuthProvider>
  )
}

export default App
