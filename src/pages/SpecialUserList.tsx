// src/components/SpecialUserList.tsx
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

type User = {
    id: string
    nickname: string | null
    current_room?: string | null
    memo?: string | null
    last_seen?: string | null
    status?: string | null             // ✅ 추가
    status_before_away?: string | null // ✅ 추가
}

type SpecialUserListProps = {
    roomId: string
    currentUserId: string
}

const imageMap: Record<string, number> = {
    "망고멍": 1,
    "우유": 2,
    "켠피": 3,
    "모니": 4,
    "호떡": 5,
    "뚜노": 6,
}

const orderMap: Record<string, number> = {
    "호떡": 1,
    "망고멍": 2,
    "우유": 3,
    "켠피": 4,
    "모니": 5,
    "뚜노": 6,
}

// 퍼센트 좌표 (이미지 박스 기준)
const memoPositionMap: Record<string, { top: string; left: string }> = {
    "호떡": { top: "15%", left: "30%" },
    "망고멍": { top: "30%", left: "80%" },
    "우유": { top: "10%", left: "71%" },
    "켠피": { top: "20%", left: "63%" },
    "모니": { top: "10%", left: "53%" },
    "뚜노": { top: "30%", left: "40%" },
}

export default function SpecialUserList({ roomId, currentUserId }: SpecialUserListProps) {
    const [participants, setParticipants] = useState<User[]>([])
    const [highlightedIds, setHighlightedIds] = useState<string[]>([])

    const triggerHighlight = (id: string) => {
        setHighlightedIds((prev) => [...prev, id])
        setTimeout(() => {
            setHighlightedIds((prev) => prev.filter((x) => x !== id))
        }, 3000)
    }

    // ✅ 내 last_seen 갱신 (30초마다 실행)
    useEffect(() => {
        if (!currentUserId) return
        const interval = setInterval(async () => {
            await supabase
                .from("users")
                .update({ last_seen: new Date().toISOString() })
                .eq("id", currentUserId)
        }, 30000) // 30초마다
        return () => clearInterval(interval)
    }, [currentUserId])

    // ✅ 10분 이상 미활동 → 자리비움으로 전환
    useEffect(() => {
        const updateAwayStatuses = async () => {
            for (const p of participants) {
                if (!p.last_seen) continue
                const lastSeen = new Date(p.last_seen).getTime()
                const diffMinutes = Math.floor((Date.now() - lastSeen) / 1000 / 60)

                if (diffMinutes >= 10 && p.status !== "자리비움") {
                    await supabase
                        .from("users")
                        .update({
                            status_before_away: p.status,
                            status: "자리비움",
                        })
                        .eq("id", p.id)
                }
            }
        }

        updateAwayStatuses()
        const interval = setInterval(updateAwayStatuses, 60000) // 1분마다
        return () => clearInterval(interval)
    }, [participants])

    useEffect(() => {
        if (!roomId) return

        const fetchParticipants = async () => {
            const { data } = await supabase
                .from("users")
                .select("id, nickname, memo, current_room, last_seen")
                .eq("current_room", roomId)

            if (data) setParticipants(data)
        }

        fetchParticipants()

        const channel = supabase
            .channel(`special-users-${roomId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "users" },
                async (payload) => {
                    const newRow = payload.new as User
                    const oldRow = payload.old as User

                    // ✅ 자리비움 → 복귀 처리
                    if (
                        payload.eventType === "UPDATE" &&
                        newRow.last_seen !== oldRow?.last_seen &&
                        newRow.status === "자리비움" &&
                        newRow.status_before_away
                    ) {
                        await supabase
                            .from("users")
                            .update({
                                status: newRow.status_before_away,
                                status_before_away: null,
                            })
                            .eq("id", newRow.id)
                    }

                    // ✅ 기존 participants 갱신 로직
                    setParticipants((prev) => {
                        // 완전 삭제
                        if (payload.eventType === "DELETE" && oldRow) {
                            const leaveAudio = new Audio("/assets/sound/Metal Dropped Rolling.mp3")
                            leaveAudio.volume = 0.6
                            leaveAudio.play().catch(console.error)
                            return prev.filter((u) => u.id !== oldRow.id)
                        }

                        // 나간 경우
                        if (
                            payload.eventType === "UPDATE" &&
                            oldRow?.current_room === roomId &&
                            newRow.current_room !== roomId
                        ) {
                            const leaveAudio = new Audio("/assets/sound/Metal Dropped Rolling.mp3")
                            leaveAudio.volume = 0.6
                            leaveAudio.play().catch(console.error)
                            return prev.filter((u) => u.id !== newRow.id)
                        }

                        // 입장 or 업데이트
                        if (
                            (payload.eventType === "INSERT" || payload.eventType === "UPDATE") &&
                            newRow.current_room === roomId
                        ) {
                            const exists = prev.find((u) => u.id === newRow.id)
                            if (exists) {
                                if (newRow.memo !== exists.memo) {
                                    triggerHighlight(newRow.id)
                                    const memoAudio = new Audio("/assets/sound/Metallic Clank.mp3")
                                    memoAudio.volume = 0.6
                                    memoAudio.play().catch(console.error)
                                }
                                return prev.map((u) => (u.id === newRow.id ? newRow : u))
                            } else {
                                const joinAudio = new Audio("/assets/sound/Pop.mp3")
                                joinAudio.volume = 0.6
                                joinAudio.play().catch(console.error)
                                return [...prev, newRow]
                            }
                        }

                        return prev
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }

    }, [roomId])

    const sorted = [...participants].sort((a, b) => {
        const orderA = orderMap[a.nickname ?? ""] ?? 999
        const orderB = orderMap[b.nickname ?? ""] ?? 999
        return orderA - orderB
    })

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",   // ✅ 스크롤 제거
                display: "flex",      // ✅ 중앙 정렬
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <style>{`
        @keyframes memoGlow {
          0%   { box-shadow: 0 0 0px yellow; }
          50%  { box-shadow: 0 0 12px yellow; }
          100% { box-shadow: 0 0 0px yellow; }
        }
        .memo-highlight {
          animation: memoGlow 3s ease-in-out;
        }
      `}</style>

            {sorted.map((p) => {
                const imgNum = imageMap[p.nickname ?? ""]
                if (!imgNum) return null
                const isHighlighted = highlightedIds.includes(p.id)

                const lastSeen = p.last_seen ? new Date(p.last_seen).getTime() : 0
                const diffMinutes = lastSeen ? (Date.now() - lastSeen) / 1000 / 60 : 0
                const inactive = diffMinutes >= 10

                return (
                    <div
                        key={p.id}
                        style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            zIndex: 999 - (orderMap[p.nickname ?? ""] ?? 999),
                        }}
                    >
                        {/* 이미지 박스 */}
                        <div
                            style={{
                                position: "relative",
                                maxWidth: "100%",
                                maxHeight: "100%",
                                opacity: inactive ? 0.2 : 1, // ✅ 비활성화 시 반투명 처리
                            }}
                        >
                            <img
                                src={`/assets/summerspring/${imgNum}.png`}
                                alt={p.nickname || "캐릭터"}
                                style={{
                                    width: "auto",
                                    height: "auto",
                                    maxWidth: "100%",
                                    maxHeight: "100%",
                                    display: "block",
                                }}
                            />

                            {/* 메모 박스 */}
                            {p.memo && (
                                <div
                                    className={isHighlighted ? "memo-highlight" : ""}
                                    style={{
                                        position: "absolute",
                                        top: memoPositionMap[p.nickname ?? ""]?.top || "20%",
                                        left: memoPositionMap[p.nickname ?? ""]?.left || "50%",
                                        transform: "translate(-50%, -50%)",
                                        background: "rgba(255,255,255,0.9)", // ✅ 거의 흰색
                                        color: "#000",                        // ✅ 글씨는 검정
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                        fontWeight: "bold",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {p.memo}
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
