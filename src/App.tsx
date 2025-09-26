import { useEffect } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { supabase } from "./lib/supabaseClient"
import Room from "./pages/Room"

export default function App() {
  useEffect(() => {
    const handleUnload = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const payload = JSON.stringify({ userId: user.id })
        navigator.sendBeacon("https://<project-ref>.functions.supabase.co/leave-room", payload)
      }
    }

    window.addEventListener("beforeunload", handleUnload)
    return () => window.removeEventListener("beforeunload", handleUnload)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Room />} />
      </Routes>
    </BrowserRouter>
  )
}
