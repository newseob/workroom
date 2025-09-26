import { useState, useEffect } from "react"
import { supabase } from "../lib/supabaseClient"

type Props = {
    userId: string
    roomId: string
}

export default function UserInputPanel({ userId, roomId }: Props) {
    const [nickname, setNickname] = useState("")
    const [character, setCharacter] = useState("")
    const [background, setBackground] = useState("")
    const [status, setStatus] = useState("")
    const [memo, setMemo] = useState("")

    const selectStyle: React.CSSProperties = {
        padding: "6px",
        borderRadius: "4px",
        border: "1px solid #555",
        background: "#222",
        color: "#fff",
    }

    // ✅ 처음 불러올 때 유저 정보 가져오기
    useEffect(() => {
        const fetchUser = async () => {
            const { data, error } = await supabase
                .from("users")
                .select("nickname, character, background, status, memo")
                .eq("id", userId)
                .single()

            if (error) {
                console.error("유저 정보 불러오기 실패:", error)
            } else if (data) {
                setNickname(data.nickname || "")
                setCharacter(data.character || "")
                setBackground(data.background || "")
                setStatus(data.status || "")
                setMemo(data.memo || "")
            }
        }
        fetchUser()
    }, [userId])

    // ✅ Supabase 갱신 함수
    const updateUser = async (field: string, value: string) => {
        const { error } = await supabase
            .from("users")
            .update({ [field]: value, updated_at: new Date().toISOString() })
            .eq("id", userId)

        if (error) {
            console.error("업데이트 실패:", error)
        } else {
            console.log(`${field} 갱신 완료`)
        }
    }

    return (
        <div
            style={{
                background: "#000",
                padding: "1rem",
                height: "180px",
                width: "100%",
                maxWidth: "500px",
                margin: "0 auto",
                boxSizing: "border-box",
            }}
        >
            {/* 윗줄: 닉네임 / 캐릭터 / 배경 / 상태 */}
            <div
                style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    flexWrap: "wrap",
                }}
            >
                <input
                    type="text"
                    placeholder="닉네임"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") updateUser("nickname", nickname)
                    }}
                    style={{
                        flex: 1,
                        minWidth: "120px",
                        padding: "6px",
                        borderRadius: "4px",
                        border: "1px solid #555",
                        background: "#222",
                        color: "#fff",
                    }}
                />
                <select
                    value={character}
                    onChange={(e) => {
                        const v = e.target.value
                        setCharacter(v)
                        updateUser("character", v)   // ✅ 바로 DB 반영
                    }}
                    style={selectStyle}
                >
                    <option value="">캐릭터 선택</option>
                    <option value="A">🐱 호두</option>
                    <option value="B">🐶 망고</option>
                    <option value="C">🦊 우유</option>
                </select>

                <select
                    value={background}
                    onChange={(e) => {
                        const v = e.target.value
                        setBackground(v)
                        updateUser("background", v)
                    }}
                    style={selectStyle}
                >
                    <option value="">배경 선택</option>
                    <option value="집">🏠 집</option>
                    <option value="회사">🏢 회사</option>
                    <option value="카페">🏨 카페</option>
                    <option value="자연">🖼️ 자연</option>
                </select>

                <select
                    value={status}
                    onChange={(e) => {
                        const v = e.target.value
                        setStatus(v)
                        updateUser("status", v)
                    }}
                    style={selectStyle}
                >
                    <option value="">상태 선택</option>
                    <option value="작업중">🖥️ 작업중</option>
                    <option value="딴짓중">🎮 딴짓중</option>
                    <option value="멍때리는중">⏸️ 멍때리는중</option>
                    <option value="자리비움">❌ 자리비움</option>
                </select>
            </div>

            {/* 아랫줄: 메모 입력칸 */}
            <textarea
                placeholder="메모 입력하고 enter"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                        e.preventDefault()

                        const newMemo = memo.trim() === "" ? "" : memo

                        // ✅ 1. users 테이블 업데이트
                        await updateUser("memo", newMemo)
                        setMemo(newMemo)

                        // ✅ 2. sound_events 테이블에 이벤트 기록
                        await supabase.from("sound_events").insert({
                            room_id: roomId,   // 🔹 현재 방 ID (props로 전달 필요)
                            user_id: userId,
                            type: "memo"
                        })

                    }
                }}
                style={{
                    width: "100%",
                    minHeight: "30px",
                    padding: "6px",
                    borderRadius: "4px",
                    border: "1px solid #555",
                    background: "#222",
                    color: "#fff",
                    resize: "none",
                }}
            />
        </div>
    )
}
