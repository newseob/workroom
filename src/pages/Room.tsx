import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import Login from "./Login"
import RoomSelect from "./RoomSelect"
import UserList from "./UserList"
import RoomHeader from "./RoomHeader"
import UserInputPanel from "./UserInputPanel"
import SpecialUserList from "./SpecialUserList"

export default function Room() {
  const [user, setUser] = useState<any>(null)                     // 로그인 유저 정보
  const [loading, setLoading] = useState(true)                    // 로딩 상태
  const [roomId, setRoomId] = useState<string | null>(null)       // 현재 방 ID
  const [tempName, setTempName] = useState("")                    // 방 이름
  const [isFavorite, setIsFavorite] = useState(false)             // 즐겨찾기 여부
  const [stage, setStage] = useState<"login" | "roomselect" | "room">("login")

  // ===== 1. 로그인 유저 확인 + 마지막 방 자동 연결 =====
  useEffect(() => {
    const checkUser = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const currentUser = authData.user
      setUser(currentUser ?? null)
      setLoading(false)

      // ✅ 자동 이동 없앰: 무조건 로그인 화면
      setStage("login")
    }

    checkUser()
  }, [])

  // ===== 5. 복귀 이벤트 감지 (마우스/키보드 움직임) =====
  useEffect(() => {
    if (!(stage === "room" && user)) return

    const handleActivity = async () => {
      await supabase
        .from("users")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id)
    }

    window.addEventListener("mousemove", handleActivity)
    window.addEventListener("keydown", handleActivity)

    return () => {
      window.removeEventListener("mousemove", handleActivity)
      window.removeEventListener("keydown", handleActivity)
    }
  }, [stage, user])

  // ===== 2. roomId 바뀔 때 방 이름 가져오기 =====
  useEffect(() => {
    const fetchRoomName = async () => {
      if (!roomId) return

      const { data, error } = await supabase
        .from("rooms")
        .select("name")
        .eq("id", roomId)
        .single()

      if (!error && data) setTempName(data.name)
    }

    fetchRoomName()
  }, [roomId])

  // ===== 3. 즐겨찾기 여부 확인 =====
  useEffect(() => {
    if (stage === "room" && roomId && user) {
      supabase
        .from("favorites")
        .select("user_id, room_id")
        .eq("user_id", user.id)
        .eq("room_id", roomId)
        .maybeSingle()
        .then(({ data }) => {
          setIsFavorite(!!data)
        })
    }
  }, [stage, roomId, user])

  // ===== 4. 로그아웃 =====
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRoomId(null)
    setStage("login")
  }

  // ===== 방 선택 시 유저 정보 업데이트 =====
  const handleRoomSelected = async (selectedRoomId: string) => {
    if (user) {
      await supabase
        .from("users")
        .update({
          current_room: selectedRoomId,
          last_room: selectedRoomId,
        })
        .eq("id", user.id)
    }

    setRoomId(selectedRoomId)
    setStage("room")
  }

  // ===== 로딩 상태 표시 =====
  if (loading) {
    return (
      <div style={{ color: "#fff", textAlign: "center", padding: "2rem" }}>
        로딩 중...
      </div>
    )
  }

  // ===== 화면 렌더링 =====
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
        overflow: "hidden",
      }}
    >
      {stage === "room" && user && (
        <RoomHeader
          tempName={tempName}
          setTempName={setTempName}
          roomId={roomId}
          isFavorite={isFavorite}
          setIsFavorite={setIsFavorite}
          onSelectRoom={async () => {
            if (user) {
              await supabase
                .from("users")
                .update({ current_room: null })
                .eq("id", user.id)
            }
            setRoomId(null)
            setStage("roomselect")
          }}
          onLogout={handleLogout}
        />
      )}

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
              // ✅ Login.tsx에서 닉네임까지 확인된 경우에만 호출됨
              // 여기서는 stage만 안전하게 roomselect로 이동
              if (loggedUser?.nickname) {
                setStage("roomselect")
              }
            }}
          />
        )}

        {stage === "roomselect" && (
          <RoomSelect onRoomSelected={handleRoomSelected} />
        )}

        {stage === "room" && roomId && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100vh",   // ✅ 100% 대신 vh 단위로 확실히 잡기
              width: "100%",
            }}
          >
            <div
              style={{
                height: "calc(100vh - 200px)",
                overflowY: "auto",
              }}
            >
              {/* ✅ 현재 방 ID 넘겨줌 */}
              <div style={{ height: "calc(100vh - 200px)", overflowY: "auto" }}>
                {roomId === "U6R8H" ? (
                  <SpecialUserList roomId={roomId} currentUserId={user.id} />
                ) : (
                  <UserList roomId={roomId} currentUserId={user.id} />
                )}
              </div>
              
            </div>

            <div
              style={{
                height: "200px",
                background: "#000",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <UserInputPanel userId={user.id} roomId={roomId} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
