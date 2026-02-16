import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
import UserRoutes from "../routes/UserRoutes";
import styles from "./UserLayout.module.css";

const API_BASE = "http://127.0.0.1:8000";

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i >= 3 ? 1 : 0)} ${sizes[i]}`;
};




const timeAgo = (iso) => {
  if (!iso) return "Just now";
  const dt = new Date(iso);
  const diff = Date.now() - dt.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 30) return "Just now";
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min > 1 ? "s" : ""} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? "s" : ""} ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day > 1 ? "s" : ""} ago`;
};

const iconForType = (type) => {
  if (type === "sent") return "📧";
  if (type === "starred") return "⭐";
  if (type === "contact") return "👥";
  return "🔔";
};

const UserLayout = () => {
  const [isToolsOpen, setIsToolsOpen] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [me, setMe] = useState(null);
  const navigate = useNavigate();


  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    axios.get("http://127.0.0.1:8000/users/me", {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setMe(res.data)).catch(() => { });
  }, []);

  // ✅ Real dashboard data
  const [recentActivity, setRecentActivity] = useState([]);
  const [storage, setStorage] = useState({
    used_bytes: 0,
    quota_bytes: 20 * 1024 * 1024 * 1024,
    used_percent: 0,
  });


  const handleLogout = async () => {
    try {
      // OPTIONAL: if you add a backend logout endpoint
      const token = localStorage.getItem("token");
      if (token) {
        await axios.post(`${API_BASE}/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => { });
      }
    } finally {
      // ✅ Clear auth
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // if you stored keys:
      localStorage.removeItem("publicKey");
      localStorage.removeItem("privateKey");

      navigate("/", { replace: true });
    }
  };

  const navigationItems = [
    { path: "/user/compose", label: "Compose", icon: "✏️", badge: null },
    { path: "/user/inbox", label: "Inbox", icon: "📥", badge: null },
    { path: "/user/starred", label: "Starred", icon: "⭐", badge: null },
    { path: "/user/sent", label: "Sent", icon: "📤", badge: null },
    { path: "/user/trash", label: "Trash", icon: "🗑️", badge: null },
  ];

  const secondaryItems = [
    { path: "/user/analytics", label: "Analytics", icon: "📊", badge: null },
    { path: "/user/help", label: "Help", icon: "❓", badge: null },
    { path: "/user/profile", label: "Profile", icon: "👤", badge: null }, // ✅ icon fixed
  ];

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // ✅ Fetch dashboard data from your backend
  const fetchDashboard = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const [activityRes, storageRes] = await Promise.all([
        axios.get(`${API_BASE}/dashboard/recent-activity`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE}/dashboard/storage`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setRecentActivity(activityRes.data?.items || []);
      setStorage(storageRes.data || storage);
    } catch (e) {
      // keep UI stable even if backend fails
      console.error("Dashboard fetch error:", e?.response?.data || e.message);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // Optional: refresh every 30s
    const t = setInterval(fetchDashboard, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`${styles.layout} ${styles[theme + "Theme"]}`}>
      {/* Mobile Menu Toggle */}
      <button className={styles.mobileMenuToggle} onClick={toggleMobileMenu}>
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Main Sidebar */}
      <nav className={`${styles.sidebar} ${isMobileMenuOpen ? styles.mobileOpen : ""}`}>
        {/* Header */}
        <div className={styles.sidebarHeader}>
          <div className={styles.appBrand}>
            <div className={styles.brandIcon}>✉️</div>
            <div className={styles.brandText}>
              <h1>WhisperMail</h1>
              <span className={styles.brandSubtitle}>Secure Communication</span>
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className={styles.userProfile}>
          <div className={styles.userAvatar}>
            <div className={styles.avatarImage}></div>
            <div className={styles.onlineIndicator}></div>
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{me?.name || "User"}</span>
            <span className={styles.userEmail}>{me?.email || "—"}</span>
          </div>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>


        {/* Navigation Sections */}
        <div className={styles.navigation}>
          {/* Main Navigation */}
          <div className={styles.navSection}>
            <h3 className={styles.sectionLabel}>MAIL</h3>
            <div className={styles.navItems}>
              {navigationItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}
                >
                  <div className={styles.navItemContent}>
                    <span className={styles.navIcon}>{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                    {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
                  </div>
                  <div className={styles.activeIndicator}></div>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <span className={styles.navIcon}>🚪</span>
          <span className={styles.navLabel}>Logout</span>
        </button>


        {/* Quick Actions */}

      </nav>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          <UserRoutes />
        </div>
      </main>

      {/* Tools Sidebar */}
      <aside className={`${styles.toolsSidebar} ${isToolsOpen ? styles.open : styles.closed}`}>
        <div className={styles.navSection}>
          <h3 className={styles.sectionLabel}>MANAGE</h3>
          <div className={styles.navItems}>
            {secondaryItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ""}`}
              >
                <div className={styles.navItemContent}>
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                </div>
                <div className={styles.activeIndicator}></div>
              </NavLink>
            ))}
          </div>
        </div>

        {/* Tools Content */}
        {isToolsOpen && (
          <div className={styles.toolsContent}>
            <div className={styles.toolsSection}></div>

            {/* ✅ Recent Activity (NOW FROM BACKEND) */}
            <div className={styles.toolsSection}>
              <h4 className={styles.toolsTitle}>Recent Activity</h4>
              <div className={styles.activityList}>
                {recentActivity.length === 0 ? (
                  <div className={styles.activityItem}>
                    <div className={styles.activityIcon}>🕒</div>
                    <div className={styles.activityDetails}>
                      <span>No recent activity</span>
                      <small>—</small>
                    </div>
                  </div>
                ) : (
                  recentActivity.slice(0, 3).map((a, idx) => (
                    <div key={idx} className={styles.activityItem}>
                      <div className={styles.activityIcon}>{iconForType(a.type)}</div>
                      <div className={styles.activityDetails}>
                        <span>{a.label}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ✅ Storage (NOW FROM BACKEND) */}
            <div className={styles.toolsSection}>
              <h4 className={styles.toolsTitle}>Storage</h4>
              <div className={styles.storageInfo}>
                <div className={styles.storageProgress}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${Math.min(storage.used_percent || 0, 100)}%` }}
                    ></div>
                  </div>
                  <span className={styles.storagePercent}>{Math.round(storage.used_percent || 0)}% used</span>
                </div>
                <span className={styles.storageDetails}>
                  {formatBytes(storage.used_bytes)} of {formatBytes(storage.quota_bytes)}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default UserLayout;
