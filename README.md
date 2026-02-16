# ChatPro

ChatPro is a full-stack chat application featuring secure messaging, face recognition authentication, and a modern, modular frontend. The project is divided into a React-based client and a Python FastAPI server, supporting real-time communication and advanced user authentication.

## Features

### Client (Frontend)
- **React + Vite**: Fast, modern SPA with modular structure
- **Role-based Routing**: Separate routes for Admin, User, and Guest
- **Face Recognition Authentication**: Uses face-api.js models for secure login
- **User Dashboard**: Inbox, Sent, Starred, Trash, Analytics, Profile, Settings, and Help tabs
- **Admin Panel**: Dashboard and Home pages for admin management
- **Socket.io Integration**: Real-time messaging and notifications
- **Responsive UI**: Custom components for navigation, forms, and lists

### Server (Backend)
- **Python FastAPI**: High-performance API server
- **Face Recognition**: Python-based face recognition for authentication
- **File Encryption**: Secure file uploads with encryption
- **RESTful Endpoints**: User management, authentication, and chat APIs

## Project Structure

```
ChatPro/
├── client/           # React frontend
│   ├── public/models # Face recognition models
│   ├── src/          # Source code
│   │   ├── admin/    # Admin components/pages
│   │   ├── guest/    # Guest components/pages
│   │   ├── user/     # User components/pages
│   │   ├── routes/   # App routing
│   │   ├── context/  # React context (e.g., SocketConfig)
│   │   ├── globals/  # Global utilities (e.g., Socket.js)
│   │   └── utils/    # Utility functions (e.g., cryptoKeys.js)
│   ├── package.json  # Frontend dependencies
│   └── vite.config.js# Vite config
├── server/           # Python backend
│   ├── main.py       # FastAPI entry point
│   ├── face_recognition.py # Face recognition logic
│   ├── requirements.txt    # Python dependencies
│   └── uploads/      # Encrypted uploaded files
```

## Setup Instructions

### Prerequisites
- Node.js (v16+ recommended)
- Python 3.8+
- pip (Python package manager)

### 1. Clone the Repository
```sh
git clone <your-repo-url>
cd ChatPro
```

### 2. Install Client Dependencies
```sh
cd client
npm install
```

### 3. Install Server Dependencies
```sh
cd ../server
pip install -r requirements.txt
```

### 4. Run the Application
#### Start the Backend Server
```sh
cd server
python main.py
```

#### Start the Frontend
```sh
cd client
npm run dev
```

### 5. Access the App
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:8000](http://localhost:8000)

## Face Recognition Setup
- Face recognition models are stored in `client/public/models/`.
- Ensure your webcam is enabled for face authentication features.

## Security
- All uploaded files are encrypted before storage.
- Face authentication adds an extra layer of security for user login.

## Folder Details
- **client/src/admin/**: Admin dashboard and navigation
- **client/src/guest/**: Guest login, registration, and face authentication
- **client/src/user/**: User dashboard, messaging, analytics, and settings
- **client/src/routes/**: Route definitions for all user roles
- **client/src/context/**: React context for sockets and global state
- **client/src/globals/**: Global utilities (e.g., Socket.io setup)
- **client/src/utils/**: Utility functions (e.g., cryptography)
- **server/**: FastAPI backend, face recognition, encrypted uploads

## Technologies Used
- **Frontend**: React, Vite, face-api.js, Socket.io-client, CSS Modules
- **Backend**: Python, FastAPI, face_recognition, cryptography

## License
This project is for educational purposes. Please check individual file headers for more details.

## Authors
- AJ

---
Feel free to contribute or raise issues for improvements!
