import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

// 배경 매핑
const backgroundMap: Record<string, string> = {
  집: "room",
  회사: "office",
  카페: "cafe",
  자연: "nature",
}

// 캐릭터 매핑
const characterMap: Record<string, string> = {
  A: "호두",
  B: "망고",
  C: "우유",
}

// 상태 → 파일명 매핑
const statusFileMap: Record<string, string> = {
  작업중: "working.gif",
  딴짓중: "distraction.png",
  멍때리는중: "idle.png",
  자리비움: "away.png",
}

// User 타입
type User = {
  id: string
  email: string | null
  nickname: string | null
  background?: string | null
  character?: "A" | "B" | "C"
  status?: string | null
  status_before_away?: string | null   // ✅ 원래 상태 저장용
  current_room?: string | null
  memo?: string | null
  last_seen?: string | null
}

type UserListProps = {
  roomId: string
  currentUserId: string
}

export default function UserList({ roomId, currentUserId }: UserListProps) {
  const [participants, setParticipants] = useState<User[]>([])
  const [highlightedIds, setHighlightedIds] = useState<string[]>([])

  // ✅ last_seen 기반 상태 동기화
  useEffect(() => {
    const updateAwayStatuses = async () => {
      for (const p of participants) {
        if (!p.last_seen) continue;

        const lastSeen = new Date(p.last_seen).getTime();
        const diffMinutes = Math.floor((Date.now() - lastSeen) / 1000 / 60);

        // ✅ 자리비움 로그 출력
        console.log(
          `[${p.nickname || p.email}] 마지막 활동: ${p.last_seen}, 자리비움 경과: ${diffMinutes}분`
        );

        // 10분 넘음 → 자리비움 전환
        if (diffMinutes >= 10 && p.status !== "자리비움") {
          await supabase
            .from("users")
            .update({
              status_before_away: p.status,
              status: "자리비움",
            })
            .eq("id", p.id);
        }
      }
    };

    updateAwayStatuses();
    const interval = setInterval(updateAwayStatuses, 60000); // 1분마다 실행
    return () => clearInterval(interval);
  }, [participants]);

  // ✅ heartbeat: 내 last_seen 주기적으로 갱신
  useEffect(() => {
    const interval = setInterval(async () => {
      await supabase
        .from("users")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", currentUserId)
    }, 30000) // 30초마다 갱신

    return () => clearInterval(interval)
  }, [currentUserId])

  // ✅ 하이라이트 트리거
  const triggerHighlight = (id: string) => {
    setHighlightedIds((prev) => [...prev, id])
    setTimeout(() => {
      setHighlightedIds((prev) => prev.filter((x) => x !== id))
    }, 10000)
  }

  // ✅ 현재 방 참여자 로드
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("current_room", roomId)

      if (!error && data) setParticipants(data)
    }
    fetchUsers()
  }, [roomId])

  // ✅ 실시간 구독
  useEffect(() => {
    const channel = supabase
      .channel(`users-list-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        async (payload) => {
          const newRow = payload.new as User
          const oldRow = payload.old as User

          // ✅ last_seen 갱신 감지 → 바로 복귀 처리
          if (
            payload.eventType === "UPDATE" &&
            newRow.last_seen !== oldRow?.last_seen && // last_seen 값이 갱신됨
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

          // 기존 participants 갱신 로직 ↓
          setParticipants((prev) => {
            if (payload.eventType === "DELETE" && oldRow) {
              const leaveAudio = new Audio("/assets/sound/Metal Dropped Rolling.mp3")
              leaveAudio.play().catch(console.error)
              triggerHighlight(oldRow.id)
              return prev.filter((u) => u.id !== oldRow.id)
            }

            if (
              (payload.eventType === "INSERT" || payload.eventType === "UPDATE") &&
              newRow.current_room === roomId
            ) {
              const exists = prev.find((u) => u.id === newRow.id)
              if (exists) {
                if (newRow.memo !== exists.memo) {
                  triggerHighlight(newRow.id)
                  const memoAudio = new Audio("/assets/sound/Metallic Clank.mp3")
                  memoAudio.play().catch(console.error)
                }
                return prev.map((u) => (u.id === newRow.id ? newRow : u))
              } else {
                const joinAudio = new Audio("/assets/sound/Pop.mp3")
                joinAudio.play().catch(console.error)
                triggerHighlight(newRow.id)
                return [...prev, newRow]
              }
            }

            if (
              payload.eventType === "UPDATE" &&
              oldRow?.current_room === roomId &&
              newRow.current_room !== roomId
            ) {
              const leaveAudio = new Audio("/assets/sound/Metal Dropped Rolling.mp3")
              leaveAudio.play().catch(console.error)
              triggerHighlight(newRow.id)
              return prev.filter((u) => u.id !== newRow.id)
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

  // ✅ 나를 제일 앞으로 정렬
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.id === currentUserId) return -1
    if (b.id === currentUserId) return 1
    return 0
  })

  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "1rem",
        padding: "1rem",
        overflowY: "auto",
        alignContent: "stretch",
        gridAutoRows: "1fr",
        background: "#101010",
        color: "#fff",
        boxSizing: "border-box",
        height: "100%",
      }}
    >
      <style>{`
        @keyframes glow {
          0%   { border-color: transparent; }
          25%  { border-color: yellow; }
          75%  { border-color: yellow; }
          100% { border-color: transparent; }
        }
        .highlight {
          animation: glow 10s ease-in-out forwards;
          border: 3px solid transparent;
        }
      `}</style>

      {sortedParticipants.length > 0 ? (
        sortedParticipants.map((p) => {
          const bgFile = backgroundMap[p.background || "집"] || "room"
          const charKey = p.character || "A"
          const charName = characterMap[charKey] || "호두"
          const statusKey = p.status || "작업중"
          const statusFile = statusFileMap[statusKey] || "working.gif"

          const characterImage = `/assets/character/${charKey}/${statusFile}`
          const isHighlighted = highlightedIds.includes(p.id)

          // ✅ last_seen 기준으로 오버레이 표시
          const lastSeen = p.last_seen ? new Date(p.last_seen).getTime() : 0
          const diffMinutes = lastSeen ? (Date.now() - lastSeen) / 1000 / 60 : 0
          const showOverlay = diffMinutes >= 10

          return (
            <div
              key={p.id}
              className={isHighlighted ? "highlight" : ""}
              style={{
                borderRadius: "8px",
                position: "relative",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                border: "3px solid transparent",
                overflow: "hidden",
              }}
            >
              {/* 배경 */}
              <img
                src={`/assets/background/${bgFile}.png`}
                alt="background"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  zIndex: 0,
                }}
              />

              {/* 캐릭터 */}
              <img
                src={characterImage}
                alt={`${charName} - ${statusKey}`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  zIndex: 1,
                }}
              />

              {/* 메모 */}
              {p.memo && (
                <div
                  style={{
                    position: "absolute",
                    top: "15%",
                    left: "50%",
                    transform: "translate(-50%)",
                    background: "rgba(255,255,255,0.7)",
                    color: "#000",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    fontSize: "clamp(14px, 4vw, 20px)",
                    fontWeight: "bold",
                    maxWidth: "90%",
                    minHeight: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    zIndex: 2,
                  }}
                >
                  {p.memo}
                </div>
              )}

              {/* 닉네임 */}
              <div
                style={{
                  position: "absolute",
                  bottom: "8px",
                  left: "10px",
                  right: "10px",
                  fontWeight: "bold",
                  fontSize: "clamp(14px, 4vw, 20px)",
                  color: "#fff",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                  zIndex: 2,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {p.nickname || p.email || "이름 없음"}
              </div>

              {/* ✅ 오버레이 */}
              {showOverlay && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "rgba(0,0,0,0.7)",
                    zIndex: 3,
                  }}
                />
              )}
            </div>
          )
        })
      ) : (
        <div style={{ gridColumn: "1 / -1", textAlign: "center" }}>
          아직 참여자가 없어요.
        </div>
      )}
    </div>
  )
}
