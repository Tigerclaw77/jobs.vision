import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchNotifications,
  markNotificationRead,
  deleteNotification,
  markAllRead,
  deleteAllNotifications,
} from "../store/notificationsSlice";
import ProfileCompletionModule from "./Profile/ProfileCompletionModule";
import "../styles/Notifications.css";
import "../styles/Profile.css";

const Notifications = () => {
  const dispatch = useDispatch();
  const notifications = useSelector((state) => state.notifications.items);
  const profileCompletion = useSelector((state) => state.notifications.profileCompletion);
  const loading = useSelector((state) => state.notifications.loading);
  const error = useSelector((state) => state.notifications.error);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch, user?.id]);

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h2 className="page-header">Notifications</h2>
        <div className="notifications-controls">
          <button onClick={() => dispatch(markAllRead())}>Mark All Read</button>
          <button onClick={() => dispatch(deleteAllNotifications())}>Delete All</button>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      {profileCompletion?.score !== undefined && profileCompletion?.score !== null && (
        <div className="notifications-completion-card">
          <ProfileCompletionModule
            completion={profileCompletion}
            compact
            includeOptional={false}
          />
        </div>
      )}

      <div className="notifications-list">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`notification-item ${notif.isRead ? "read" : "unread"} ${notif.severity || ""}`}
          >
            <div
              className="notification-content"
              onClick={() => dispatch(markNotificationRead(notif.id))}
            >
              {!notif.isRead && <span className="unread-dot"></span>}
              <span className="notification-message">{notif.message}</span>
              {notif.link && (
                <Link to={notif.link} className="notif-link">
                  {notif.actionLabel || "View"}
                </Link>
              )}
            </div>
            <button
              className="delete-button"
              onClick={() => dispatch(deleteNotification(notif.id))}
              aria-label="Delete notification"
            >
              &times;
            </button>
          </div>
        ))}

        {notifications.length === 0 && !loading && <p>No notifications yet.</p>}
      </div>
    </div>
  );
};

export default Notifications;
