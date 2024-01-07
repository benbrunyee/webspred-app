import clsx from "clsx";
import React from "react";
import Heading from "../Heading";
import styles from "./index.module.scss";
import { IconButton } from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";
import { useViewport } from "../../context/viewport";

const NavBar = ({
  open,
  className,
  toggleSideBar,
  menuButtonClass,
  hideClass,
}) => {
  const { width } = useViewport();
  const isMobile = width < 600;

  return (
    <>
      <div className={clsx(styles.Navbar, className)}>
        <div className={styles.Title}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={toggleSideBar}
            edge="start"
            className={clsx(menuButtonClass, open && hideClass)}
          >
            <MenuIcon />
          </IconButton>
          {!isMobile && <Heading>Webspred Tools</Heading>}
        </div>
      </div>
    </>
  );
};

export default NavBar;
