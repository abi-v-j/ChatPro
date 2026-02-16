import React, { useState } from "react";
import styles from "./SettingsTab.module.css";

function SettingsTab() {
  const [activeSetting, setActiveSetting] = useState("account");
  const [theme, setTheme] = useState("dark");
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sounds: true,
    desktop: true
  });
  const [autoDelete, setAutoDelete] = useState(30);
  const [language, setLanguage] = useState("english");

  // Demo Functions
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleNotificationToggle = (type) => {
    setNotifications(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleEmptyTrash = () => {
    if (window.confirm("Are you sure you want to permanently delete all items in trash? This action cannot be undone.")) {
      alert("Trash has been emptied successfully.");
    }
  };

  const handleRestoreAllFromTrash = () => {
    if (window.confirm("Restore all items from trash to inbox?")) {
      alert("All items have been restored to inbox.");
    }
  };

  const handleExportData = () => {
    alert("Your data export has started. You will receive an email when it's ready.");
  };

  const handleEnable2FA = () => {
    alert("Two-Factor Authentication setup has been initiated. Check your email for next steps.");
  };

  // Demo Data
  const loginActivities = [
    { 
      device: "Chrome (Windows)", 
      location: "Manjalloor, Kerala, India", 
      time: "Just now",
      status: "success",
      ip: "192.168.1.1"
    },
    { 
      device: "Firefox (Mac)", 
      location: "Cochin, Kerala, India", 
      time: "2 hours ago",
      status: "success",
      ip: "192.168.1.2"
    },
    { 
      device: "Safari (iPhone)", 
      location: "Bangalore, Karnataka, India", 
      time: "1 day ago",
      status: "success",
      ip: "192.168.1.3"
    },
    { 
      device: "Android App", 
      location: "Mumbai, Maharashtra, India", 
      time: "3 days ago",
      status: "success",
      ip: "192.168.1.4"
    }
  ];

  const languages = [
    { code: "english", name: "English", native: "English" },
    { code: "spanish", name: "Spanish", native: "Español" },
    { code: "french", name: "French", native: "Français" },
    { code: "german", name: "German", native: "Deutsch" },
    { code: "hindi", name: "Hindi", native: "हिन्दी" },
    { code: "japanese", name: "Japanese", native: "日本語" }
  ];

  const settingsSections = [
    { id: "account", label: "Account", icon: "👤" },
    { id: "theme", label: "Appearance", icon: "🎨" },
    { id: "notifications", label: "Notifications", icon: "🔔" },
    { id: "security", label: "Security", icon: "🔒" },
    { id: "trash", label: "Trash", icon: "🗑️" },
    { id: "privacy", label: "Privacy", icon: "🛡️" }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account and application preferences</p>
      </div>

      <div className={styles.settingsLayout}>
        {/* Navigation Sidebar */}
        <div className={styles.sidebar}>
          {settingsSections.map((section) => (
            <button
              key={section.id}
              className={`${styles.navButton} ${activeSetting === section.id ? styles.active : ''}`}
              onClick={() => setActiveSetting(section.id)}
            >
              <span className={styles.navIcon}>{section.icon}</span>
              <span className={styles.navLabel}>{section.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className={styles.content}>
          {/* Account Settings */}
          {activeSetting === "account" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Account Settings</h2>
              <p className={styles.sectionDescription}>Manage your profile and account information</p>
              
              <div className={styles.settingsGroup}>
                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Profile Information</h3>
                    <p>Update your personal details and profile picture</p>
                  </div>
                  <button className={styles.primaryButton}>
                    Edit Profile
                  </button>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Language & Region</h3>
                    <p>Choose your preferred language and regional settings</p>
                  </div>
                  <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value)}
                    className={styles.select}
                  >
                    {languages.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name} ({lang.native})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Data Export</h3>
                    <p>Download a copy of your data for backup or transfer</p>
                  </div>
                  <button className={styles.secondaryButton} onClick={handleExportData}>
                    Export My Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Theme Settings */}
          {activeSetting === "theme" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Appearance</h2>
              <p className={styles.sectionDescription}>Customize how WhisperMail looks and feels</p>
              
              <div className={styles.settingsGroup}>
                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Theme</h3>
                    <p>Choose between light and dark mode</p>
                  </div>
                  <div className={styles.themeToggle}>
                    <span className={theme === "light" ? styles.activeTheme : ''}>Light</span>
                    <label className={styles.switch}>
                      <input 
                        type="checkbox" 
                        checked={theme === "dark"} 
                        onChange={toggleTheme}
                      />
                      <span className={styles.slider}></span>
                    </label>
                    <span className={theme === "dark" ? styles.activeTheme : ''}>Dark</span>
                  </div>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Current Theme</h3>
                    <p>Your active theme setting</p>
                  </div>
                  <div className={styles.themeBadge}>
                    {theme.charAt(0).toUpperCase() + theme.slice(1)} Mode
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSetting === "notifications" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Notifications</h2>
              <p className={styles.sectionDescription}>Control how and when you receive notifications</p>
              
              <div className={styles.settingsGroup}>
                {Object.entries(notifications).map(([key, value]) => (
                  <div key={key} className={styles.settingItem}>
                    <div className={styles.settingInfo}>
                      <h3>{key.charAt(0).toUpperCase() + key.slice(1)} Notifications</h3>
                      <p>Receive {key} alerts for new messages</p>
                    </div>
                    <label className={styles.toggle}>
                      <input 
                        type="checkbox" 
                        checked={value}
                        onChange={() => handleNotificationToggle(key)}
                      />
                      <span className={styles.toggleSlider}></span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeSetting === "security" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Security</h2>
              <p className={styles.sectionDescription}>Manage your account security and privacy</p>
              
              <div className={styles.settingsGroup}>
                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Two-Factor Authentication</h3>
                    <p>Add an extra layer of security to your account</p>
                  </div>
                  <button className={styles.primaryButton} onClick={handleEnable2FA}>
                    Enable 2FA
                  </button>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Auto-delete Trash</h3>
                    <p>Automatically empty trash after specified days</p>
                  </div>
                  <div className={styles.rangeSetting}>
                    <input 
                      type="range" 
                      min="1" 
                      max="90" 
                      value={autoDelete}
                      onChange={(e) => setAutoDelete(parseInt(e.target.value))}
                      className={styles.rangeInput}
                    />
                    <span className={styles.rangeValue}>{autoDelete} days</span>
                  </div>
                </div>

             
              </div>
            </div>
          )}

          {/* Trash Management */}
          {activeSetting === "trash" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Trash Management</h2>
              <p className={styles.sectionDescription}>Manage your deleted emails and cleanup settings</p>
              
              <div className={styles.settingsGroup}>
                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Empty Trash</h3>
                    <p>Permanently delete all emails in trash</p>
                  </div>
                  <button className={styles.dangerButton} onClick={handleEmptyTrash}>
                    Empty Trash Now
                  </button>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Restore All</h3>
                    <p>Move all emails from trash back to inbox</p>
                  </div>
                  <button className={styles.secondaryButton} onClick={handleRestoreAllFromTrash}>
                    Restore All Items
                  </button>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Auto-cleanup</h3>
                    <p>Automatically empty trash every {autoDelete} days</p>
                  </div>
                  <div className={styles.autoCleanup}>
                    <label className={styles.checkboxLabel}>
                      <input type="checkbox" defaultChecked />
                      Enable automatic cleanup
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Privacy Settings */}
          {activeSetting === "privacy" && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Privacy</h2>
              <p className={styles.sectionDescription}>Control your privacy and data sharing settings</p>
              
              <div className={styles.settingsGroup}>
                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Data Collection</h3>
                    <p>Help improve WhisperMail by sharing usage data</p>
                  </div>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Advertising</h3>
                    <p>Personalized ads based on your email content</p>
                  </div>
                  <label className={styles.toggle}>
                    <input type="checkbox" />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>

                <div className={styles.settingItem}>
                  <div className={styles.settingInfo}>
                    <h3>Read Receipts</h3>
                    <p>Let senders know when you've read their emails</p>
                  </div>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsTab;