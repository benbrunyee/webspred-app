import React from 'react';
import clsx from "clsx";
import styles from "./index.module.scss";
import PropTypes from 'prop-types';

const PageView = props => {
    return (
        <div className={clsx(styles.Page, props.className)} style={props.style}>
            {props.children}
        </div>
    );
};

PageView.propTypes = {
    style: PropTypes.object,
    children: PropTypes.any,
    className: PropTypes.string,
};

export default PageView;
