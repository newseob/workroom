import { useEffect } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { supabase } from "./lib/supabaseClient"
import Room from "./pages/Room"
import VideoOverlay from "./pages/VideoOverlay"

export default function App() {
  useEffect(() => {
    const handleUnload = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from("users")
          .update({ current_room: null })
          .eq("id", user.id)
      }
    }

    window.addEventListener("beforeunload", handleUnload)
    return () => window.removeEventListener("beforeunload", handleUnload)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Room />} />
        <Route path="/video" element={<VideoOverlay />} />
      </Routes>
    </BrowserRouter>
  )
}
