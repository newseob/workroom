import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import Login from "./Login"
import RoomSelect from "./RoomSelect"
import UserList from "./UserList"
import RoomHeader from "./RoomHeader"
import UserInputPanel from "./UserInputPanel"

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

      if (currentUser) {
        // DB에서 마지막 방 가져오기
        const { data: userRow } = await supabase
          .from("users")
          .select("last_room")
          .eq("id", currentUser.id)
          .single()

        if (userRow?.last_room) {
          setRoomId(userRow.last_room)
          setStage("room")         // ✅ 마지막 방으로 바로 이동
        } else {
          setStage("roomselect")
        }
      } else {
        setStage("login")
      }
    }

    checkUser()
  }, [])

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
              setStage("roomselect")
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
              height: "100%",
              width: "100%",
            }}
          >
            <div
              style={{
                height: "calc(100vh)",
                overflowY: "auto",
              }}
            >
              {/* ✅ 현재 방 ID 넘겨줌 */}
              <UserList roomId={roomId} currentUserId={user.id} />
              </div>

            <div
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                width: "100%",
                height: "110px",
                background: "#000",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <UserInputPanel userId={user.id} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
