import React from "react";

const NotificationStateContext = React.createContext();
const NotificationDispatchContext = React.createContext();


function notificationReducer(state, action) {
    switch (action.type) {
        case "add":
            return [...state, action.item];
        case "remove":
            state.shift();
            return state;
        case "removeAll":
            return [];
        default:
            throw new Error(`Unhandled action type: ${action.type}`);
    }
}

const NotificationProvider = ({children}) => {
    const [state, dispatch] = React.useReducer(notificationReducer, [], () => []);

    return (
        <NotificationStateContext.Provider value={state}>
            <NotificationDispatchContext.Provider value={dispatch}>
                {children}
            </NotificationDispatchContext.Provider>
        </NotificationStateContext.Provider>
    );
};

function useNotificationState() {
    const context = React.useContext(NotificationStateContext);

    if (context === undefined) {
        throw new Error("useNotificationState must be used within NotificationProvider");
    }

    return context;
}

function useNotificationDispatch() {
    const context = React.useContext(NotificationDispatchContext);

    if (context === undefined) {
        throw new Error("useNotificationState must be used within NotificationProvider");
    }

    return context;
}

export {NotificationProvider, useNotificationState, useNotificationDispatch, NotificationDispatchContext};
