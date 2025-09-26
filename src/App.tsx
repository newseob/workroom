import { BrowserRouter, Routes, Route } from "react-router-dom"
import Room from "./pages/Room"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ✅ 메인 페이지: Room */}
        <Route path="/" element={<Room />} />
      </Routes>
    </BrowserRouter>
  )
}
