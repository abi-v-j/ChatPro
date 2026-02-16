import React, { useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "../forgetPassword/forgetPassword.module.css"; // reuse same design

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await axios.post("http://127.0.0.1:8000/reset-password", {
        token,
        new_password: newPassword,
      });

      setMsg(res.data?.message || "Password reset successful");
      setTimeout(() => navigate("/"), 1000);
    } catch (err) {
      setMsg(err.response?.data?.detail || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2>Reset Password</h2>
          <p>Invalid reset link.</p>
          <div className={styles.back}>
            <span onClick={() => navigate("/")}>← Back to login</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>Reset Password</h2>
        <p>Enter your new password</p>

        <form onSubmit={handleReset}>
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        {msg && <div className={styles.message}>{msg}</div>}

        <div className={styles.back}>
          <span onClick={() => navigate("/")}>← Back to login</span>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
