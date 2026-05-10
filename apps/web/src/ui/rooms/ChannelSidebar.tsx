import React from "react";

interface IProps {
    children: React.ReactNode;
}

const ChannelSidebar: React.FC<IProps> = ({ children }) => {
    return (
        <div className="mx_ChannelSidebar">
            <div className="mx_ChannelSidebar_header">
                <span className="mx_ChannelSidebar_title">Channels</span>
            </div>
            <div className="mx_ChannelSidebar_content">{children}</div>
        </div>
    );
};

export default ChannelSidebar;