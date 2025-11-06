import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io();

function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    socket.on("new_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("room_info", ({ members }) => {
      setMemberCount(members);
    });

    return () => {
      socket.off("new_message");
      socket.off("room_info");
    };
  }, []);

  const joinRoom = () => {
    if (!roomId || !displayName) return alert("Enter both name and room ID");
    socket.emit("join_room", { roomId, displayName }, (res) => {
      if (!res.ok) return alert(res.error);
      setJoined(true);
      setMessages(res.history || []);
      setMemberCount(res.members || 1);
    });
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    socket.emit("send_message", { content: input }, () => setInput(""));
  };

  if (!joined) {
    return (
      <div className="join-container">
        <h2>Join Chat Room</h2>
        <input
          placeholder="Enter display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          placeholder="Enter room number (1–10000)"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={joinRoom}>Join</button>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <h2>Room #{roomId}</h2>
      <p>Members online: {memberCount}</p>
      <div className="messages">
        {messages.map((msg) => {
          const isOwn = msg.displayName === displayName;
          return (
            <div
              key={msg.messageId}
              className={`message-wrapper ${isOwn ? "own" : "other"}`}
            >
              <div className="username">{msg.displayName}</div>
              <div className="message">{msg.content}</div>
            </div>
          );
        })}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default App;
