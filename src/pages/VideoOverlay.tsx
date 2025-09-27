import React from "react"

export default function VideoOverlay() {
  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden" }}>
      {/* 배경 영상 */}
      <video
        className="background"
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: -1,
        }}
      >
        <source src="/assets/room_subway/your-video.mp4" type="video/mp4" />
        브라우저가 video 태그를 지원하지 않습니다.
      </video>

      {/* PNG 오버레이 */}
      <div
        className="overlay"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 10,
        }}
      >
        <img
          src="/assets/room_subway/overlay.png"
          alt="Overlay Image"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
    </div>
  )
}
