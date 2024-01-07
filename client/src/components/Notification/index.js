import clsx from "clsx";
import styles from "./index.module.css";
import React, { useState } from "react";
import Close from "@material-ui/icons/Close";
import Snackbar from "@material-ui/core/Snackbar";
import IconButton from "@material-ui/core/IconButton";
import Warning from "@material-ui/icons/Warning";
import Report from "@material-ui/icons/ReportRounded";
import CheckCircle from "@material-ui/icons/CheckCircle";
import { useNotificationState } from "../../context/notifications";
import InfoIcon from "@material-ui/icons/Info";

function NotificationContainer({ message, type }) {
  const [open, setOpen] = useState(true);

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
      autoHideDuration={5000}
      onClose={() => setOpen(false)}
      message={notificationMessage}
      action={
        <IconButton
          size="small"
          aria-label="close"
          color="inherit"
          onClick={() => setOpen(false)}
        >
          <Close fontSize="small" />
        </IconButton>
      }
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
        key={index}
      />
    );
  });
};

export default NotificationDisplay;
