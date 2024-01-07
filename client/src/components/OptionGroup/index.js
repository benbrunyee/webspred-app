import clsx from "clsx";
import React from "react";
import PropTypes from "prop-types";
import styles from "./index.module.css";

export const OptionGroup = (props) => {
  return (
    <div className={clsx(styles.OptionGroup, props.last)}>
      <h3>{props.heading}</h3>
      <div className={styles.OptionGroupContainer}>
        <ul>
          {props.children instanceof Array ? (
            props.children.map((child, index) => {
              return <li key={index}>{child}</li>;
            })
          ) : (
            <li key={0}>{props.children}</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export const Option = (props) => {
  // icon to the left, Label to the right
  return (
    <div className={styles.Option}>
      <div className={styles.OptionIcon}>{props.children}</div>

      <div className={styles.OptionLabel}>{props.label}</div>
    </div>
  );
};

Option.propTypes = {
  label: PropTypes.string,
};
