import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

type Room = {
  id: string
  name: string
  memberCount: number
}

type RoomSelectProps = {
  onRoomSelected: (roomId: string) => void
}

export default function RoomSelect({ onRoomSelected }: RoomSelectProps) {
  const [recentRoom, setRecentRoom] = useState<Room | null>(null)
  const [favorites, setFavorites] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState("") // ✅ 방 코드 입력 상태

  // ✅ 방 코드 생성
  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code = ""
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  // ✅ 새 방 생성
  const handleCreateRoom = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("로그인이 필요합니다.")
      return
    }

    const newRoomId = generateRoomCode()

    const { error: roomError } = await supabase.from("rooms").insert({
      id: newRoomId,
      name: "새 방",
      owner: user.id,
    })
    if (roomError) {
      console.error("방 생성 오류:", roomError)
      alert("방 생성 실패")
      return
    }

    await supabase
      .from("users")
      .update({
        last_room: newRoomId,
      })
      .eq("id", user.id)

    onRoomSelected(newRoomId)
  }

  // ✅ 방 입장 (입력한 코드로)
  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      alert("방 코드를 입력하세요.")
      return
    }

    const { data: roomData } = await supabase
      .from("rooms")
      .select("id")
      .eq("id", joinCode.trim().toUpperCase())
      .maybeSingle()

    if (!roomData) {
      alert("존재하지 않는 방 코드입니다.")
      return
    }

    onRoomSelected(roomData.id)
  }

  // ✅ 방 정보 + 인원수 조회
  const getRoomWithCount = async (roomId: string) => {
    const { data: roomData } = await supabase
      .from("rooms")
      .select("id,name")
      .eq("id", roomId)
      .single()

    if (!roomData) return null

    const { count } = await supabase
      .from("participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)

    return {
      ...roomData,
      memberCount: count ?? 0,
    }
  }

  // ✅ 최근방 + 즐겨찾기 불러오기
  useEffect(() => {
    const fetchRooms = async () => {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // 최근 접속 방
      const { data: userRow } = await supabase
        .from("users")
        .select("last_room")
        .eq("id", user.id)
        .single()

      if (userRow?.last_room) {
        const roomInfo = await getRoomWithCount(userRow.last_room)
        setRecentRoom(roomInfo)
      }

      // 즐겨찾기 방
      const { data: favRows } = await supabase
        .from("favorites")
        .select("room_id")
        .eq("user_id", user.id)

      if (favRows) {
        const favRooms: Room[] = []
        for (const f of favRows) {
          const { data: roomData } = await supabase
            .from("rooms")
            .select("id,name")
            .eq("id", f.room_id)
            .single()

          if (roomData) {
            const { count } = await supabase
              .from("participants")
              .select("*", { count: "exact", head: true })
              .eq("room_id", f.room_id)

            favRooms.push({ ...roomData, memberCount: count ?? 0 })
          }
        }
        setFavorites(favRooms)
      }

      setLoading(false)
    }

    fetchRooms()

    // ✅ Realtime 구독: 방 이름/인원 갱신
    const channel = supabase
      .channel("room-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => fetchRooms())
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => fetchRooms())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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
            background: "#1e3a8a",
            borderRadius: "8px",
            padding: "1.5rem",
            textAlign: "left",
            cursor: "pointer",
          }}
          onClick={() => onRoomSelected(recentRoom.id)}
        >
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            최근 접속한 방
          </div>
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>
            {recentRoom.name}
          </div>
          <div style={{ fontSize: "13px", color: "#aaa" }}>
            코드: {recentRoom.id}
          </div>
          <div style={{ fontSize: "13px", color: "#aaa" }}>
            인원: {recentRoom.memberCount}/12
          </div>
        </div>
      )}

      {/* ✅ 즐겨찾기한 방들 */}
      {favorites.map((room, idx) => (
        <div
          key={room.id}
          style={{
            background: "#333",
            borderRadius: "8px",
            padding: "1.5rem",
            textAlign: "left",
            cursor: "pointer",
          }}
          onClick={() => onRoomSelected(room.id)}
        >
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>
            즐겨찾기 #{idx + 1}
          </div>
          <div style={{ fontSize: "16px", fontWeight: "bold" }}>
            {room.name}
          </div>
          <div style={{ fontSize: "13px", color: "#aaa" }}>코드: {room.id}</div>
          <div style={{ fontSize: "13px", color: "#aaa" }}>
            인원: {room.memberCount}/12
          </div>
        </div>
      ))}

      {/* ✅ 방 입장 */}
      <div
        style={{
          background: "#111",
          borderRadius: "8px",
          padding: "1.5rem",
          textAlign: "center",
          border: "2px dashed #666",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <h3 style={{ margin: 0, color: "#3b82f6" }}>방 입장</h3>

        {/* 🔹 input + button 가로 배치 */}
        <div style={{ display: "flex", gap: "0.5rem", width: "100%" }}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="방 코드 입력"
            style={{
              flex: 1,
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #555",
              background: "#222",
              color: "#fff",
              textAlign: "center",
              fontSize: "14px",
            }}
          />
          <button
            onClick={handleJoinRoom}
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            입장
          </button>
        </div>
      </div>
      {/* ✅ 방 생성 */}
      <div
        style={{
          background: "#111",
          borderRadius: "8px",
          padding: "1.5rem",
          textAlign: "center",
          cursor: "pointer",
          border: "2px dashed #666",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
        onClick={handleCreateRoom}
      >
        <h3 style={{ margin: 0, color: "#3b82f6" }}>방 생성</h3>
      </div>
    </div>
  )
}
