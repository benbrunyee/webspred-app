import clsx from "clsx";
import * as React from "react";
import config from "../../config";
import styles from "./index.module.css";

const CopyrightBanner = (props) => {
    return (
        <div className={clsx(styles.Copyright, props.className)}>
            {
                process.env.NODE_ENV === "production" ? <p>{config.app.NAME}@{config.app.VERSION}</p> :
                    <p>{config.app.NAME}@{config.app.DEV_VERSION}</p>
            }
            <p>&copy; {new Date().getFullYear()} Influencer Hub</p>
            <p>All Rights Reserved.</p>
        </div>
    );
};

export default CopyrightBanner;
