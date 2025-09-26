import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import Login from "./Login"
import RoomSelect from "./RoomSelect"
import UserList from "./UserList"   // ✅ 새로 만든 컴포넌트 임포트

type UserRow = {
  id: string
  nickname: string | null
  email: string | null
}

export default function Room() {
  const [participants, setParticipants] = useState<UserRow[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [roomId, setRoomId] = useState<string | null>(null) // ✅ 선택된 방 ID
  const [tempName, setTempName] = useState("")
  const [isFavorite, setIsFavorite] = useState(false)

  // ✅ 화면 단계: login → roomselect → room
  const [stage, setStage] = useState<"login" | "roomselect" | "room">("login")

  // ✅ 로그인 유저 확인
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      setLoading(false)
      // 자동으로 stage 전환하지 않음 (닉네임 + 로그인 버튼으로만 전환)
    })
  }, [])

  // ✅ 참여자 불러오기
  const fetchParticipants = async (roomId?: string | null) => {
    if (!roomId) return
    const { data } = await supabase
      .from("users")
      .select("id,nickname,email")
      .eq("current_room", roomId)
      .order("nickname", { ascending: true })

    setParticipants((data ?? []) as UserRow[])
  }

  // ✅ Room 단계 진입 시 참여자 목록 불러오기
  useEffect(() => {
    if (stage === "room" && roomId) {
      fetchParticipants(roomId)
    }
  }, [stage, roomId])

  // ✅ 로그아웃
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setParticipants([])   // ✅ 참가자 초기화
    setStage("login")
  }

  if (loading) {
    return (
      <div style={{ color: "#fff", textAlign: "center", padding: "2rem" }}>
        로딩 중...
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: "#101010",
        color: "#ccc",
        minHeight: "100vh",
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* ✅ 메뉴바: Room 단계에서만 표시 */}
      {stage === "room" && user && (
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
              fontSize: "24px",
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
              onClick={() => setIsFavorite((prev) => !prev)}
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
              {isFavorite ? "★ 즐겨찾기" : "☆ 즐겨찾기"}
            </button>

            <button
              onClick={() => alert("방 나가기 (추후 로직 연결 예정)")}
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
              나가기
            </button>

            {/* ✅ 로그아웃 버튼 */}
            <button
              onClick={handleLogout}
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
      )}

      {/* ✅ 메인 영역: 단계에 따라 화면 변경 */}
      <section
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {stage === "login" && (
          <Login
            onLoginSuccess={(loggedUser: any) => {
              setUser(loggedUser)
              setStage("roomselect")
            }}
          />
        )}

        {stage === "roomselect" && (
          <RoomSelect
            onRoomSelected={(selectedRoomId: string) => {
              setRoomId(selectedRoomId)   // ✅ 방 ID 저장
              setStage("room")            // ✅ Room 단계로 이동
            }}
          />
        )}

        {stage === "room" && (
          <UserList participants={participants} />
        )}
      </section>
    </div>
  )
}
