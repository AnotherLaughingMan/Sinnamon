import React from "react";

interface IProps {
    children: React.ReactNode;
}

const ServerRail: React.FC<IProps> = ({ children }) => {
    return (
        <div className="mx_ServerRail">
            <div className="mx_ServerRail_brand">
                <div aria-label="Sinnamon" className="mx_ServerRail_brandBadge">
                    S
                </div>
            </div>
            <div className="mx_ServerRail_content">{children}</div>
        </div>
    );
};

export default ServerRail;