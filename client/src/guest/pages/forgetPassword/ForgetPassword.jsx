import React, { useState } from "react";
import axios from "axios";
import styles from "./forgetPassword.module.css";
import { useNavigate } from "react-router-dom";

const ForgetPassword = () => {
  const [step, setStep] = useState(1); // 1=email, 2=otp+newpass
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const sendOtp = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await axios.post("http://127.0.0.1:8000/forgot-password-otp", { email });
      setMsg(res.data?.message || "OTP sent");
      setStep(2);
    } catch (err) {
      setMsg(err.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtpAndReset = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);

    try {
      const res = await axios.post("http://127.0.0.1:8000/reset-password-otp", {
        email,
        otp,
        new_password: newPassword,
      });

      setMsg(res.data?.message || "Password reset successful");
      setTimeout(() => navigate("/"), 800);
    } catch (err) {
      setMsg(err.response?.data?.detail || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>{step === 1 ? "Forgot Password" : "Verify OTP"}</h2>
        <p>
          {step === 1
            ? "Enter your registered email to receive an OTP"
            : "Enter the OTP sent to your email and set a new password"}
        </p>

        {step === 1 ? (
          <form onSubmit={sendOtp}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtpAndReset}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled
            />

            <input
              type="text"
              placeholder="Enter OTP (6 digits)"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />

            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP & Reset"}
            </button>

            <button
              type="button"
              disabled={loading}
              style={{ marginTop: 10 }}
              onClick={() => setStep(1)}
            >
              Change email
            </button>
          </form>
        )}

        {msg && <div className={styles.message}>{msg}</div>}

        <div className={styles.back}>
          <span onClick={() => navigate("/")}>← Back to login</span>
        </div>
      </div>
    </div>
  );
};

export default ForgetPassword;
