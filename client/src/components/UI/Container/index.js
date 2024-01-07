import React from "react";
import styles from "./index.module.scss";
import clsx from "clsx";

const Container = (props) => {
  return (
    <div
      className={clsx(styles.Container, props.className)}
      {...(props.style && { style: props.style })}
      hidden={props.hidden}
    >
      {props.children}
    </div>
  );
};

export default Container;
