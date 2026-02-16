import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./StarredPage.module.css";

function StarredPage() {
  const [starredData, setStarredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [senderMap, setSenderMap] = useState({});

  // Fetch starred data
  useEffect(() => {
    const fetchStarred = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You are not logged in. Please login first.");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get("http://localhost:8000/emails/starred", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Collect unique sender IDs
        const uniqueSenders = [
          ...new Set(response.data.map((email) => email.sender_id)),
        ];

        // Fetch sender details (placeholder implementation)
        const senderDetails = {};
        uniqueSenders.forEach((id) => {
          senderDetails[id] = {
            name: `User ${id?.slice(-6) || "Unknown"}`,
            email: `user${id?.slice(-6) || "unknown"}@example.com`,
          };
        });
        setSenderMap(senderDetails);

        // Map API response to local format
        const mappedData = response.data.map((email) => {
          const senderInfo = senderMap[email.sender_id] || {
            name: email.recipients?.[0]?.name || "Unknown Sender",
            email: email.recipients?.[0]?.email || "unknown@example.com",
          };

          return {
            id: email.id,
            name: senderInfo.name,
            email: senderInfo.email,
            message:
              email.body_preview ||
              (email.body
                ? email.body.substring(0, 100) + "..."
                : "No preview"),
            time: email.sent_at || email.created_at
              ? new Date(email.sent_at || email.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Just now",
            starredDate: email.created_at,
            priority: email.priority || "normal",
            fullEmail: email,
          };
        });

        setStarredData(mappedData);
      } catch (err) {
        console.error("Error fetching starred emails:", err);
        setError(err.response?.data?.detail || "Failed to load starred messages");
      } finally {
        setLoading(false);
      }
    };

    fetchStarred();
  }, []);

  // Refresh starred emails
  const refreshStarred = () => {
    setLoading(true);
    setError(null);
    
    const fetchStarred = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You are not logged in. Please login first.");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get("http://localhost:8000/emails/starred", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const uniqueSenders = [
          ...new Set(response.data.map((email) => email.sender_id)),
        ];

        const senderDetails = {};
        uniqueSenders.forEach((id) => {
          senderDetails[id] = {
            name: `User ${id?.slice(-6) || "Unknown"}`,
            email: `user${id?.slice(-6) || "unknown"}@example.com`,
          };
        });
        setSenderMap(senderDetails);

        const mappedData = response.data.map((email) => {
          const senderInfo = senderMap[email.sender_id] || {
            name: email.recipients?.[0]?.name || "Unknown Sender",
            email: email.recipients?.[0]?.email || "unknown@example.com",
          };

          return {
            id: email.id,
            name: senderInfo.name,
            email: senderInfo.email,
            message:
              email.body_preview ||
              (email.body
                ? email.body.substring(0, 100) + "..."
                : "No preview"),
            time: email.sent_at || email.created_at
              ? new Date(email.sent_at || email.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Just now",
            starredDate: email.created_at,
            priority: email.priority || "normal",
            fullEmail: email,
          };
        });

        setStarredData(mappedData);
      } catch (err) {
        console.error("Error fetching starred emails:", err);
        setError(err.response?.data?.detail || "Failed to load starred messages");
      } finally {
        setLoading(false);
      }
    };
    fetchStarred();
  };

  // Unstar email API
  const handleUnstar = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await axios.post(
        `http://localhost:8000/emails/${id}/star`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Remove from local state
      setStarredData((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Unstar failed:", err);
      alert("Failed to unstar email");
    }
  };

  // Archive email (placeholder - implement backend if needed)
  const handleArchive = async (id) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    if (!window.confirm("Archive this email?")) return;

    try {
      // TODO: Implement archive endpoint in backend
      // await axios.post(`http://localhost:8000/emails/${id}/archive`, {}, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });

      // For now, just remove from local state
      setStarredData((prev) => prev.filter((item) => item.id !== id));
      alert("Email archived successfully");
    } catch (err) {
      console.error("Archive failed:", err);
      alert("Failed to archive email");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "#ef4444";
      case "normal":
        return "#3b82f6";
      case "low":
        return "#6b7280";
      case "urgent":
        return "#dc2626";
      default:
        return "#6b7280";
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case "high":
        return "High";
      case "normal":
        return "Normal";
      case "low":
        return "Low";
      case "urgent":
        return "Urgent";
      default:
        return "Normal";
    }
  };

  const formatStarredDate = (dateString) => {
    if (!dateString) return "Unknown date";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Render Table Function (consistent with InboxPage pattern)
  const renderTable = (data, showActions = false) => {
    if (loading) {
      return (
        <div className={styles.tableContainer}>
          <div className={styles.loading}>Loading starred emails...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.tableContainer}>
          <div className={styles.error}>{error}</div>
          <button onClick={refreshStarred} style={{ marginTop: "1rem" }}>
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>#</th>
              <th className={styles.th}>Sender</th>
              <th className={styles.th}>Message</th>
              <th className={styles.th}>Time</th>
              <th className={styles.th}>Starred On</th>
              <th className={styles.th}>Priority</th>
              {showActions && <th className={styles.th}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((item, index) => (
                <tr
                  key={item.id}
                  className={styles.tr}
                >
                  <td className={styles.td}>
                    <div className={styles.serial}>{index + 1}</div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.senderInfo}>
                      <div className={styles.avatar}>
                        {item.name
                          .split(" ")
                          .map((n) => n[0]?.toUpperCase() || "")
                          .join("")}
                      </div>
                      <div className={styles.senderDetails}>
                        <div className={styles.senderName}>{item.name}</div>
                        <div className={styles.senderEmail}>{item.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.messagePreview}>{item.message}</div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.time}>{item.time}</div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.starredDate}>
                      {formatStarredDate(item.starredDate)}
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div
                      className={styles.priorityBadge}
                      style={{
                        backgroundColor: getPriorityColor(item.priority),
                      }}
                    >
                      {getPriorityLabel(item.priority)}
                    </div>
                  </td>
                  {showActions && (
                    <td className={styles.td}>
                      <div className={styles.actionButtons}>
                        <button
                          className={styles.unstarBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnstar(item.id);
                          }}
                          title="Remove Star"
                        >
                          ⭐
                        </button>
                        <button
                          className={styles.archiveBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(item.id);
                          }}
                          title="Archive"
                        >
                          📁
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={showActions ? 7 : 6} className={styles.td}>
                  <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>⭐</span>
                    <p>No starred emails</p>
                    <small>Star important emails to see them here.</small>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Stats Calculation
  const totalStarred = starredData.length;
  const highPriority = starredData.filter((item) => item.priority === "high").length;
  const todayStarred = starredData.filter((item) => {
    if (!item.starredDate) return false;
    const starredDate = new Date(item.starredDate);
    const today = new Date();
    return starredDate.toDateString() === today.toDateString();
  }).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <span className={styles.starIcon}>⭐</span>
          <h1 className={styles.title}>Starred</h1>
        </div>
        <p className={styles.subtitle}>Your important messages</p>

        <div className={styles.stats}>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{totalStarred}</div>
            <div className={styles.statLabel}>Total Starred</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{highPriority}</div>
            <div className={styles.statLabel}>High Priority</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statNumber}>{todayStarred}</div>
            <div className={styles.statLabel}>Starred Today</div>
          </div>
        </div>
        <button onClick={refreshStarred} className={styles.refreshBtn}>
          ↻ Refresh
        </button>
      </div>

      {renderTable(starredData, true)}
    </div>
  );
}

export default StarredPage;