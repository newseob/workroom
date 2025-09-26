import { useEffect } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { supabase } from "./lib/supabaseClient"
import Room from "./pages/Room"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export default function App() {
  useEffect(() => {
    const handleUnload = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const url = `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&apikey=${SUPABASE_ANON_KEY}`
        const payload = JSON.stringify({ current_room: null })
        navigator.sendBeacon(url, payload)
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
