# Chatify 💬

Chatify is a **real-time full-stack chat application** that allows users to communicate instantly through direct messages and group chats.
It supports **media sharing, online presence, typing indicators, and secure authentication**.

The application is built using the **MERN stack** and real-time communication powered by **Socket.IO**.

---

## 🚀 Live Demo

Frontend: https://chatify-1-8qeq.onrender.com

---

## ✨ Features

### Authentication

* Secure user registration and login
* JWT based authentication
* Refresh token with HTTP-only cookies
* Protected routes

### Chat Features

* Real-time messaging using Socket.IO
* Direct messaging
* Group chats
* Typing indicators
* Online/offline presence

### Media Sharing

* Send images, videos, audio, and documents
* Media upload via Cloudinary
* Instant preview before upload

### User Experience

* Responsive UI for desktop and mobile
* Profile editing with avatar upload
* Message read receipts
* Toast notifications
* Modern chat interface

---

## 🛠 Tech Stack

### Frontend

* React
* Tailwind CSS
* React Router
* Axios
* Socket.IO Client
* React Hot Toast

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* Socket.IO
* JWT Authentication
* Multer (file uploads)
* Cloudinary (media storage)

### Deployment

* Render (frontend & backend)

---

## 📁 Project Structure

```
AdvanceChatApp
│
├── backend
│   ├── controllers
│   ├── models
│   ├── routes
│   ├── middlewares
│   ├── sockets
│   └── server.js
│
├── frontend
│   ├── src
│   │   ├── components
│   │   ├── pages
│   │   ├── context
│   │   ├── routes
│   │   ├── api
│   │   └── utils
│
└── README.md
```

---

## ⚙️ Installation

### 1️⃣ Clone the repository

```
git clone https://github.com/yourusername/chatify.git
cd chatify
```

### 2️⃣ Install dependencies

Backend

```
cd backend
npm install
```

Frontend

```
cd frontend
npm install
```

---

## 🔑 Environment Variables

Create a `.env` file in the **backend** directory.

Example:

```
PORT=5000
MONGO_URI=your_mongodb_connection
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Frontend `.env` example:

```
VITE_API_URL=http://localhost:5000/api
```

---

## ▶️ Running the Application

### Start Backend

```
cd backend
npm run dev
```

### Start Frontend

```
cd frontend
npm run dev
```

Frontend will run on:

```
http://localhost:5173
```

Backend will run on:

```
http://localhost:5000
```

---

## 🔐 Security Features

* HTTP-only refresh token cookies
* JWT authentication
* Protected API routes
* Secure file uploads
* CORS protection

---

## 📸 Screenshots

Add screenshots of:

* Chat interface
* Login page
* Profile modal
* Group chat

---

## 📌 Future Improvements

* Message reactions
* Voice messages
* Push notifications
* Message search
* Dark mode

---

## 👨‍💻 Author

Satyam Kumar

GitHub: https://github.com/Satyam8804

---

## 📄 License

This project is licensed under the MIT License.
