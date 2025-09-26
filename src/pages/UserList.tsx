type User = {
    id: string
    email: string | null
    nickname: string | null
  }
  
  type UserListProps = {
    participants: User[]
  }
  
  export default function UserList({ participants }: UserListProps) {
    return (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {participants.length > 0 ? (
          participants.map((p) => (
            <li key={p.id} style={{ lineHeight: "1.9" }}>
              {p.nickname || p.email || "이름 없음"}
            </li>
          ))
        ) : (
          <li>아직 참여자가 없어요.</li>
        )}
      </ul>
    )
  }
  