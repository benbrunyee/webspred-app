import IconButton from "@material-ui/core/IconButton";
import Snackbar from "@material-ui/core/Snackbar";
import CheckCircle from "@material-ui/icons/CheckCircle";
import Close from "@material-ui/icons/Close";
import InfoIcon from "@material-ui/icons/Info";
import Report from "@material-ui/icons/ReportRounded";
import Warning from "@material-ui/icons/Warning";
import clsx from "clsx";
import React, { useState } from "react";
import { useNotificationState } from "../../context/notifications";
import styles from "./index.module.css";

function NotificationContainer({ message, type, indefinite, canClose }) {
  const [open, setOpen] = useState(true);
  canClose = typeof canClose === "undefined" ? true : canClose;
  indefinite = typeof indefinite === "undefined" ? false : indefinite;

  let notificationMessage = (function () {
    switch (type) {
      case "error":
        return (
          <div className={clsx(styles.Notification, styles.error)}>
            <Warning />
            <p>{message}</p>
          </div>
        );
      case "success":
        return (
          <div className={clsx(styles.Notification, styles.success)}>
            <CheckCircle />
            <p>{message}</p>
          </div>
        );
      case "warning":
        return (
          <div className={clsx(styles.Notification, styles.warning)}>
            <Report />
            <p>{message}</p>
          </div>
        );
      case "info":
        return (
          <div className={clsx(styles.Notification, styles.info)}>
            <InfoIcon />
            <p>{message}</p>
          </div>
        );
      default:
        return message;
    }
  })();

  return (
    <Snackbar
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      open={open}
      autoHideDuration={indefinite ? null : 5000}
      onClose={() => canClose && setOpen(false)}
      message={notificationMessage}
      {...(canClose
        ? {
            action: (
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={() => setOpen(false)}
              >
                <Close fontSize="small" />
              </IconButton>
            ),
          }
        : {})}
    />
  );
}

/**
 * This is a container to display notification toasts when they are passed
 * via the notification context API. The component uses the 'useNotificationState'
 * to access the notification state.
 * */
const NotificationDisplay = () => {
  const notifications = useNotificationState();

  return notifications.map((notification, index) => {
    return (
      <NotificationContainer
        type={notification.type}
        message={notification.message}
        indefinite={notification.indefinite}
        canClose={notification.canClose}
        key={index}
      />
    );
  });
};

export default NotificationDisplay;
