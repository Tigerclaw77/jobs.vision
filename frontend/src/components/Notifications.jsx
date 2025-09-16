import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchNotifications,
  markNotificationRead,
  deleteNotification,
  markAllRead,
  deleteAllNotifications,
} from "../store/notificationsSlice";
import "../styles/Notifications.css";

const Notifications = () => {
  const dispatch = useDispatch();
  const notifications = useSelector((state) => state.notifications.items);
  const loading = useSelector((state) => state.notifications.loading);
  const error = useSelector((state) => state.notifications.error);

  const user = useSelector((state) => state.auth.user);


  useEffect(() => {
    dispatch(fetchNotifications());
    console.log("🔍 Logged in user ID:", user?._id || user?.id || "No user found");
  }, [dispatch, user]);

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

      <div className="notifications-list">
        {notifications.map((notif) => (
          <div key={notif._id} className={`notification-item ${notif.isRead ? "read" : "unread"}`}>
            <div className="notification-content" onClick={() => dispatch(markNotificationRead(notif._id))}>
              {!notif.isRead && <span className="unread-dot"></span>}
              <span>{notif.message}</span>
              {notif.link && (
                <a href={notif.link} className="notif-link">View</a>
              )}
            </div>
            <button
              className="delete-button"
              onClick={() => dispatch(deleteNotification(notif._id))}
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
