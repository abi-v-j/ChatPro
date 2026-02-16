import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import styles from "./Register.module.css";

const Register = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const res = await axios.post("http://127.0.0.1:8000/register", formData);

      setMessage(res.data.message || "User registered successfully");
      setFormData({ username: "", name: "", email: "", password: "" });

      setTimeout(() => navigate("/"), 1000);
    } catch (error) {
      if (error.response) {
        setMessage(`Error: ${error.response.data.detail}`);
      } else {
        setMessage("Error: Failed to connect to the server");
      }
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = message && !message.startsWith("Error:");

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.subtitle}>Register to start using EmailProMax</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={50}
            />
          </div>

          <div className={styles.inputGroup}>
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
              minLength={1}
              maxLength={100}
            />
          </div>

          <div className={styles.inputGroup}>
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              required
              maxLength={255}
            />
          </div>

          <div className={styles.inputGroup}>
            <input
              type="password"
              name="password"
              placeholder="Password (min 8 chars)"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
            />
          </div>

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        {message && (
          <div className={isSuccess ? styles.successMsg : styles.errorMsg}>
            {message}
          </div>
        )}

        <div className={styles.footer}>
          <p>
            Already have an account?{" "}
            <span className={styles.link} onClick={() => navigate("/")}>
              Login
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
