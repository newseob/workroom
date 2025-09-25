import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"

export default function Home() {
    const [user, setUser] = useState<any>(null)
    const [nickname, setNickname] = useState("")
    const [roomCode, setRoomCode] = useState("")
    const navigate = useNavigate()
    const [lastRoom, setLastRoom] = useState<any>(null)
    const [favoriteRooms, setFavoriteRooms] = useState<any[]>([])

    useEffect(() => {
        if (!user) return

        const fetchRooms = async () => {
            // ✅ 1. 마지막 접속 방 (last_room만 확인)
            const { data: profile, error: userError } = await supabase
                .from("users")
                .select("last_room")
                .eq("id", user.id)
                .maybeSingle()

            if (userError) {
                console.error("유저 정보 불러오기 실패:", userError.message)
                return
            }

            if (profile?.last_room) {
                const { data: lastData } = await supabase
                    .from("rooms")
                    .select("id, name")
                    .eq("id", profile.last_room)
                    .maybeSingle()

                if (lastData) {
                    const { count } = await supabase
                        .from("users")
                        .select("id", { count: "exact", head: true })
                        .eq("current_room", lastData.id)

                    setLastRoom({ ...lastData, count })
                }
            }

            // ✅ 2. 즐겨찾기 방 목록
            const { data: favs } = await supabase
                .from("favorites")
                .select("room_id")
                .eq("user_id", user.id)

            if (favs) {
                const enriched = await Promise.all(
                    favs.map(async (f: any) => {
                        const { data: room } = await supabase
                            .from("rooms")
                            .select("id, name")
                            .eq("id", f.room_id)
                            .maybeSingle()

                        const { count } = await supabase
                            .from("users")
                            .select("id", { count: "exact", head: true })
                            .eq("current_room", f.room_id)

                        return {
                            id: room?.id,
                            name: room?.name,
                            count,
                        }
                    })
                )
                setFavoriteRooms(enriched)
            }
        }

        fetchRooms()
    }, [user])


    // ✅ 로그인/닉네임 불러오기
    useEffect(() => {
        const fetchUser = async () => {
            const { data } = await supabase.auth.getUser()
            const currentUser = data.user ?? null
            setUser(currentUser)

            if (currentUser) {
                // 닉네임 불러오기 (row 없으면 null)
                const { data: profile, error } = await supabase
                    .from("users")
                    .select("nickname")
                    .eq("id", currentUser.id)
                    .maybeSingle()

                if (error) console.error("닉네임 불러오기 에러:", error.message)
                if (profile?.nickname) setNickname(profile.nickname)
            }
        }

        fetchUser()

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_e, session) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)

            if (currentUser) {
                supabase
                    .from("users")
                    .select("nickname")
                    .eq("id", currentUser.id)
                    .maybeSingle()
                    .then(({ data, error }) => {
                        if (error) console.error("닉네임 불러오기 에러:", error.message)
                        if (data?.nickname) setNickname(data.nickname)
                    })
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const login = () =>
        supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: "https://workroom-phi.vercel.app/" },
        })

    const logout = () => supabase.auth.signOut()

    // ✅ 5자리 랜덤 코드 생성기
    const generateRoomCode = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        let result = ""
        for (let i = 0; i < 5; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return result
    }

    // ✅ 방 생성
    const handleCreateRoom = async () => {
        if (!user) {
            alert("로그인이 필요합니다.")
            return
        }
        if (!nickname.trim()) {
            alert("닉네임을 입력하세요.")
            return
        }

        // ✅ 1. 현재 방에서 나가기 (있다면)
        await supabase
            .from("users")
            .update({ current_room: null })
            .eq("id", user.id)

        // ✅ 2. 새 방 코드 생성
        const newRoomId = generateRoomCode()
        
        console.log("👉 user 값:", user)

        // ✅ 3. rooms 테이블에 새 방 생성
        const { error: roomError } = await supabase.from("rooms").insert({
            id: newRoomId,
            name: "새 방",
            owner: user.id,
        })
        if (roomError) {
            console.error("방 생성 실패:", roomError.message)
            alert("방 생성 실패: " + roomError.message)
            return
        }

        // ✅ 4. users 테이블 업데이트 (새 방 입장)
        const { error: userError } = await supabase.from("users").upsert({
            id: user.id,
            email: user.email,
            nickname,
            current_room: newRoomId,
            last_room: newRoomId,   // ✅ 추가
            updated_at: new Date().toISOString(),
        })
        if (userError) {
            console.error("유저 업데이트 실패:", userError.message)
            alert("유저 업데이트 실패: " + userError.message)
            return
        }

        // ✅ 5. 방 페이지로 이동
        navigate(`/room/${newRoomId}`)
    }



    // ✅ 방 입장
    const handleJoinRoom = async () => {
        if (!user) return alert("로그인이 필요합니다.")
        if (!nickname.trim()) return alert("닉네임을 입력하세요.")
        if (!roomCode.trim()) return alert("방 코드를 입력하세요.")

        const { data, error } = await supabase
            .from("users")
            .update({
                nickname,
                current_room: roomCode.trim(),
                last_room: roomCode.trim(),   // ✅ 입장할 때 갱신
                updated_at: new Date().toISOString(),
            })
            .eq("id", user.id)

        console.log("join 결과:", { data, error })
        if (error) {
            alert("방 입장 실패: " + error.message)
            return
        }

        navigate(`/room/${roomCode.trim()}`)
    }

    return (
        <div
            style={{
                backgroundColor: "#101010",
                color: "#fff",
                minHeight: "100vh",
                minWidth: "100vw",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexDirection: "column",
                textAlign: "center",
            }}
        >
            <img
                src="/banner.png"
                alt="예시 이미지"
                style={{ maxWidth: "80%", marginTop: "20px", marginBottom: "2rem" }}
            />

            {/* 전체설명 */}
            <p style={{ marginBottom: "2rem", color: "#ccc" }}>
                이 사이트는 같이 작업하는 느낌을 나타내는 귀여운 공간입니다:)
            </p>
            <p style={{ marginBottom: "2rem", color: "#ccc" }}>
                <span style={{ color: "#a78bfa", fontWeight: "bold" }}>방 생성</span>을
                하면
                <span style={{ color: "#a78bfa", fontWeight: "bold" }}> 5자리 코드</span>
                가 만들어지고, 그 코드를 공유하면 다른 사람도 바로 들어올 수 있어요.
                <br />
                이미 누군가가 보낸 코드가 있다면{" "}
                <span style={{ color: "#3b82f6", fontWeight: "bold" }}>방 입장</span>{" "}
                버튼을 누르고
                <span style={{ color: "#3b82f6", fontWeight: "bold" }}>
                    {" "}
                    코드를 입력
                </span>
                해 들어갈 수 있습니다.
            </p>

            <div style={{ height: "100px" }}></div>

            {/* 로그인 & 닉네임 박스 */}
            <div
                style={{
                    background: "#222222",
                    padding: "1.5rem",
                    borderRadius: "8px",
                    marginBottom: "2rem",
                    width: "100%",
                    maxWidth: "320px",
                }}
            >
                {/* 로그인 정보 */}
                <div style={{ marginBottom: "1rem" }}>
                    <strong style={{ color: "#bbb", display: "block", marginBottom: "0.5rem" }}>
                        로그인 정보
                    </strong>
                    {user ? (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span style={{ color: "#fff" }}>{user.email}</span>
                            <button
                                onClick={logout}
                                style={{
                                    background: "#444",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "4px 8px",
                                    cursor: "pointer",
                                }}
                            >
                                로그아웃
                            </button>
                        </div>
                    ) : (
                        <div style={{ textAlign: "center" }}>
                            <button
                                onClick={login}
                                style={{
                                    background: "#444",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "4px",
                                    padding: "6px 12px",
                                    cursor: "pointer",
                                }}
                            >
                                Google 로그인
                            </button>
                        </div>
                    )}
                </div>

                {/* 닉네임 */}
                <div>
                    <strong style={{ color: "#bbb", display: "block", marginBottom: "0.5rem" }}>
                        닉네임
                    </strong>
                    <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="닉네임 입력"
                        style={{
                            width: "100%",
                            padding: "6px",
                            borderRadius: "4px",
                            border: "none",
                            textAlign: "center",
                            background: "#444444",
                            color: "#fff",
                        }}
                    />
                </div>
            </div>

            {/* 방 관련 박스 */}
            <div
                style={{
                    background: "#222222",
                    padding: "1.5rem",
                    borderRadius: "8px",
                    width: "100%",
                    maxWidth: "320px",
                    textAlign: "center",
                }}
            >
                {/* 방 생성 / 입장 */}
                <div style={{ marginBottom: "1.5rem" }}>
                    <button
                        onClick={handleCreateRoom}
                        style={{
                            backgroundColor: "#6d28d9",
                            color: "#fff",
                            border: "none",
                            padding: "8px 14px",
                            borderRadius: "6px",
                            cursor: "pointer",
                        }}
                    >
                        방 생성
                    </button>
                    {/* 방 코드 입력칸 */}
                    <input
                        type="text"
                        placeholder="방 코드 입력"
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleJoinRoom()
                        }}
                        style={{
                            marginLeft: 10,
                            padding: "6px",
                            borderRadius: "4px",
                            border: "none",
                            textAlign: "center",
                            width: "120px",
                            background: "#444444",   // ✅ 회색 배경
                            color: "#fff",           // ✅ 흰색 글씨
                        }}
                    />
                    <button
                        onClick={handleJoinRoom}
                        style={{
                            marginLeft: 10,
                            backgroundColor: "#3b82f6",
                            color: "#fff",
                            border: "none",
                            padding: "8px 14px",
                            borderRadius: "6px",
                            cursor: "pointer",
                        }}
                    >
                        방 입장
                    </button>
                </div>

                <div style={{ height: "20px" }}></div>

                {/* 마지막 접속 방 */}
                <h3 style={{ color: "#eee" }}>마지막 접속</h3>
                {lastRoom ? (
                    <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                        <span style={{ color: "#bbb" }}>
                            {lastRoom.name} ({lastRoom.id}) - {lastRoom.count}/12
                        </span>
                        <button
                            onClick={() => navigate(`/room/${lastRoom.id}`)}
                            style={{
                                padding: "4px 8px",
                                fontSize: "12px",
                                borderRadius: "4px",
                                border: "none",
                                background: "#555",
                                color: "#fff",
                                cursor: "pointer",
                            }}
                        >
                            입장
                        </button>
                    </div>
                ) : (
                    <p style={{ color: "#bbb" }}>없음</p>
                )}

                {/* 즐겨찾기한 방 */}
                <h3 style={{ marginTop: "1.5rem", color: "#eee" }}>즐겨찾기</h3>
                <ul style={{ listStyle: "none", padding: 0 }}>
                    {favoriteRooms.length > 0 ? (
                        favoriteRooms.map((r) => (
                            <li
                                key={r.id}
                                style={{
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: "8px",
                                    marginBottom: "6px",
                                }}
                            >
                                <span style={{ color: "#bbb" }}>
                                    {r.name} ({r.id}) - {r.count}/12
                                </span>
                                <button
                                    onClick={() => navigate(`/room/${r.id}`)}
                                    style={{
                                        padding: "4px 8px",
                                        fontSize: "12px",
                                        borderRadius: "4px",
                                        border: "none",
                                        background: "#555",
                                        color: "#fff",
                                        cursor: "pointer",
                                    }}
                                >
                                    입장
                                </button>
                            </li>
                        ))
                    ) : (
                        <li style={{ color: "#bbb" }}>없음</li>
                    )}
                </ul>
            </div>

            <div style={{ height: "100px" }}></div>

        </div>
    )
}
