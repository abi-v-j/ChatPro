
import { io } from "socket.io-client";

export const socketClient = io("http://127.0.0.1:8000", {
  withCredentials: true,
  transports: ["websocket"], // Force WebSocket to avoid polling issues
});
