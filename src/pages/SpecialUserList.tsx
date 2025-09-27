import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

type User = {
  id: string
  nickname: string | null
  current_room?: string | null
  memo?: string | null
}

type SpecialUserListProps = {
  roomId: string
  currentUserId: string
}

// ✅ 닉네임 → 이미지 번호
const imageMap: Record<string, number> = {
  "망고멍": 1,
  "우유": 2,
  "켠피": 3,
  "모니": 4,
  "호떡": 5,
  "뚜노": 6,
}

// ✅ 닉네임 → 순서
const orderMap: Record<string, number> = {
  "호떡": 1,
  "망고멍": 2,
  "우유": 3,
  "켠피": 4,
  "모니": 5,
  "뚜노": 6,
}

// ✅ 닉네임별 메모 위치 (퍼센트 좌표)
const memoPositionMap: Record<string, { top: string; left: string }> = {
  "호떡": { top: "17%", left: "28%" },
  "망고멍": { top: "30%", left: "80%" },
  "우유": { top: "26%", left: "71%" },
  "켠피": { top: "19%", left: "63%" },
  "모니": { top: "24%", left: "53%" },
  "뚜노": { top: "33%", left: "40%" },
}

export default function SpecialUserList({ roomId }: SpecialUserListProps) {
  const [participants, setParticipants] = useState<User[]>([])

  useEffect(() => {
    if (!roomId) return

    const fetchParticipants = async () => {
      const { data } = await supabase
        .from("users")
        .select("id, nickname, memo, current_room")
        .eq("current_room", roomId)

      if (data) setParticipants(data)
    }

    fetchParticipants()

    const channel = supabase
      .channel(`special-users-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchParticipants()
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
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {sorted.map((p) => {
        const imgNum = imageMap[p.nickname ?? ""]
        if (!imgNum) return null

        return (
          <div key={p.id}>
            {/* 캐릭터 이미지 */}
            <img
              src={`/assets/summerspring/${imgNum}.png`}
              alt={p.nickname || "캐릭터"}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
                zIndex: 999 - (orderMap[p.nickname ?? ""] ?? 999),
              }}
            />

            {/* 실제 메모 */}
            {p.memo && (
              <div
                style={{
                  position: "absolute",
                  top: memoPositionMap[p.nickname ?? ""]?.top || "20%",
                  left: memoPositionMap[p.nickname ?? ""]?.left || "50%",
                  transform: "translate(-50%, -50%)",
                  background: "rgba(255, 255, 255, 0.7)", // ✅ 흰색 + 투명
                  color: "#000",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  whiteSpace: "nowrap",
                  zIndex: 2000,
                }}
              >
                {p.memo}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
