import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MainRoutes from './routes/MainRoutes.jsx'

import { BrowserRouter } from 'react-router-dom'
import { SocketContext } from './context/SocketConfig.jsx'
import { socketClient } from './globals/Socket.js'


createRoot(document.getElementById('root')).render(
  <SocketContext.Provider value={{ socketClient }}>
    <BrowserRouter>
      <MainRoutes />
    </BrowserRouter>
  </SocketContext.Provider>
)
