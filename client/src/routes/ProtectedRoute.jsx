import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

const ProtectedRoute = ({ redirectTo = "/" }) => {
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setAllowed(false);
      setChecking(false);
      return;
    }

    // ✅ verify token by calling backend
    axios
      .get(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => setAllowed(true))
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setAllowed(false);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null; // or a loader component
  return allowed ? <Outlet /> : <Navigate to={redirectTo} replace />;
};

export default ProtectedRoute;
