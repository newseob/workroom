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
          await fetchParticipants(userRow.last_room) // 참여자도 즉시 불러오기
        } else {
          setStage("roomselect")   // 마지막 방 없으면 선택 화면
        }
      } else {
        setStage("login")          // 로그인 안 되어 있으면 로그인 화면
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

      if (error) {
        console.error("방 이름 불러오기 실패:", error.message)
        return
      }
      if (data) setTempName(data.name)
    }

    fetchRoomName()
  }, [roomId])

  // ===== 3. 참여자 불러오기 (users.current_room 기준) =====
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

  // ===== 4. 방 입장 시 데이터 로드 (참여자 + 즐겨찾기) =====
  useEffect(() => {
    if (stage === "room" && roomId) {
      fetchParticipants(roomId)

      if (user) {
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
    }
  }, [stage, roomId, user])

  // ===== 5. 참여자 리얼타임 반영 =====
  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel("users-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        (payload) => {
          const newRow = payload.new as { current_room?: string }
          const oldRow = payload.old as { current_room?: string }

          if (
            newRow?.current_room === roomId ||
            oldRow?.current_room === roomId
          ) {
            fetchParticipants(roomId)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  // ===== 6. 로그아웃 =====
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setParticipants([])
    setStage("login")
  }

  // ===== 방 선택 시 유저 정보 업데이트 =====
  const handleRoomSelected = async (selectedRoomId: string) => {
    if (user) {
      // 1. DB 먼저 업데이트
      await supabase
        .from("users")
        .update({
          current_room: selectedRoomId,
          last_room: selectedRoomId,
        })
        .eq("id", user.id)
    }

    // 2. 상태 업데이트
    setRoomId(selectedRoomId)
    setStage("room")

    // 3. DB 반영 직후 참여자 다시 불러오기 (내가 포함된 상태)
    await fetchParticipants(selectedRoomId)
  }


  // ===== 8. 로딩 상태 표시 =====
  if (loading) {
    return (
      <div style={{ color: "#fff", textAlign: "center", padding: "2rem" }}>
        로딩 중...
      </div>
    )
  }

  // ===== 9. 화면 렌더링 =====
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
      {/* 상단 헤더 (방 화면일 때만) */}
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
            setParticipants([])
            setStage("roomselect")
          }}
          onLogout={handleLogout}
        />
      )}

      {/* 메인 컨텐츠 */}
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
