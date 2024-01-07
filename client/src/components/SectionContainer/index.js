import clsx from "clsx";
import React from "react";
import styles from "./index.module.scss";

const SectionContainer = ({ children, className, focussed, ...props }) => {
  return (
    <div
      className={clsx(className, styles.SectionContainer, {
        [styles.FocusContainer]: focussed,
      })}
      {...props}
    >
      {children}
    </div>
  );
};

export default SectionContainer;
