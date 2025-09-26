import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

type Room = {
  id: string
  name: string
}

type RoomSelectProps = {
  onRoomSelected: (roomId: string) => void
}

export default function RoomSelect({ onRoomSelected }: RoomSelectProps) {
  const [recentRoom, setRecentRoom] = useState<Room | null>(null)
  const [favorites, setFavorites] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ 최근 접속 방 + 즐겨찾기 불러오기
  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true)

      // 1. 현재 로그인된 유저 확인
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // 2. users 테이블에서 last_room 가져오기
      const { data: userRow } = await supabase
        .from("users")
        .select("last_room")
        .eq("id", user.id)
        .single()

      if (userRow?.last_room) {
        const { data: roomData } = await supabase
          .from("rooms")
          .select("id,name")
          .eq("id", userRow.last_room)
          .single()
        setRecentRoom(roomData ?? null)
      }

      // 3. favorites 테이블에서 즐겨찾기 목록 가져오기
      const { data: favRows } = await supabase
        .from("favorites")
        .select("room_id, rooms(id,name)")
        .eq("user_id", user.id)

      if (favRows) {
        setFavorites(favRows.map((f: any) => f.rooms))
      }

      setLoading(false)
    }

    fetchRooms()
  }, [])

  if (loading) {
    return <div style={{ color: "#fff" }}>로딩 중...</div>
  }

  return (
    <div
      style={{
        color: "#fff",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem",
        padding: "1rem",
        width: "100%",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      {/* ✅ 최근 접속한 방 */}
      {recentRoom && (
        <div
          style={{
            background: "#1a1a1a",
            borderRadius: "8px",
            padding: "1.5rem",
            textAlign: "center",
            cursor: "pointer",
          }}
          onClick={() => onRoomSelected(recentRoom.id)}
        >
          <h3 style={{ margin: "0 0 0.5rem 0" }}>최근 접속한 방</h3>
          <p style={{ fontSize: "14px", color: "#aaa" }}>{recentRoom.name}</p>
        </div>
      )}

      {/* ✅ 즐겨찾기한 방들 */}
      {favorites.map((room) => (
        <div
          key={room.id}
          style={{
            background: "#262626",
            borderRadius: "8px",
            padding: "1.5rem",
            textAlign: "center",
            cursor: "pointer",
          }}
          onClick={() => onRoomSelected(room.id)}
        >
          <h3 style={{ margin: "0 0 0.5rem 0" }}>{room.name}</h3>
          <p style={{ fontSize: "14px", color: "#aaa" }}>즐겨찾은 방</p>
        </div>
      ))}

      {/* ✅ 방 생성 */}
      <div
        style={{
          background: "#333",
          borderRadius: "8px",
          padding: "1.5rem",
          textAlign: "center",
          cursor: "pointer",
          border: "2px dashed #666",
        }}
        onClick={() => alert("방 생성 로직 연결 예정")}
      >
        <h3 style={{ margin: "0 0 0.5rem 0", color: "#6d28d9" }}>＋ 방 생성</h3>
        <p style={{ fontSize: "14px", color: "#aaa" }}>새로운 작업방 만들기</p>
      </div>
    </div>
  )
}
