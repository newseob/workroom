import { useEffect, useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"


type RoomRow = {
    id: string
    name: string
    owner: string
    created_at?: string
}

type UserRow = {
    id: string
    nickname: string | null
    email: string | null
    current_room?: string | null
}

export default function Room() {
    const { roomId } = useParams()
    const navigate = useNavigate()   // ✅ 추가
    const [participants, setParticipants] = useState<UserRow[]>([])
    const [room, setRoom] = useState<RoomRow | null>(null)
    const [user, setUser] = useState<any>(null)
    const [tempName, setTempName] = useState("")
    const [isFavorite, setIsFavorite] = useState(false) // ✅ 즐겨찾기 상태 추가

    const isOwner = useMemo(
        () => Boolean(user?.id && room?.owner && user.id === room.owner),
        [user?.id, room?.owner]
    )

    // 로그인 유저
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    }, [])

    // ✅ 현재 방이 즐겨찾기인지 확인
    useEffect(() => {
        const checkFavorite = async () => {
            if (!user || !roomId) return
            const { data, error } = await supabase
                .from("favorites")
                .select("room_id")
                .eq("user_id", user.id)
                .eq("room_id", roomId)
                .maybeSingle()

            if (!error && data) {
                setIsFavorite(true)
            } else {
                setIsFavorite(false)
            }
        }
        checkFavorite()
    }, [user, roomId])

    // ✅ 방 나가기 함수
    const handleLeaveRoom = async () => {
        if (!user) return
        await supabase
            .from("users")
            .update({ current_room: null })  // ✅ current_room만 null 처리
            .eq("id", user.id)

        navigate("/") // 홈으로 이동
    }


    // ✅ 즐겨찾기 토글 함수
    const toggleFavorite = async () => {
        if (!user || !roomId) return

        if (isFavorite) {
            // 해제
            const { error } = await supabase
                .from("favorites")
                .delete()
                .eq("user_id", user.id)
                .eq("room_id", roomId)
            if (!error) setIsFavorite(false)
        } else {
            // 추가
            const { error } = await supabase
                .from("favorites")
                .insert({ user_id: user.id, room_id: roomId })
            if (!error) setIsFavorite(true)
        }
    }

    // ---- helpers ----
    const fetchRoom = async () => {
        if (!roomId) return
        const { data, error } = await supabase
            .from("rooms")
            .select("id,name,owner,created_at")
            .eq("id", roomId)
            .maybeSingle<RoomRow>()

        if (!error) {
            setRoom(data ?? null)
            setTempName(data?.name ?? "")
        }
    }

    const fetchParticipants = async () => {
        if (!roomId) return
        const { data } = await supabase
            .from("users")
            .select("id,nickname,email,current_room")
            .eq("current_room", roomId)
            .order("nickname", { ascending: true })

        setParticipants((data ?? []) as UserRow[])
    }

    // 방 + 참여자 + 실시간
    useEffect(() => {
        if (!roomId) return

        fetchRoom()
        fetchParticipants()

        const channel = supabase
            .channel(`room-${roomId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
                fetchRoom
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "users", filter: `current_room=eq.${roomId}` },
                fetchParticipants
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [roomId])

    // ✅ 방 이름 저장
    const saveRoomName = async () => {
        if (!roomId || !isOwner) return
        const name = tempName.trim()
        if (!name || name === room?.name) return

        const { data, error } = await supabase
            .from("rooms")
            .update({ name })
            .eq("id", roomId)
            .select("id,name,owner,created_at")
            .maybeSingle<RoomRow>()

        if (!error && data) {
            setRoom(data)
        }
    }


    // ✅ 입력 중 일정 시간 후 자동 저장 (디바운스)
    useEffect(() => {
        const timer = setTimeout(() => {
            saveRoomName()
        }, 2000) // 2초 후 자동 저장
        return () => clearTimeout(timer)
    }, [tempName])

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
            {/* 방 이름 + 코드 */}
            <header
                style={{
                    display: "flex",
                    justifyContent: "space-between", // 좌우 배치
                    alignItems: "center",
                    gap: "12px",
                }}
            >
                {/* ✅ 방 제목 (왼쪽) */}
                <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    readOnly={!isOwner}
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
                        boxSizing: "border-box",
                        textAlign: "left",
                        flex: 1, // 남는 공간 차지
                    }}
                />

                {/* ✅ 방 코드 + 복사 + 즐겨찾기 (오른쪽) */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <p style={{ fontSize: "14px", color: "#999", margin: 0 }}>
                        방 코드:{" "}
                        <span style={{ color: "#a78bfa", fontWeight: "bold" }}>{roomId}</span>
                    </p>

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
                        onClick={toggleFavorite}
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
                    {/* ✅ 나가기 버튼 */}
                    <button
                        onClick={handleLeaveRoom}
                        style={{
                            fontSize: "12px",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            background: "#dc2626", // 빨간색
                            color: "#fff",
                        }}
                    >
                        나가기
                    </button>
                </div>
            </header>


            {/* 참여자 */}
            <section>
                <h2 style={{ fontSize: "16px", marginBottom: "0.5rem" }}>참여자</h2>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {participants.map((p) => (
                        <li key={p.id} style={{ lineHeight: "1.9" }}>
                            {p.nickname || p.email}
                        </li>
                    ))}
                    {participants.length === 0 && <li>아직 참여자가 없어요.</li>}
                </ul>
            </section>

            {/* 메모 */}
            <section style={{ marginTop: "1rem" }}>
                <h2 style={{ fontSize: "16px", marginBottom: "0.5rem" }}>메모</h2>
                <textarea
                    placeholder="메모를 입력하세요..."
                    style={{
                        width: "100%",
                        height: "120px",
                        padding: "8px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#1a1a1a",
                        color: "#fff",
                    }}
                />
            </section>
        </div>
    )
}
