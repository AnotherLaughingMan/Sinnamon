import React from "react";
import classNames from "classnames";

interface IProps {
    serverRail: React.ReactNode;
    channelSidebar: React.ReactNode;
    main: React.ReactNode;
    rightPanel?: React.ReactNode;
    showRightPanel?: boolean;
}

const SinnamonLayout: React.FC<IProps> = ({ serverRail, channelSidebar, main, rightPanel, showRightPanel = false }) => {
    const classes = classNames("mx_SinnamonLayout", {
        "mx_SinnamonLayout--withRightPanel": showRightPanel,
    });

    return (
        <div className={classes}>
            <aside className="mx_SinnamonLayout_serverRail">{serverRail}</aside>
            <aside className="mx_SinnamonLayout_channelSidebar">{channelSidebar}</aside>
            <main className="mx_SinnamonLayout_main">{main}</main>
            {showRightPanel && <aside className="mx_SinnamonLayout_rightPanel">{rightPanel}</aside>}
        </div>
    );
};

export default SinnamonLayout;
