import { useEffect, useRef } from "react"
import { supabase } from "../lib/supabaseClient"

type RoomHeaderProps = {
  tempName: string
  setTempName: (value: string) => void
  roomId: string | null
  isFavorite: boolean
  setIsFavorite: (value: boolean) => void
  onSelectRoom: () => void
  onLogout: () => void
}

export default function RoomHeader({
  tempName,
  setTempName,
  roomId,
  isFavorite,
  setIsFavorite,
  onSelectRoom,
  onLogout,
}: RoomHeaderProps) {
  const saveTimer = useRef<NodeJS.Timeout | null>(null)

  // ✅ 방 이름 자동 저장
  useEffect(() => {
    if (!roomId) return
    if (!tempName) return

    if (saveTimer.current) clearTimeout(saveTimer.current)

    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("rooms")
        .update({ name: tempName })   // ✅ updated_at 제거
        .eq("id", roomId)

      if (error) {
        console.error("방 이름 저장 실패:", error)
      } else {
        console.log("방 이름 저장 완료:", tempName)
      }
    }, 1500)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [tempName, roomId])

  // ✅ 즐겨찾기 토글
  const handleToggleFavorite = async () => {
    if (!roomId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert("로그인이 필요합니다.")
      return
    }

    if (isFavorite) {
      // 즐겨찾기 해제
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)   // ✅ uuid
        .eq("room_id", roomId)    // ✅ text

      if (error) {
        console.error("즐겨찾기 해제 실패:", error)
      } else {
        setIsFavorite(false)
      }
    } else {
      // 즐겨찾기 추가
      const { error } = await supabase.from("favorites").insert({
        user_id: user.id,
        room_id: roomId,
      })

      if (error) {
        console.error("즐겨찾기 추가 실패:", error)
      } else {
        setIsFavorite(true)
      }
    }
  }

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <input
        type="text"
        value={tempName}
        onChange={(e) => setTempName(e.target.value)}
        placeholder="방 이름을 입력하세요"
        style={{
          fontSize: "20px",
          fontWeight: "bold",
          lineHeight: "1.2",
          height: "36px",
          padding: 0,
          margin: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "#fff",
          flex: 1,
        }}
      />

      {roomId && (
        <span style={{ fontSize: "14px", color: "#aaa" }}>
          코드: {roomId}
        </span>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={() => {
            if (roomId) {
              navigator.clipboard.writeText(roomId)
              alert("방 코드가 복사되었습니다.")
            }
          }}
          style={{
            fontSize: "12px",
            padding: "4px 8px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            background: "#333",
            color: "#fff",
          }}
        >
          복사
        </button>

        <button
          onClick={handleToggleFavorite}
          style={{
            fontSize: "12px",
            padding: "4px 8px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            background: isFavorite ? "#facc15" : "#333",
            color: isFavorite ? "#000" : "#fff",
            fontWeight: "bold",
          }}
        >
          {isFavorite ? "★" : "☆"}
        </button>

        <button
          onClick={onSelectRoom}
          style={{
            fontSize: "12px",
            padding: "4px 8px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            background: "#3b82f6",
            color: "#fff",
          }}
        >
          다른방
        </button>

        <button
          onClick={onLogout}
          style={{
            fontSize: "12px",
            padding: "4px 8px",
            borderRadius: "4px",
            border: "none",
            cursor: "pointer",
            background: "#dc2626",
            color: "#fff",
          }}
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}
