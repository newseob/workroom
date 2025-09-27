import { useEffect } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { supabase } from "./lib/supabaseClient"
import Room from "./pages/Room"

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
      {/* ✅ 전역 레이아웃 컨테이너 */}
      <div
        style={{
          width: "100%",
          maxWidth: "1500px",  // 좌우 폭 제한
          margin: "0 auto",   // 가운데 정렬
          minHeight: "100vh", // 세로 화면 채움
        }}
      >
        <Routes>
          <Route path="/" element={<Room />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
