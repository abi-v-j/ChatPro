import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./AnalyticsTab.module.css";

const API_BASE = "http://127.0.0.1:8000";

function AnalyticsTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const fetchAnalytics = async () => {
    if (!token) {
      setError("You are not logged in.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await axios.get(`${API_BASE}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setStats(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyticsData = useMemo(() => {
    if (!stats) return [];

    const dist = stats.distribution || {};
    const inbox = dist.inbox || 0;
    const sent = dist.sent || 0;
    const starred = dist.starred || 0;
    const trash = dist.trash || 0;

    const total = inbox + sent + starred + trash || 1;

    return [
      { label: "Inbox", count: inbox, value: Math.round((inbox / total) * 100), color: "#667eea" },
      { label: "Sent", count: sent, value: Math.round((sent / total) * 100), color: "#10b981" },
      { label: "Starred", count: starred, value: Math.round((starred / total) * 100), color: "#f59e0b" },
      { label: "Trash", count: trash, value: Math.round((trash / total) * 100), color: "#ef4444" },
    ];
  }, [stats]);

  const activityData = useMemo(() => {
    if (!stats) return [];

    const act = stats.activity || {};
    const today = act.today || 0;
    const weekly = act.weekly || 0;
    const monthly = act.monthly || 0;
    const total = act.total || 0;

    // simple trend rules (no design changes, just arrow logic)
    const trend = (a, b) => {
      if (a > b) return "up";
      if (a < b) return "down";
      return "stable";
    };

    return [
      { period: "Today", emails: today, trend: trend(today, weekly / 7) },
      { period: "This Week", emails: weekly, trend: trend(weekly, monthly / 4) },
      { period: "This Month", emails: monthly, trend: trend(monthly, total / 12) },
      { period: "Total", emails: total, trend: "up" },
    ];
  }, [stats]);

  // Optional: use backend contacts in your metrics card
  const activeContacts = stats?.total_contacts ?? 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Email Analytics</h1>
        <p className={styles.subtitle}>Comprehensive overview of your email activity</p>
      </div>

      {loading && <div className={styles.loading}>Loading analytics...</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!loading && !error && stats && (
        <div className={styles.grid}>
          {/* Bar Chart */}
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Email Distribution</h3>
            <br></br>
            <br></br>
            <br></br>
            <br></br>
            <div className={styles.chartContainer}>
              {analyticsData.map((item, index) => (
                <div key={index} className={styles.barItem}>
                  <div className={styles.barInfo}>
                    <span className={styles.barLabel}>{item.label}</span>
                    <span className={styles.barCount}>{item.count} emails</span>
                  </div>

                  <div className={styles.barWrapper}>
                    <div
                      className={styles.bar}
                      style={{
                        height: `${item.value * 2}px`,
                        backgroundColor: item.color,
                      }}
                    ></div>
                  </div>

                  <div className={styles.barPercentage}>{item.value}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Stats */}
          {/* <div className={styles.card}>
            <h3 className={styles.cardTitle}>Activity Overview</h3>
            <div className={styles.activityGrid}>
              {activityData.map((item, index) => (
                <div key={index} className={styles.activityItem}>
                  <div className={styles.activityHeader}>
                    <span className={styles.activityPeriod}>{item.period}</span>
                    <span className={`${styles.trend} ${styles[item.trend]}`}>
                      {item.trend === "up" ? "↗" : item.trend === "down" ? "↘" : "→"}
                    </span>
                  </div>
                  <div className={styles.activityNumber}>{item.emails}</div>
                  <div className={styles.activityLabel}>Emails</div>
                </div>
              ))}
            </div>
          </div> */}

          {/* Additional Metrics */}
          
        </div>
      )}
    </div>
  );
}

export default AnalyticsTab;
