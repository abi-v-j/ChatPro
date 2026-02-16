import React, { useState } from "react";

function SubmissionForm({ title, description }) {
  const [text, setText] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      alert(`${title} submitted successfully! Thank you for your feedback.`);
      setIsSubmitted(true);
      setText("");
    } else {
      alert(`Please enter your ${title.toLowerCase()} before submitting.`);
    }
  };

  return (
    <div style={styles.profileCard}>
      <h2 style={{ color: "#004d40" }}>Submit {title}</h2>
      <p style={{ color: "#004d40", fontSize: "16px", marginBottom: "20px" }}>
        {description}
      </p>
      {isSubmitted ? (
        <div style={{color: "#004d40", fontWeight: "bold", fontSize: "18px"}}>
          Your {title.toLowerCase()} has been submitted.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={`Type your ${title.toLowerCase()} here...`}
            style={styles.textarea}
          />
          <button type="submit" style={styles.button}>
            Submit {title}
          </button>
        </form>
      )}
    </div>
  );
}

const styles = {
  profileCard: {
    textAlign: "center",
    backgroundColor: "#e0f7fa",
    padding: "30px",
    borderRadius: "12px",
    boxShadow: "0 6px 15px rgba(0,0,0,0.2)",
    maxWidth: "400px",
    margin: "40px auto",
    transition: "all 0.3s ease",
  },
  textarea: {
    padding: "12px 16px",
    fontSize: "16px",
    borderRadius: "6px",
    border: "1.5px solid #004d40",
    outlineColor: "#00796b",
    resize: "vertical",
    width: "100%",
  },
  button: {
    backgroundColor: "#00796b",
    color: "white",
    border: "none",
    padding: "12px 24px",
    fontSize: "16px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    marginTop: "10px",
    transition: "all 0.3s ease",
  },
};

export default SubmissionForm;