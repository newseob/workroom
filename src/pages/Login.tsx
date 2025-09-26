import { useState, useEffect } from "react"
import { supabase } from "../lib/supabaseClient"

type LoginProps = {
  onLoginSuccess: (user: any) => void
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [sessionUser, setSessionUser] = useState<any>(null)
  const [nickname, setNickname] = useState("")

  // ✅ URL 해시 정리 (로그인 직후 #access_token 제거)
  useEffect(() => {
    if (window.location.hash.includes("access_token")) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // ✅ 로그인 상태 확인 & 닉네임 불러오기
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user ?? null
      setSessionUser(user)

      if (user) {
        const { data: userRow } = await supabase
          .from("users")
          .select("nickname")
          .eq("id", user.id)
          .single()

        if (userRow?.nickname) {
          setNickname(userRow.nickname)
        }
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user ?? null
        setSessionUser(user)

        if (user) {
          const { data: userRow } = await supabase
            .from("users")
            .select("nickname")
            .eq("id", user.id)
            .single()

          if (userRow?.nickname) {
            setNickname(userRow.nickname)
          }
        } else {
          setNickname("")
        }
      }
    )

    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [])

  // ✅ 구글 로그인 / 로그아웃
  const handleGoogleLogin = async () => {
    if (sessionUser) {
      // 로그아웃
      await supabase.auth.signOut()
      setSessionUser(null)
      setNickname("")
      return
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      console.error("구글 로그인 오류:", error.message)
    }
  }

  // ✅ 최종 로그인 버튼
  const handleLogin = async () => {
    if (!sessionUser) {
      alert("먼저 구글 로그인을 해주세요.")
      return
    }
    if (!nickname.trim()) {
      alert("닉네임을 입력해주세요.")
      return
    }

    // DB에 닉네임 저장 (업데이트 or 삽입)
    await supabase.from("users").upsert({
      id: sessionUser.id,
      email: sessionUser.email,
      nickname: nickname.trim(),
      updated_at: new Date().toISOString(),
    })

    const userData = {
      id: sessionUser.id,
      email: sessionUser.email,
      nickname: nickname.trim(),
    }
    onLoginSuccess(userData)
  }

  return (
    <div
      style={{
        backgroundColor: "#101010",
        color: "#ccc",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem",
        gap: "2rem",
      }}
    >
      <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#fff" }}>
        WorkRoom ㅣ 같이 작업할래?
      </h1>

      <div
        style={{
          background: "#1a1a1a",
          padding: "1.5rem",
          borderRadius: "8px",
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {/* ✅ 구글 로그인 버튼 */}
        <button
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: sessionUser ? "#333" : "#333",
            color: "#fff",
            fontWeight: "bold",
          }}
          onClick={handleGoogleLogin}
        >
          {sessionUser ? `${sessionUser.email} (로그아웃)` : "구글 로그인"}
        </button>

        {/* ✅ 닉네임 입력 */}
        <input
          type="text"
          placeholder="닉네임을 입력하세요"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          disabled={!sessionUser} // 로그인 전엔 막기
          style={{
            width: "100%",           // ✅ 살짝 줄여서 가운데 배치 효과
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #333",
            background: "#101010",
            color: "#fff",
            opacity: sessionUser ? 1 : 0.5,
            textAlign: "center",    // ✅ 입력 텍스트도 가운데 정렬
          }}
        />

        {/* ✅ 최종 로그인 버튼 */}
        <button
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: "#2563eb",
            color: "#fff",
            fontWeight: "bold",
          }}
          onClick={handleLogin}
        >
          로그인
        </button>
      </div>
    </div>
  )
}
