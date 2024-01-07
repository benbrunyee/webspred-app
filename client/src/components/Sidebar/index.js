import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import styles from "./index.module.scss";
import IconButton from "@material-ui/core/IconButton";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";

const SideBar = ({ children, toggleOpen }) => {
  return (
    <div className={styles.Sidebar}>
      <div className={styles.Title}>
        <Link to={"/"}>
          <img src={"logo.png"} alt="logo" />
        </Link>
        <IconButton
          size={"medium"}
          className={styles.toggleSideBar}
          onClick={toggleOpen}
        >
          {<ChevronLeftIcon />}
        </IconButton>
      </div>
      <div>
        <div className={styles.Options}>{children}</div>
      </div>
    </div>
  );
};

SideBar.propTypes = {
  children: PropTypes.any,
};

export default SideBar;
