import clsx from "clsx";
import React from 'react';
import PropTypes from 'prop-types';
import styles from './index.module.scss';
import { Typography } from "@material-ui/core";

Heading.propTypes = {
    children: PropTypes.any,
    className: PropTypes.string,
    style: PropTypes.object,
};

function Heading(props) {
    return (
        <Typography style={props.style} className={clsx(styles.Heading, props.className)}>{props.children}</Typography>
    );
}

export default Heading;
