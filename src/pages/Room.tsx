import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import Login from "./Login"
import RoomSelect from "./RoomSelect"
import UserList from "./UserList"
import RoomHeader from "./RoomHeader"

// ===== 유저 데이터 타입 =====
type UserRow = {
  id: string
  nickname: string | null
  email: string | null
}

export default function Room() {
  // ===== 상태 관리 =====
  const [participants, setParticipants] = useState<UserRow[]>([]) // 현재 방 참여자 리스트
  const [user, setUser] = useState<any>(null)                     // 로그인한 유저 정보
  const [loading, setLoading] = useState(true)                    // 로딩 상태
  const [roomId, setRoomId] = useState<string | null>(null)       // 현재 선택된 방 ID
  const [tempName, setTempName] = useState("")                    // 방 이름 (RoomHeader에서 수정됨)
  const [isFavorite, setIsFavorite] = useState(false)             // 즐겨찾기 여부
  const [stage, setStage] = useState<"login" | "roomselect" | "room">("login") // 화면 단계

  // ===== 방 이름 가져오기 (roomId가 바뀔 때 실행) =====
  useEffect(() => {
    const fetchRoomName = async () => {
      if (!roomId) return

      const { data, error } = await supabase
        .from("rooms")
        .select("name")
        .eq("id", roomId)
        .single()

      if (error) {
        console.error("방 이름 불러오기 실패:", error.message)
        return
      }

      if (data) {
        setTempName(data.name) // DB에서 가져온 방 이름을 상태에 저장
      }
    }

    fetchRoomName()
  }, [roomId])

  // ===== 로그인 유저 확인 (처음 렌더링 시 한 번 실행) =====
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      setLoading(false)
    })
  }, [])

  // ===== 참여자 불러오기 (users 테이블에서 current_room = roomId) =====
  const fetchParticipants = async (roomId?: string | null) => {
    if (!roomId) return
    const { data, error } = await supabase
      .from("users")
      .select("id, nickname, email")
      .eq("current_room", roomId)
      .order("nickname", { ascending: true })

    if (error) {
      console.error("참여자 불러오기 실패:", error)
      return
    }

    setParticipants((data ?? []) as UserRow[])
  }

  // ===== 방 입장 후 데이터 로드 (참여자 + 즐겨찾기) =====
  useEffect(() => {
    if (stage === "room" && roomId) {
      // 참여자 불러오기
      fetchParticipants(roomId)

      // 즐겨찾기 여부 확인
      if (user) {
        supabase
          .from("favorites")
          .select("user_id, room_id") // 실제 존재하는 컬럼만 선택
          .eq("user_id", user.id)
          .eq("room_id", roomId)
          .maybeSingle()
          .then(({ data }) => {
            setIsFavorite(!!data) // row가 있으면 true, 없으면 false
          })
      }
    }
  }, [stage, roomId, user])

  // ===== 로그아웃 =====
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setParticipants([])
    setStage("login")
  }

  // ===== 방 선택 시 실행 (user.current_room 업데이트) =====
  const handleRoomSelected = async (selectedRoomId: string) => {
    setRoomId(selectedRoomId)
    setStage("room")

    if (user) {
      await supabase
        .from("users")
        .update({
          current_room: selectedRoomId,
          last_room: selectedRoomId,
        })
        .eq("id", user.id)
    }
  }

  // ===== 로딩 상태 =====
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
      }}
    >
      {/* ===== 방 화면 상단 헤더 ===== */}
      {stage === "room" && user && (
        <RoomHeader
          tempName={tempName}
          setTempName={setTempName}
          roomId={roomId}
          isFavorite={isFavorite}
          setIsFavorite={setIsFavorite}
          onSelectRoom={async () => {
            // 방 나가기 → users.current_room = null
            if (user) {
              await supabase
                .from("users")
                .update({ current_room: null })
                .eq("id", user.id)
            }
            setRoomId(null)
            setParticipants([])
            setStage("roomselect")
          }}
          onLogout={handleLogout}
        />
      )}

      {/* ===== 메인 컨텐츠 ===== */}
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

        {stage === "room" && <UserList participants={participants} />}
      </section>
    </div>
  )
}
